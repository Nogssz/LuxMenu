-- Índice FTS5 para busca por texto completo com ranking de relevância.
-- remove_diacritics remove acentos, então "orcamento" encontra "orçamento".
CREATE VIRTUAL TABLE IF NOT EXISTS videos_fts USING fts5(
    titulo,
    tags,
    descricao,
    content=videos,
    content_rowid=id,
    tokenize='unicode61 remove_diacritics 1'
);

-- Popula com os vídeos existentes
INSERT INTO videos_fts(rowid, titulo, tags, descricao)
SELECT id, titulo, COALESCE(tags, ''), COALESCE(descricao, '') FROM videos;

-- Mantém o índice sincronizado automaticamente
CREATE TRIGGER IF NOT EXISTS videos_fts_insert AFTER INSERT ON videos BEGIN
    INSERT INTO videos_fts(rowid, titulo, tags, descricao)
    VALUES (new.id, new.titulo, COALESCE(new.tags, ''), COALESCE(new.descricao, ''));
END;

CREATE TRIGGER IF NOT EXISTS videos_fts_update AFTER UPDATE ON videos BEGIN
    INSERT INTO videos_fts(videos_fts, rowid, titulo, tags, descricao)
    VALUES ('delete', old.id, old.titulo, COALESCE(old.tags, ''), COALESCE(old.descricao, ''));
    INSERT INTO videos_fts(rowid, titulo, tags, descricao)
    VALUES (new.id, new.titulo, COALESCE(new.tags, ''), COALESCE(new.descricao, ''));
END;

CREATE TRIGGER IF NOT EXISTS videos_fts_delete AFTER DELETE ON videos BEGIN
    INSERT INTO videos_fts(videos_fts, rowid, titulo, tags, descricao)
    VALUES ('delete', old.id, old.titulo, COALESCE(old.tags, ''), COALESCE(old.descricao, ''));
END;
