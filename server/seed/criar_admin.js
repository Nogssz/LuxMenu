// Cria o primeiro usuário administrador.
// Uso: node server/seed/criar_admin.js <nome> <username> <senha>
// Exemplo: node server/seed/criar_admin.js "Gabriel Nogueira" nogssz minhasenha123
const bcrypt = require('bcryptjs');
const db = require('../db');

const [,, nome, username, senha] = process.argv;
if (!nome || !username || !senha) {
    console.error('Uso: node server/seed/criar_admin.js <nome> <username> <senha>');
    process.exit(1);
}

if (db.prepare('SELECT id FROM usuarios WHERE username = ?').get(username)) {
    console.error(`Usuário "${username}" já existe.`);
    process.exit(1);
}

const hash = bcrypt.hashSync(senha, 12);
db.prepare('INSERT INTO usuarios (nome, username, senha_hash, role, ativo, criado_em) VALUES (?, ?, ?, ?, 1, ?)')
    .run(nome, username, hash, 'admin', new Date().toISOString());

console.log(`Admin criado: ${nome} (${username})`);
