const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

router.get('/', (req, res) => {
    res.json(db.prepare('SELECT id, nome, username, role, ativo, criado_em FROM usuarios ORDER BY nome').all());
});

router.post('/', async (req, res) => {
    const { nome, username, senha, role } = req.body || {};
    if (!nome || !username || !senha) return res.status(400).json({ error: 'Nome, usuário e senha são obrigatórios.' });
    if (db.prepare('SELECT id FROM usuarios WHERE username = ?').get(username.trim())) {
        return res.status(409).json({ error: 'Esse nome de usuário já existe.' });
    }
    const hash = await bcrypt.hash(senha, 12);
    const info = db.prepare('INSERT INTO usuarios (nome, username, senha_hash, role, ativo, criado_em) VALUES (?, ?, ?, ?, 1, ?)')
        .run(nome.trim(), username.trim(), hash, role === 'admin' ? 'admin' : 'user', new Date().toISOString());
    res.status(201).json(db.prepare('SELECT id, nome, username, role, ativo, criado_em FROM usuarios WHERE id = ?').get(info.lastInsertRowid));
});

router.patch('/:id/ativo', (req, res) => {
    const { ativo } = req.body || {};
    if (Number(req.params.id) === req.session.usuario.id) {
        return res.status(400).json({ error: 'Você não pode desativar sua própria conta.' });
    }
    db.prepare('UPDATE usuarios SET ativo = ? WHERE id = ?').run(ativo ? 1 : 0, req.params.id);
    res.json({ ok: true });
});

router.patch('/:id/senha', async (req, res) => {
    const { senha } = req.body || {};
    if (!senha || senha.length < 4) return res.status(400).json({ error: 'Senha deve ter ao menos 4 caracteres.' });
    const hash = await bcrypt.hash(senha, 12);
    db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(hash, req.params.id);
    res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
    if (Number(req.params.id) === req.session.usuario.id) {
        return res.status(400).json({ error: 'Você não pode excluir sua própria conta.' });
    }
    db.prepare('DELETE FROM usuarios WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

module.exports = router;
