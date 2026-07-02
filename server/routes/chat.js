const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/historico', (req, res) => {
    const msgs = db.prepare(`
        SELECT m.id, m.texto, m.enviado_em, u.nome, u.username
        FROM mensagens m
        JOIN usuarios u ON u.id = m.usuario_id
        ORDER BY m.id DESC LIMIT 100
    `).all().reverse();
    res.json(msgs);
});

module.exports = router;
