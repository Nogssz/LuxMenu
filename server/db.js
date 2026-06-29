const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'luxmenu.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`CREATE TABLE IF NOT EXISTS _migrations (nome TEXT PRIMARY KEY, aplicada_em TEXT NOT NULL)`);
const aplicadas = new Set(db.prepare('SELECT nome FROM _migrations').all().map(r => r.nome));

const migrationsDir = path.join(__dirname, 'migrations');
const arquivos = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
const registrarMigracao = db.prepare('INSERT INTO _migrations (nome, aplicada_em) VALUES (?, ?)');
for (const arquivo of arquivos) {
    if (aplicadas.has(arquivo)) continue;
    db.exec(fs.readFileSync(path.join(migrationsDir, arquivo), 'utf8'));
    registrarMigracao.run(arquivo, new Date().toISOString());
}

module.exports = db;
