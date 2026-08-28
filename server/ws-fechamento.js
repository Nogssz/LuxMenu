const conectados = new Map(); // usuarioId → ws

function broadcast(dados) {
    const json = JSON.stringify(dados);
    for (const ws of conectados.values()) {
        if (ws.readyState === ws.OPEN) ws.send(json);
    }
}

function setup(app) {
    app.ws('/fechamento/ws', (ws, req) => {
        const usuario = req.session?.usuario;
        if (!usuario) { ws.close(1008, 'não autenticado'); return; }

        conectados.set(usuario.id, ws);
        ws.on('close', () => conectados.delete(usuario.id));
    });
}

module.exports = { setup, broadcast };
