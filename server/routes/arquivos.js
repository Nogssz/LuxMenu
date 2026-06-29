const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const db = require('../db');

const router = express.Router();
const ARQUIVOS_DIR = path.join(__dirname, '..', '..', 'data', 'arquivos');
if (!fs.existsSync(ARQUIVOS_DIR)) fs.mkdirSync(ARQUIVOS_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, ARQUIVOS_DIR),
    filename: (req, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname)),
});

const upload = multer({ storage, limits: { fileSize: 1024 * 1024 * 1024 } }); // 1GB por arquivo

router.get('/pasta/:pastaId', (req, res) => {
    const arquivos = db.prepare('SELECT * FROM arquivos WHERE pasta_id = ? ORDER BY criado_em DESC').all(req.params.pastaId);
    res.json(arquivos);
});

router.post('/pasta/:pastaId', (req, res) => {
    const pasta = db.prepare('SELECT * FROM pastas WHERE id = ?').get(req.params.pastaId);
    if (!pasta) return res.status(404).json({ error: 'pasta não encontrada' });

    upload.single('arquivo')(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.message });
        if (!req.file) return res.status(400).json({ error: 'nenhum arquivo enviado' });

        const info = db.prepare(`INSERT INTO arquivos (pasta_id, nome_original, nome_disco, tamanho, criado_em)
                                  VALUES (?, ?, ?, ?, ?)`)
            .run(pasta.id, req.file.originalname, req.file.filename, req.file.size, new Date().toISOString());

        res.status(201).json(db.prepare('SELECT * FROM arquivos WHERE id = ?').get(info.lastInsertRowid));
    });
});

router.get('/:id/download', (req, res) => {
    const arquivo = db.prepare('SELECT * FROM arquivos WHERE id = ?').get(req.params.id);
    if (!arquivo) return res.status(404).json({ error: 'arquivo não encontrado' });

    const caminho = path.join(ARQUIVOS_DIR, arquivo.nome_disco);
    if (!fs.existsSync(caminho)) return res.status(404).json({ error: 'arquivo não encontrado no disco' });

    res.download(caminho, arquivo.nome_original);
});

router.delete('/:id', (req, res) => {
    const arquivo = db.prepare('SELECT * FROM arquivos WHERE id = ?').get(req.params.id);
    if (!arquivo) return res.status(404).json({ error: 'arquivo não encontrado' });

    fs.rm(path.join(ARQUIVOS_DIR, arquivo.nome_disco), { force: true }, () => {});
    db.prepare('DELETE FROM arquivos WHERE id = ?').run(req.params.id);
    res.status(204).end();
});

module.exports = router;
