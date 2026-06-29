CREATE TABLE IF NOT EXISTS contabilidades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    email TEXT
);

CREATE TABLE IF NOT EXISTS campos_customizados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('texto', 'checkbox', 'selecao')),
    ordem INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS campo_opcoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campo_id INTEGER NOT NULL REFERENCES campos_customizados(id) ON DELETE CASCADE,
    valor TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    cnpj TEXT,
    responsavel TEXT,
    contato TEXT,
    obs TEXT,
    contabilidade_id INTEGER REFERENCES contabilidades(id),
    ativo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS cliente_campo_valores (
    cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    campo_id INTEGER NOT NULL REFERENCES campos_customizados(id) ON DELETE CASCADE,
    valor TEXT,
    PRIMARY KEY (cliente_id, campo_id)
);

CREATE TABLE IF NOT EXISTS fechamentos_mensais (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
    ano INTEGER NOT NULL,
    feito INTEGER NOT NULL DEFAULT 0,
    marcado_em TEXT,
    UNIQUE (cliente_id, mes, ano)
);
