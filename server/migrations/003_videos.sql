CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    url TEXT NOT NULL,
    tags TEXT,
    descricao TEXT,
    criado_em TEXT NOT NULL
);
