const express = require('express');
const db = require('../db');

const router = express.Router();

function buildFtsQuery(termo) {
    // Transforma cada palavra em prefixo (ex: "nota comp" → "nota* comp*")
    // pra funcionar durante a digitação, e remove caracteres especiais do FTS5.
    return termo.trim()
        .split(/\s+/)
        .map(w => w.replace(/["'*:^()]/g, '').trim())
        .filter(Boolean)
        .map(w => w + '*')
        .join(' ');
}

router.get('/', (req, res) => {
    const { busca, categoria_id } = req.query;

    if (busca && busca.trim()) {
        const ftsQuery = buildFtsQuery(busca);
        try {
            let sql = `SELECT v.*, c.nome AS categoria_nome
                       FROM videos_fts fts
                       JOIN videos v ON v.id = fts.rowid
                       LEFT JOIN categorias_video c ON c.id = v.categoria_id
                       WHERE videos_fts MATCH ?`;
            const params = [ftsQuery];
            if (categoria_id) { sql += ' AND v.categoria_id = ?'; params.push(categoria_id); }
            sql += ' ORDER BY rank';
            return res.json(db.prepare(sql).all(...params));
        } catch {
            // fallback pra LIKE se a query FTS for inválida
        }
    }

    let sql = `SELECT v.*, c.nome AS categoria_nome FROM videos v
               LEFT JOIN categorias_video c ON c.id = v.categoria_id`;
    const params = [];
    if (categoria_id) { sql += ' WHERE v.categoria_id = ?'; params.push(categoria_id); }
    sql += ' ORDER BY v.titulo';
    res.json(db.prepare(sql).all(...params));
});

router.post('/', (req, res) => {
    const { titulo, url, tags, descricao, categoria_id } = req.body;
    if (!titulo || !titulo.trim()) return res.status(400).json({ error: 'título é obrigatório' });
    if (!url || !url.trim()) return res.status(400).json({ error: 'link é obrigatório' });

    const info = db.prepare(`INSERT INTO videos (titulo, url, tags, descricao, categoria_id, criado_em) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(titulo.trim(), url.trim(), (tags || '').trim() || null, (descricao || '').trim() || null, categoria_id || null, new Date().toISOString());

    res.status(201).json(db.prepare('SELECT * FROM videos WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/:id', (req, res) => {
    const existente = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
    if (!existente) return res.status(404).json({ error: 'vídeo não encontrado' });

    const { titulo, url, tags, descricao, categoria_id } = req.body;
    db.prepare('UPDATE videos SET titulo = ?, url = ?, tags = ?, descricao = ?, categoria_id = ? WHERE id = ?').run(
        titulo?.trim() || existente.titulo,
        url?.trim() || existente.url,
        tags !== undefined ? (tags.trim() || null) : existente.tags,
        descricao !== undefined ? (descricao.trim() || null) : existente.descricao,
        categoria_id !== undefined ? (categoria_id || null) : existente.categoria_id,
        req.params.id
    );

    res.json(db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
    const info = db.prepare('DELETE FROM videos WHERE id = ?').run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'vídeo não encontrado' });
    res.status(204).end();
});

module.exports = router;
