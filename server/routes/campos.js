const express = require('express');
const db = require('../db');

const router = express.Router();

function withOpcoes(campo) {
    if (campo.tipo !== 'selecao') return campo;
    const opcoes = db.prepare('SELECT id, valor FROM campo_opcoes WHERE campo_id = ? ORDER BY id').all(campo.id);
    return { ...campo, opcoes };
}

router.get('/', (req, res) => {
    const campos = db.prepare('SELECT * FROM campos_customizados ORDER BY ordem, id').all();
    res.json(campos.map(withOpcoes));
});

router.post('/', (req, res) => {
    const { nome, tipo, opcoes } = req.body;
    if (!nome || !nome.trim()) return res.status(400).json({ error: 'nome é obrigatório' });
    if (!['texto', 'checkbox', 'selecao'].includes(tipo)) return res.status(400).json({ error: 'tipo inválido' });
    if (tipo === 'selecao' && (!Array.isArray(opcoes) || opcoes.filter(o => o && o.trim()).length === 0)) {
        return res.status(400).json({ error: 'campos de seleção precisam de ao menos uma opção' });
    }

    const maxOrdem = db.prepare('SELECT COALESCE(MAX(ordem), 0) AS m FROM campos_customizados').get().m;
    const info = db.prepare('INSERT INTO campos_customizados (nome, tipo, ordem) VALUES (?, ?, ?)')
        .run(nome.trim(), tipo, maxOrdem + 1);

    if (tipo === 'selecao') {
        const insertOpcao = db.prepare('INSERT INTO campo_opcoes (campo_id, valor) VALUES (?, ?)');
        for (const valor of opcoes) {
            if (valor && valor.trim()) insertOpcao.run(info.lastInsertRowid, valor.trim());
        }
    }

    const campo = db.prepare('SELECT * FROM campos_customizados WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(withOpcoes(campo));
});

module.exports = router;
