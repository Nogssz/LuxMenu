const express = require('express');
const db = require('../db');

const router = express.Router();

function withValores(cliente) {
    const linhas = db.prepare('SELECT campo_id, valor FROM cliente_campo_valores WHERE cliente_id = ?').all(cliente.id);
    const valores = {};
    for (const l of linhas) valores[l.campo_id] = l.valor;
    return { ...cliente, valores };
}

router.get('/', (req, res) => {
    const { contabilidade_id, busca } = req.query;
    let sql = `SELECT c.*, ct.nome AS contabilidade_nome, ct.email AS contabilidade_email
               FROM clientes c LEFT JOIN contabilidades ct ON ct.id = c.contabilidade_id
               WHERE c.ativo = 1`;
    const params = [];
    if (contabilidade_id) { sql += ' AND c.contabilidade_id = ?'; params.push(contabilidade_id); }
    if (busca) { sql += ' AND (c.nome LIKE ? OR c.cnpj LIKE ?)'; params.push(`%${busca}%`, `%${busca}%`); }
    sql += ' ORDER BY c.nome';

    const clientes = db.prepare(sql).all(...params);
    res.json(clientes.map(withValores));
});

router.post('/', (req, res) => {
    const { nome, cnpj, responsavel, contato, obs, contabilidade_id } = req.body;
    if (!nome || !nome.trim()) return res.status(400).json({ error: 'nome é obrigatório' });

    const info = db.prepare(`INSERT INTO clientes (nome, cnpj, responsavel, contato, obs, contabilidade_id)
                              VALUES (?, ?, ?, ?, ?, ?)`)
        .run(nome.trim(), cnpj || null, responsavel || null, contato || null, obs || null, contabilidade_id || null);

    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(withValores(cliente));
});

router.put('/:id', (req, res) => {
    const { nome, cnpj, responsavel, contato, obs, contabilidade_id } = req.body;
    const existente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
    if (!existente) return res.status(404).json({ error: 'cliente não encontrado' });

    db.prepare(`UPDATE clientes SET nome = ?, cnpj = ?, responsavel = ?, contato = ?, obs = ?, contabilidade_id = ?
                WHERE id = ?`)
        .run(
            nome ?? existente.nome,
            cnpj ?? existente.cnpj,
            responsavel ?? existente.responsavel,
            contato ?? existente.contato,
            obs ?? existente.obs,
            contabilidade_id ?? existente.contabilidade_id,
            req.params.id
        );

    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
    res.json(withValores(cliente));
});

router.put('/:id/campos/:campoId', (req, res) => {
    const { valor } = req.body;
    const cliente = db.prepare('SELECT id FROM clientes WHERE id = ?').get(req.params.id);
    if (!cliente) return res.status(404).json({ error: 'cliente não encontrado' });
    const campo = db.prepare('SELECT id FROM campos_customizados WHERE id = ?').get(req.params.campoId);
    if (!campo) return res.status(404).json({ error: 'campo não encontrado' });

    db.prepare(`INSERT INTO cliente_campo_valores (cliente_id, campo_id, valor) VALUES (?, ?, ?)
                ON CONFLICT(cliente_id, campo_id) DO UPDATE SET valor = excluded.valor`)
        .run(req.params.id, req.params.campoId, valor ?? null);

    res.json({ cliente_id: Number(req.params.id), campo_id: Number(req.params.campoId), valor: valor ?? null });
});

module.exports = router;
