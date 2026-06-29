const express = require('express');
const db = require('../db');

const router = express.Router();

function pessoaValida(pessoa_id) {
    if (pessoa_id === undefined || pessoa_id === null || pessoa_id === '') return true;
    return !!db.prepare('SELECT id FROM pessoas_escala WHERE id = ?').get(pessoa_id);
}

// --- Compromissos ---

router.get('/compromissos', (req, res) => {
    const { inicio, fim } = req.query;
    let sql = `
        SELECT c.*, p.nome AS pessoa_nome FROM agenda_compromissos c
        LEFT JOIN pessoas_escala p ON p.id = c.pessoa_id
    `;
    const params = [];
    const condicoes = [];
    if (inicio) { condicoes.push('c.data >= ?'); params.push(inicio); }
    if (fim) { condicoes.push('c.data <= ?'); params.push(fim); }
    if (condicoes.length) sql += ' WHERE ' + condicoes.join(' AND ');
    sql += ' ORDER BY c.data ASC, c.hora_inicio ASC';
    res.json(db.prepare(sql).all(...params));
});

router.post('/compromissos', (req, res) => {
    const { titulo, descricao, data, hora_inicio, hora_fim, pessoa_id } = req.body;
    if (!titulo || !titulo.trim()) return res.status(400).json({ error: 'título é obrigatório' });
    if (!data || !hora_inicio || !hora_fim) return res.status(400).json({ error: 'data, hora_inicio e hora_fim são obrigatórios' });
    if (hora_fim <= hora_inicio) return res.status(400).json({ error: 'hora_fim precisa ser depois de hora_inicio' });
    if (!pessoaValida(pessoa_id)) return res.status(400).json({ error: 'pessoa inválida' });

    const info = db.prepare(`
        INSERT INTO agenda_compromissos (titulo, descricao, data, hora_inicio, hora_fim, pessoa_id, criado_em)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(titulo.trim(), descricao && descricao.trim() ? descricao.trim() : null, data, hora_inicio, hora_fim, pessoa_id || null, new Date().toISOString());

    res.status(201).json(db.prepare(`
        SELECT c.*, p.nome AS pessoa_nome FROM agenda_compromissos c
        LEFT JOIN pessoas_escala p ON p.id = c.pessoa_id WHERE c.id = ?
    `).get(info.lastInsertRowid));
});

router.put('/compromissos/:id', (req, res) => {
    const atual = db.prepare('SELECT * FROM agenda_compromissos WHERE id = ?').get(req.params.id);
    if (!atual) return res.status(404).json({ error: 'compromisso não encontrado' });

    const titulo = req.body.titulo !== undefined ? req.body.titulo.trim() : atual.titulo;
    const descricao = req.body.descricao !== undefined ? (req.body.descricao.trim() || null) : atual.descricao;
    const data = req.body.data !== undefined ? req.body.data : atual.data;
    const hora_inicio = req.body.hora_inicio !== undefined ? req.body.hora_inicio : atual.hora_inicio;
    const hora_fim = req.body.hora_fim !== undefined ? req.body.hora_fim : atual.hora_fim;
    const pessoa_id = req.body.pessoa_id !== undefined ? (req.body.pessoa_id || null) : atual.pessoa_id;

    if (!titulo) return res.status(400).json({ error: 'título é obrigatório' });
    if (hora_fim <= hora_inicio) return res.status(400).json({ error: 'hora_fim precisa ser depois de hora_inicio' });
    if (!pessoaValida(pessoa_id)) return res.status(400).json({ error: 'pessoa inválida' });

    db.prepare(`
        UPDATE agenda_compromissos SET titulo = ?, descricao = ?, data = ?, hora_inicio = ?, hora_fim = ?, pessoa_id = ?
        WHERE id = ?
    `).run(titulo, descricao, data, hora_inicio, hora_fim, pessoa_id, atual.id);

    res.json(db.prepare(`
        SELECT c.*, p.nome AS pessoa_nome FROM agenda_compromissos c
        LEFT JOIN pessoas_escala p ON p.id = c.pessoa_id WHERE c.id = ?
    `).get(atual.id));
});

router.delete('/compromissos/:id', (req, res) => {
    const info = db.prepare('DELETE FROM agenda_compromissos WHERE id = ?').run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'compromisso não encontrado' });
    res.status(204).end();
});

// --- Tarefas ---

router.get('/tarefas', (req, res) => {
    const tarefas = db.prepare(`
        SELECT t.*, p.nome AS pessoa_nome FROM agenda_tarefas t
        LEFT JOIN pessoas_escala p ON p.id = t.pessoa_id
        ORDER BY (t.data IS NULL), t.data ASC, t.criado_em ASC
    `).all();
    res.json(tarefas);
});

router.post('/tarefas', (req, res) => {
    const { titulo, descricao, data, hora, pessoa_id } = req.body;
    if (!titulo || !titulo.trim()) return res.status(400).json({ error: 'título é obrigatório' });
    if (!pessoaValida(pessoa_id)) return res.status(400).json({ error: 'pessoa inválida' });

    const info = db.prepare(`
        INSERT INTO agenda_tarefas (titulo, descricao, data, hora, pessoa_id, feito, criado_em)
        VALUES (?, ?, ?, ?, ?, 0, ?)
    `).run(titulo.trim(), descricao && descricao.trim() ? descricao.trim() : null, data || null, hora || null, pessoa_id || null, new Date().toISOString());

    res.status(201).json(db.prepare(`
        SELECT t.*, p.nome AS pessoa_nome FROM agenda_tarefas t
        LEFT JOIN pessoas_escala p ON p.id = t.pessoa_id WHERE t.id = ?
    `).get(info.lastInsertRowid));
});

router.put('/tarefas/:id', (req, res) => {
    const atual = db.prepare('SELECT * FROM agenda_tarefas WHERE id = ?').get(req.params.id);
    if (!atual) return res.status(404).json({ error: 'tarefa não encontrada' });

    const titulo = req.body.titulo !== undefined ? req.body.titulo.trim() : atual.titulo;
    const descricao = req.body.descricao !== undefined ? (req.body.descricao.trim() || null) : atual.descricao;
    const data = req.body.data !== undefined ? (req.body.data || null) : atual.data;
    const hora = req.body.hora !== undefined ? (req.body.hora || null) : atual.hora;
    const pessoa_id = req.body.pessoa_id !== undefined ? (req.body.pessoa_id || null) : atual.pessoa_id;
    const feito = req.body.feito !== undefined ? (req.body.feito ? 1 : 0) : atual.feito;

    if (!titulo) return res.status(400).json({ error: 'título é obrigatório' });
    if (!pessoaValida(pessoa_id)) return res.status(400).json({ error: 'pessoa inválida' });

    db.prepare(`
        UPDATE agenda_tarefas SET titulo = ?, descricao = ?, data = ?, hora = ?, pessoa_id = ?, feito = ?
        WHERE id = ?
    `).run(titulo, descricao, data, hora, pessoa_id, feito, atual.id);

    res.json(db.prepare(`
        SELECT t.*, p.nome AS pessoa_nome FROM agenda_tarefas t
        LEFT JOIN pessoas_escala p ON p.id = t.pessoa_id WHERE t.id = ?
    `).get(atual.id));
});

router.delete('/tarefas/:id', (req, res) => {
    const info = db.prepare('DELETE FROM agenda_tarefas WHERE id = ?').run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'tarefa não encontrada' });
    res.status(204).end();
});

module.exports = router;
