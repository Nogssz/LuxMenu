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
            if (!msg.texto?.trim()) return;

            const texto = String(msg.texto).slice(0, 1000).trim();
            const enviado_em = new Date().toISOString();

            const { lastInsertRowid } = db.prepare('INSERT INTO mensagens (usuario_id, texto, enviado_em) VALUES (?, ?, ?)')
                .run(usuario.id, texto, enviado_em);

            broadcast({
                tipo: 'mensagem',
                id: lastInsertRowid,
                nome: usuario.nome,
                username: usuario.username,
                texto,
                enviado_em,
            });
        });

        ws.on('close', () => {
            online.delete(usuario.id);
            broadcast({ tipo: 'online', usuarios: listaOnline() });
        });
    });
}

module.exports = { setup, broadcast };
