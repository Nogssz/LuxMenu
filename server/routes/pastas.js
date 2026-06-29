const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');

const router = express.Router();
const ARQUIVOS_DIR = path.join(__dirname, '..', '..', 'data', 'arquivos');

router.get('/', (req, res) => {
    const pastas = db.prepare(`SELECT p.*, COUNT(a.id) AS total_arquivos
                                FROM pastas p LEFT JOIN arquivos a ON a.pasta_id = p.id
                                GROUP BY p.id ORDER BY p.nome`).all();
    res.json(pastas);
});

router.post('/', (req, res) => {
    const { nome } = req.body;
    if (!nome || !nome.trim()) return res.status(400).json({ error: 'nome da pasta é obrigatório' });

    const existente = db.prepare('SELECT * FROM pastas WHERE nome = ?').get(nome.trim());
    if (existente) return res.status(409).json({ error: 'já existe uma pasta com esse nome' });

    const info = db.prepare('INSERT INTO pastas (nome, criado_em) VALUES (?, ?)').run(nome.trim(), new Date().toISOString());
    res.status(201).json(db.prepare('SELECT * FROM pastas WHERE id = ?').get(info.lastInsertRowid));
});

router.delete('/:id', (req, res) => {
    const pasta = db.prepare('SELECT * FROM pastas WHERE id = ?').get(req.params.id);
    if (!pasta) return res.status(404).json({ error: 'pasta não encontrada' });

    const arquivos = db.prepare('SELECT nome_disco FROM arquivos WHERE pasta_id = ?').all(req.params.id);
    for (const a of arquivos) {
        const caminho = path.join(ARQUIVOS_DIR, a.nome_disco);
        fs.rm(caminho, { force: true }, () => {});
    }

    db.prepare('DELETE FROM pastas WHERE id = ?').run(req.params.id);
    res.status(204).end();
});

module.exports = router;
