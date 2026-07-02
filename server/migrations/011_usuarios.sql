CREATE TABLE IF NOT EXISTS usuarios (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    nome       TEXT NOT NULL,
    username   TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    role       TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin','user')),
    ativo      INTEGER NOT NULL DEFAULT 1,
    criado_em  TEXT NOT NULL
);
