const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
    const mes = Number(req.query.mes);
    const ano = Number(req.query.ano);
    if (!mes || !ano) return res.status(400).json({ error: 'mes e ano são obrigatórios' });

    const { contabilidade_id, busca, feito } = req.query;

    let sql = `SELECT c.id, c.nome, c.cnpj, c.responsavel, c.contato, c.obs,
                      ct.id AS contabilidade_id, ct.nome AS contabilidade_nome,
                      COALESCE(f.feito, 0) AS feito, f.marcado_em
               FROM clientes c
               LEFT JOIN contabilidades ct ON ct.id = c.contabilidade_id
               LEFT JOIN fechamentos_mensais f ON f.cliente_id = c.id AND f.mes = ? AND f.ano = ?
               WHERE c.ativo = 1`;
    const params = [mes, ano];

    if (contabilidade_id) { sql += ' AND c.contabilidade_id = ?'; params.push(contabilidade_id); }
    if (busca) { sql += ' AND (c.nome LIKE ? OR c.cnpj LIKE ?)'; params.push(`%${busca}%`, `%${busca}%`); }
    if (feito === '1' || feito === '0') { sql += ' AND COALESCE(f.feito, 0) = ?'; params.push(Number(feito)); }

    sql += ' ORDER BY c.nome';

    const linhas = db.prepare(sql).all(...params);

    const camposIds = linhas.map(l => l.id);
    let valoresPorCliente = {};
    if (camposIds.length) {
        const placeholders = camposIds.map(() => '?').join(',');
        const valores = db.prepare(
            `SELECT cliente_id, campo_id, valor FROM cliente_campo_valores WHERE cliente_id IN (${placeholders})`
        ).all(...camposIds);
        for (const v of valores) {
            if (!valoresPorCliente[v.cliente_id]) valoresPorCliente[v.cliente_id] = {};
            valoresPorCliente[v.cliente_id][v.campo_id] = v.valor;
        }
    }

    const resultado = linhas.map(l => ({ ...l, feito: Boolean(l.feito), valores: valoresPorCliente[l.id] || {} }));
    res.json(resultado);
});

router.put('/', (req, res) => {
    const { cliente_id, mes, ano, feito } = req.body;
    if (!cliente_id || !mes || !ano) return res.status(400).json({ error: 'cliente_id, mes e ano são obrigatórios' });

    const cliente = db.prepare('SELECT id FROM clientes WHERE id = ?').get(cliente_id);
    if (!cliente) return res.status(404).json({ error: 'cliente não encontrado' });

    const marcadoEm = new Date().toISOString();
    db.prepare(`INSERT INTO fechamentos_mensais (cliente_id, mes, ano, feito, marcado_em) VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(cliente_id, mes, ano) DO UPDATE SET feito = excluded.feito, marcado_em = excluded.marcado_em`)
        .run(cliente_id, mes, ano, feito ? 1 : 0, marcadoEm);

    res.json({ cliente_id, mes, ano, feito: Boolean(feito), marcado_em: marcadoEm });
});

module.exports = router;
