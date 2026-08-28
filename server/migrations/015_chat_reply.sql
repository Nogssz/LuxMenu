ALTER TABLE mensagens ADD COLUMN reply_to_id     INTEGER REFERENCES mensagens(id);
ALTER TABLE mensagens ADD COLUMN reply_to_nome   TEXT;
ALTER TABLE mensagens ADD COLUMN reply_to_texto  TEXT;
