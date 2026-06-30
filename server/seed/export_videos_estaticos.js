// Gera docs/videos/videos.json a partir do banco, pra publicar a página estática
// de vídeos no GitHub Pages. Rodar de novo (e dar commit/push) sempre que a lista mudar.
const fs = require('fs');
const path = require('path');
const db = require('../db');

const videos = db.prepare(`
    SELECT v.id, v.titulo, v.url, v.tags, v.descricao, c.nome AS categoria_nome
    FROM videos v
    LEFT JOIN categorias_video c ON c.id = v.categoria_id
    ORDER BY v.titulo
`).all();

const destino = path.join(__dirname, '..', '..', 'docs', 'videos', 'videos.json');
fs.writeFileSync(destino, JSON.stringify(videos, null, 2), 'utf8');
console.log(`Exportados ${videos.length} vídeos para ${destino}`);
