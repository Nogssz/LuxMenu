CREATE TABLE IF NOT EXISTS cache_cnpj (
    cnpj TEXT PRIMARY KEY,
    dados TEXT NOT NULL,
    consultado_em TEXT NOT NULL
);
