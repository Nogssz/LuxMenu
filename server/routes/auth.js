const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');

const router = express.Router();

router.post('/login', async (req, res) => {
    const { username, senha } = req.body || {};
    if (!username || !senha) return res.status(400).json({ error: 'Informe usuário e senha.' });

    const usuario = db.prepare('SELECT * FROM usuarios WHERE username = ? AND ativo = 1').get(username.trim());
    if (!usuario) return res.status(401).json({ error: 'Usuário ou senha incorretos.' });

    const ok = await bcrypt.compare(senha, usuario.senha_hash);
    if (!ok) return res.status(401).json({ error: 'Usuário ou senha incorretos.' });

    req.session.usuario = { id: usuario.id, nome: usuario.nome, username: usuario.username, role: usuario.role };
    res.json({ ok: true, usuario: req.session.usuario });
});

router.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('luxmenu.sid');
        res.json({ ok: true });
    });
});

router.get('/me', (req, res) => {
    if (!req.session?.usuario) return res.status(401).json({ error: 'não autenticado' });
    res.json(req.session.usuario);
});

module.exports = router;
