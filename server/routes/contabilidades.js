const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
    const rows = db.prepare('SELECT * FROM contabilidades ORDER BY nome').all();
    res.json(rows);
});

router.post('/', (req, res) => {
    const { nome, email } = req.body;
    if (!nome || !nome.trim()) return res.status(400).json({ error: 'nome é obrigatório' });

    const info = db.prepare('INSERT INTO contabilidades (nome, email) VALUES (?, ?)').run(nome.trim(), email || null);
    const row = db.prepare('SELECT * FROM contabilidades WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(row);
});

module.exports = router;
