const db = require('./db');

// Mapa de conexões ativas: usuarioId → { ws, nome, username }
const online = new Map();

function broadcast(dados) {
    const json = JSON.stringify(dados);
    for (const { ws } of online.values()) {
        if (ws.readyState === ws.OPEN) ws.send(json);
    }
}


function listaOnline() {
    return [...online.values()].map(u => ({ id: u.id, nome: u.nome, username: u.username }));
}

function setup(app) {
    app.ws('/chat/ws', (ws, req) => {
        const usuario = req.session?.usuario;
        if (!usuario) { ws.close(1008, 'não autenticado'); return; }

        online.set(usuario.id, { ws, id: usuario.id, nome: usuario.nome, username: usuario.username });
        broadcast({ tipo: 'online', usuarios: listaOnline() });

        ws.on('message', (raw) => {
            let msg;
            try { msg = JSON.parse(raw); } catch { return; }

            if (msg.tipo === 'digitando') {
                const json = JSON.stringify({ tipo: 'digitando', nome: usuario.nome, username: usuario.username });
                for (const [uid, conn] of online.entries()) {
                    if (uid !== usuario.id && conn.ws.readyState === conn.ws.OPEN) conn.ws.send(json);
                }
                return;
            }

            if (!msg.texto?.trim()) return;

            const texto        = String(msg.texto).slice(0, 1000).trim();
            const enviado_em   = new Date().toISOString();
            const replyToId    = msg.reply_to_id != null ? (parseInt(msg.reply_to_id) || null) : null;
            const replyToNome  = typeof msg.reply_to_nome  === 'string' ? msg.reply_to_nome.slice(0, 100)       : null;
            const replyToTexto = typeof msg.reply_to_texto === 'string' ? msg.reply_to_texto.slice(0, 300)      : null;

            const { lastInsertRowid } = db.prepare(
                'INSERT INTO mensagens (usuario_id, texto, enviado_em, reply_to_id, reply_to_nome, reply_to_texto) VALUES (?, ?, ?, ?, ?, ?)'
            ).run(usuario.id, texto, enviado_em, replyToId, replyToNome, replyToTexto);

            broadcast({
                tipo: 'mensagem',
                id: lastInsertRowid,
                nome: usuario.nome,
                username: usuario.username,
                texto,
                enviado_em,
                reply_to_id:    replyToId,
                reply_to_nome:  replyToNome,
                reply_to_texto: replyToTexto,
            });
        });

        ws.on('close', () => {
            online.delete(usuario.id);
            broadcast({ tipo: 'online', usuarios: listaOnline() });
        });
    });
}

module.exports = { setup, broadcast };
