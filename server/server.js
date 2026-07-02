const path = require('path');
const http = require('http');
const express = require('express');
const session = require('express-session');
const expressWs = require('express-ws');

const db = require('./db');
const SQLiteStore = require('./session-store');
const { authHtml, requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// WebSocket precisa do servidor HTTP exposto antes dos routes
const server = http.createServer(app);
expressWs(app, server);

// ── Sessão ──
app.use(session({
    name: 'luxmenu.sid',
    secret: process.env.SESSION_SECRET || 'luxmenu-secret-interno-2025',
    resave: false,
    saveUninitialized: false,
    store: new SQLiteStore(),
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }, // 7 dias
}));

app.use(express.json());

// ── Protege páginas HTML (exceto /login.html) ──
app.use(authHtml);
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Rotas públicas ──
app.use('/api/auth', require('./routes/auth'));

// ── Rotas protegidas ──
app.use('/api/contabilidades', requireAuth, require('./routes/contabilidades'));
app.use('/api/clientes',       requireAuth, require('./routes/clientes'));
app.use('/api/campos',         requireAuth, require('./routes/campos'));
app.use('/api/fechamentos',    requireAuth, require('./routes/fechamentos'));
app.use('/api/cnpj',           requireAuth, require('./routes/cnpj'));
app.use('/api/videos',         requireAuth, require('./routes/videos'));
app.use('/api/categorias-video', requireAuth, require('./routes/categoriasVideo'));
app.use('/api/pastas',         requireAuth, require('./routes/pastas'));
app.use('/api/arquivos',       requireAuth, require('./routes/arquivos'));
app.use('/api/escala',         requireAuth, require('./routes/escala'));
app.use('/api/agenda',         requireAuth, require('./routes/agenda'));
app.use('/api/admin/usuarios', require('./routes/admin-usuarios'));
app.use('/api/chat',           require('./routes/chat'));

// ── WebSocket chat ──
require('./ws-chat').setup(app);

server.listen(PORT, '0.0.0.0', () => {
    console.log(`LuxMenu rodando em http://localhost:${PORT}`);
    console.log(`Dados em: ${db.dataDir}`);
});
