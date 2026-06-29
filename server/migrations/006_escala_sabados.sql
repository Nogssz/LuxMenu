CREATE TABLE IF NOT EXISTS pessoas_escala (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    ordem INTEGER NOT NULL,
    ativo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS escala_sabados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT UNIQUE NOT NULL,
    pessoa_id INTEGER NOT NULL REFERENCES pessoas_escala(id),
    observacao TEXT,
    manual INTEGER NOT NULL DEFAULT 0,
    criado_em TEXT NOT NULL
);

INSERT INTO pessoas_escala (nome, ordem, ativo) VALUES
    ('Luquinhas', 1, 1),
    ('Nogs', 2, 1),
    ('Cacique', 3, 1),
    ('Thigas', 4, 1),
    ('Willianzada', 5, 1);

INSERT INTO escala_sabados (data, pessoa_id, manual, criado_em)
    VALUES ('2026-06-27', 1, 0, datetime('now'));
