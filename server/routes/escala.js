const express = require('express');
const db = require('../db');

const router = express.Router();

function paraISO(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

function hojeISO() {
    return paraISO(new Date());
}

function listaPessoas() {
    return db.prepare('SELECT * FROM pessoas_escala ORDER BY ordem').all();
}

function proximoAtivo(pessoas, depoisDeOrdem) {
    const n = pessoas.length;
    if (n === 0) return null;
    let idx = pessoas.findIndex(p => p.ordem > depoisDeOrdem);
    if (idx === -1) idx = 0;
    for (let i = 0; i < n; i++) {
        const p = pessoas[(idx + i) % n];
        if (p.ativo) return p;
    }
    return null;
}

function redistribuirFuturos() {
    const pessoas = listaPessoas();
    const porId = new Map(pessoas.map(p => [p.id, p]));
    const hoje = hojeISO();

    const ultimaPassada = db.prepare('SELECT * FROM escala_sabados WHERE data < ? ORDER BY data DESC LIMIT 1').get(hoje);
    let ponteiro = ultimaPassada ? porId.get(ultimaPassada.pessoa_id).ordem : (pessoas[0] ? pessoas[0].ordem - 1 : 0);

    const futuras = db.prepare('SELECT * FROM escala_sabados WHERE data >= ? ORDER BY data ASC').all(hoje);
    const atualizar = db.prepare('UPDATE escala_sabados SET pessoa_id = ? WHERE id = ?');

    for (const linha of futuras) {
        if (linha.folga) continue; // sábado pulado: não consome a vez na rotação
        if (linha.manual) {
            ponteiro = porId.get(linha.pessoa_id).ordem;
            continue;
        }
        const prox = proximoAtivo(pessoas, ponteiro);
        if (!prox) break;
        if (prox.id !== linha.pessoa_id) atualizar.run(prox.id, linha.id);
        ponteiro = prox.ordem;
    }
}

function garantirHorizonte(minimo) {
    const hoje = hojeISO();
    const totalFuturas = db.prepare('SELECT COUNT(*) AS c FROM escala_sabados WHERE data >= ?').get(hoje).c;
    if (totalFuturas >= minimo) return;

    const ultima = db.prepare('SELECT * FROM escala_sabados ORDER BY data DESC LIMIT 1').get();
    if (!ultima) return;

    const pessoas = listaPessoas();
    const porId = new Map(pessoas.map(p => [p.id, p]));
    let cursor = new Date(`${ultima.data}T00:00:00`);

    // Encontra o ponteiro real olhando o último não-folga da lista
    const ultimaNaoFolga = db.prepare('SELECT * FROM escala_sabados WHERE folga = 0 ORDER BY data DESC LIMIT 1').get();
    let ponteiro = ultimaNaoFolga ? porId.get(ultimaNaoFolga.pessoa_id).ordem : (pessoas[0] ? pessoas[0].ordem - 1 : 0);

    const inserir = db.prepare('INSERT INTO escala_sabados (data, pessoa_id, manual, folga, criado_em) VALUES (?, ?, 0, 0, ?)');
    const faltam = minimo - totalFuturas;
    for (let i = 0; i < faltam; i++) {
        cursor = new Date(cursor.getTime() + 7 * 86400000);
        const prox = proximoAtivo(pessoas, ponteiro);
        if (!prox) break;
        inserir.run(paraISO(cursor), prox.id, new Date().toISOString());
        ponteiro = prox.ordem;
    }
}

router.get('/pessoas', (req, res) => {
    res.json(listaPessoas());
});

router.put('/pessoas/:id', (req, res) => {
    const pessoa = db.prepare('SELECT * FROM pessoas_escala WHERE id = ?').get(req.params.id);
    if (!pessoa) return res.status(404).json({ error: 'pessoa não encontrada' });

    const { nome, ativo } = req.body;
    const novoAtivo = ativo !== undefined ? (ativo ? 1 : 0) : pessoa.ativo;

    if (novoAtivo === 0 && pessoa.ativo === 1) {
        const outrosAtivos = db.prepare('SELECT COUNT(*) AS c FROM pessoas_escala WHERE ativo = 1 AND id != ?').get(pessoa.id).c;
        if (outrosAtivos === 0) return res.status(400).json({ error: 'não é possível desativar a última pessoa ativa do rodízio' });
    }

    const novoNome = nome !== undefined && nome.trim() ? nome.trim() : pessoa.nome;
    db.prepare('UPDATE pessoas_escala SET nome = ?, ativo = ? WHERE id = ?').run(novoNome, novoAtivo, pessoa.id);

    if (novoAtivo !== pessoa.ativo) redistribuirFuturos();

    res.json(db.prepare('SELECT * FROM pessoas_escala WHERE id = ?').get(pessoa.id));
});

router.get('/sabados', (req, res) => {
    const proximos = Math.max(1, parseInt(req.query.proximos, 10) || 10);
    garantirHorizonte(proximos);

    const hoje = hojeISO();
    const passadas = db.prepare(`
        SELECT s.*, p.nome AS pessoa_nome FROM escala_sabados s
        JOIN pessoas_escala p ON p.id = s.pessoa_id
        WHERE s.data < ? ORDER BY s.data DESC LIMIT 2
    `).all(hoje).reverse();

    const futuras = db.prepare(`
        SELECT s.*, p.nome AS pessoa_nome FROM escala_sabados s
        JOIN pessoas_escala p ON p.id = s.pessoa_id
        WHERE s.data >= ? ORDER BY s.data ASC LIMIT ?
    `).all(hoje, proximos);

    res.json([...passadas, ...futuras]);
});

router.put('/sabados/:data', (req, res) => {
    const linha = db.prepare('SELECT * FROM escala_sabados WHERE data = ?').get(req.params.data);
    if (!linha) return res.status(404).json({ error: 'sábado não encontrado na escala' });

    const { pessoa_id, observacao } = req.body;
    const pessoa = db.prepare('SELECT * FROM pessoas_escala WHERE id = ?').get(pessoa_id);
    if (!pessoa) return res.status(400).json({ error: 'pessoa inválida' });

    db.prepare('UPDATE escala_sabados SET pessoa_id = ?, observacao = ?, manual = 1, folga = 0 WHERE id = ?')
        .run(pessoa.id, observacao && observacao.trim() ? observacao.trim() : null, linha.id);

    redistribuirFuturos();

    res.json(db.prepare(`
        SELECT s.*, p.nome AS pessoa_nome FROM escala_sabados s
        JOIN pessoas_escala p ON p.id = s.pessoa_id WHERE s.id = ?
    `).get(linha.id));
});

router.post('/sabados/trocar', (req, res) => {
    const { data_a, data_b } = req.body;
    if (!data_a || !data_b || data_a === data_b) return res.status(400).json({ error: 'informe duas datas diferentes' });

    const linhaA = db.prepare('SELECT * FROM escala_sabados WHERE data = ?').get(data_a);
    const linhaB = db.prepare('SELECT * FROM escala_sabados WHERE data = ?').get(data_b);
    if (!linhaA || !linhaB) return res.status(404).json({ error: 'uma das datas não está na escala' });

    const hoje = hojeISO();
    if (linhaA.data < hoje || linhaB.data < hoje) return res.status(400).json({ error: 'só é possível trocar sábados futuros' });
    if (linhaA.folga || linhaB.folga) return res.status(400).json({ error: 'não é possível trocar sábados marcados como folga' });

    db.prepare('UPDATE escala_sabados SET pessoa_id = ?, manual = 1 WHERE id = ?').run(linhaB.pessoa_id, linhaA.id);
    db.prepare('UPDATE escala_sabados SET pessoa_id = ?, manual = 1 WHERE id = ?').run(linhaA.pessoa_id, linhaB.id);

    redistribuirFuturos();

    res.json(db.prepare(`
        SELECT s.*, p.nome AS pessoa_nome FROM escala_sabados s
        JOIN pessoas_escala p ON p.id = s.pessoa_id WHERE s.id IN (?, ?)
        ORDER BY s.data
    `).all(linhaA.id, linhaB.id));
});

router.post('/sabados/pular', (req, res) => {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: 'data obrigatória' });

    const hoje = hojeISO();
    if (data < hoje) return res.status(400).json({ error: 'não é possível pular sábados passados' });

    const linha = db.prepare('SELECT * FROM escala_sabados WHERE data = ?').get(data);
    if (!linha) return res.status(404).json({ error: 'sábado não encontrado' });
    if (linha.folga) return res.status(400).json({ error: 'sábado já marcado como sem expediente' });

    db.prepare('UPDATE escala_sabados SET folga = 1, manual = 1 WHERE id = ?').run(linha.id);

    // Adiciona +1 sábado no horizonte para compensar a folga
    const total = db.prepare('SELECT COUNT(*) AS c FROM escala_sabados WHERE data >= ?').get(hoje).c;
    garantirHorizonte(total + 1);
    redistribuirFuturos();

    res.json({ ok: true });
});

router.post('/sabados/despular', (req, res) => {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: 'data obrigatória' });

    const hoje = hojeISO();
    if (data < hoje) return res.status(400).json({ error: 'não é possível alterar sábados passados' });

    const linha = db.prepare('SELECT * FROM escala_sabados WHERE data = ?').get(data);
    if (!linha) return res.status(404).json({ error: 'sábado não encontrado' });
    if (!linha.folga) return res.status(400).json({ error: 'sábado não está marcado como folga' });

    db.prepare('UPDATE escala_sabados SET folga = 0, manual = 0 WHERE id = ?').run(linha.id);
    redistribuirFuturos();

    res.json({ ok: true });
});

module.exports = router;
