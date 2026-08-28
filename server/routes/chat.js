const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const ARQ_DIR = path.join(db.dataDir, 'chat-arquivos');
if (!fs.existsSync(ARQ_DIR)) fs.mkdirSync(ARQ_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, ARQ_DIR),
    filename: (req, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname)),
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } }); // 20 MB

router.get('/historico', (req, res) => {
    const msgs = db.prepare(`
        SELECT m.id, m.texto, m.enviado_em, m.arquivo_nome, m.arquivo_url, m.arquivo_tipo, m.arquivo_tam,
               m.reply_to_id, m.reply_to_nome, m.reply_to_texto,
               u.nome, u.username
        FROM mensagens m
        JOIN usuarios u ON u.id = m.usuario_id
        ORDER BY m.id DESC LIMIT 100
    `).all().reverse();
    res.json(msgs);
});

router.post('/arquivo', upload.single('arquivo'), (req, res) => {
    const { broadcast } = require('../ws-chat');
    const usuario = req.session.usuario;
    if (!req.file) return res.status(400).json({ error: 'nenhum arquivo enviado' });

    const texto        = (req.body.texto || '').trim().slice(0, 500);
    const arqNome      = req.file.originalname;
    const arqUrl       = `/api/chat/arquivo/${req.file.filename}`;
    const arqTipo      = req.file.mimetype;
    const arqTam       = req.file.size;
    const enviado_em   = new Date().toISOString();
    const replyToId    = req.body.reply_to_id    ? Number(req.body.reply_to_id)            : null;
    const replyToNome  = req.body.reply_to_nome  ? String(req.body.reply_to_nome).slice(0, 100)  : null;
    const replyToTexto = req.body.reply_to_texto ? String(req.body.reply_to_texto).slice(0, 300) : null;

    db.prepare(`INSERT INTO mensagens (usuario_id, texto, enviado_em, arquivo_nome, arquivo_url, arquivo_tipo, arquivo_tam, reply_to_id, reply_to_nome, reply_to_texto)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(usuario.id, texto, enviado_em, arqNome, arqUrl, arqTipo, arqTam, replyToId, replyToNome, replyToTexto);

    const msg = { tipo: 'mensagem', nome: usuario.nome, username: usuario.username,
                  texto, enviado_em, arquivo_nome: arqNome, arquivo_url: arqUrl,
                  arquivo_tipo: arqTipo, arquivo_tam: arqTam,
                  reply_to_id: replyToId, reply_to_nome: replyToNome, reply_to_texto: replyToTexto };
    broadcast(msg);
    res.json({ ok: true });
});

router.delete('/mensagens/:id', (req, res) => {
    const { broadcast } = require('../ws-chat');
    const id = Number(req.params.id);
    const msg = db.prepare('SELECT usuario_id FROM mensagens WHERE id = ?').get(id);
    if (!msg) return res.status(404).json({ error: 'mensagem não encontrada' });
    if (msg.usuario_id !== req.session.usuario.id) return res.status(403).json({ error: 'não autorizado' });
    db.prepare('DELETE FROM mensagens WHERE id = ?').run(id);
    broadcast({ tipo: 'deletar', id });
    res.json({ ok: true });
});

router.get('/arquivo/:nome', (req, res) => {
    const nome = path.basename(req.params.nome);
    const arq  = path.join(ARQ_DIR, nome);
    if (!fs.existsSync(arq)) return res.status(404).end();
    res.sendFile(arq);
});

module.exports = router;
