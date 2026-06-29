const express = require('express');
const db = require('../db');

const router = express.Router();

function limparCnpj(valor) {
    return String(valor || '').replace(/\D/g, '');
}

router.get('/:cnpj', async (req, res) => {
    const cnpj = limparCnpj(req.params.cnpj);
    if (cnpj.length !== 14) return res.status(400).json({ error: 'CNPJ inválido — informe os 14 dígitos.' });

    const forcar = req.query.forcar === '1';

    if (!forcar) {
        const cache = db.prepare('SELECT dados, consultado_em FROM cache_cnpj WHERE cnpj = ?').get(cnpj);
        if (cache) {
            return res.json({ ...JSON.parse(cache.dados), _cache: true, _consultado_em: cache.consultado_em });
        }
    }

    let resposta;
    try {
        resposta = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`);
    } catch (err) {
        return res.status(502).json({ error: 'Não foi possível contatar o serviço de consulta de CNPJ.' });
    }

    if (resposta.status === 404) return res.status(404).json({ error: 'CNPJ não encontrado.' });
    if (resposta.status === 400) return res.status(400).json({ error: 'CNPJ inválido.' });
    if (resposta.status === 429) {
        return res.status(429).json({ error: 'Limite de consultas atingido (3 por minuto, compartilhado entre toda a equipe). Aguarde um minuto e tente de novo.' });
    }
    if (!resposta.ok) return res.status(502).json({ error: 'Serviço de consulta de CNPJ indisponível, tente novamente.' });

    const dados = await resposta.json();
    const consultadoEm = new Date().toISOString();

    db.prepare(`INSERT INTO cache_cnpj (cnpj, dados, consultado_em) VALUES (?, ?, ?)
                ON CONFLICT(cnpj) DO UPDATE SET dados = excluded.dados, consultado_em = excluded.consultado_em`)
        .run(cnpj, JSON.stringify(dados), consultadoEm);

    res.json({ ...dados, _cache: false, _consultado_em: consultadoEm });
});

module.exports = router;
