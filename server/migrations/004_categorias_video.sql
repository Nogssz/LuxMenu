CREATE TABLE IF NOT EXISTS categorias_video (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE
);

ALTER TABLE videos ADD COLUMN categoria_id INTEGER REFERENCES categorias_video(id);

INSERT OR IGNORE INTO categorias_video (nome) VALUES
    ('Financeiro'),
    ('Fiscal'),
    ('Cadastros'),
    ('Ordens de Serviço'),
    ('Orçamentos'),
    ('Venda/PDV');
