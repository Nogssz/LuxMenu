const session = require('express-session');
const db = require('./db');

class SQLiteStore extends session.Store {
    get(sid, cb) {
        try {
            const row = db.prepare('SELECT dados FROM sessoes WHERE sid = ? AND expira_em > ?').get(sid, Date.now());
            cb(null, row ? JSON.parse(row.dados) : null);
        } catch (e) { cb(e); }
    }

    set(sid, sess, cb) {
        try {
            const expira = sess.cookie?.expires
                ? new Date(sess.cookie.expires).getTime()
                : Date.now() + 7 * 24 * 60 * 60 * 1000;
            db.prepare(`INSERT INTO sessoes (sid, dados, expira_em) VALUES (?, ?, ?)
                        ON CONFLICT(sid) DO UPDATE SET dados = excluded.dados, expira_em = excluded.expira_em`)
                .run(sid, JSON.stringify(sess), expira);
            cb(null);
        } catch (e) { cb(e); }
    }

    destroy(sid, cb) {
        try {
            db.prepare('DELETE FROM sessoes WHERE sid = ?').run(sid);
            cb(null);
        } catch (e) { cb(e); }
    }

    touch(sid, sess, cb) { this.set(sid, sess, cb); }
}

// Limpa sessões expiradas na inicialização
db.prepare('DELETE FROM sessoes WHERE expira_em <= ?').run(Date.now());

module.exports = SQLiteStore;
