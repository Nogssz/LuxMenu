// Rotas públicas que não precisam de login
const PUBLICAS = new Set(['/login.html', '/login.js', '/login.css']);

function authHtml(req, res, next) {
    if (PUBLICAS.has(req.path)) return next();
    if (req.path.endsWith('.html') || req.path === '/') {
        if (!req.session?.usuario) return res.redirect('/login.html');
    }
    next();
}

function requireAuth(req, res, next) {
    if (!req.session?.usuario) return res.status(401).json({ error: 'não autenticado' });
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session?.usuario) return res.status(401).json({ error: 'não autenticado' });
    if (req.session.usuario.role !== 'admin') return res.status(403).json({ error: 'acesso restrito a administradores' });
    next();
}

module.exports = { authHtml, requireAuth, requireAdmin };
