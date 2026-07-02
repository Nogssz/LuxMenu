CREATE TABLE IF NOT EXISTS sessoes (
    sid       TEXT PRIMARY KEY,
    dados     TEXT NOT NULL,
    expira_em INTEGER NOT NULL
);
