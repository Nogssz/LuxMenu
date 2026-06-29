const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
    res.json(db.prepare('SELECT * FROM categorias_video ORDER BY nome').all());
});

router.post('/', (req, res) => {
    const { nome } = req.body;
    if (!nome || !nome.trim()) return res.status(400).json({ error: 'nome é obrigatório' });

    const existente = db.prepare('SELECT * FROM categorias_video WHERE nome = ?').get(nome.trim());
    if (existente) return res.status(200).json(existente);

    const info = db.prepare('INSERT INTO categorias_video (nome) VALUES (?)').run(nome.trim());
    res.status(201).json(db.prepare('SELECT * FROM categorias_video WHERE id = ?').get(info.lastInsertRowid));
});

module.exports = router;
