CREATE TABLE IF NOT EXISTS agenda_compromissos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data TEXT NOT NULL,
  hora_inicio TEXT NOT NULL,
  hora_fim TEXT NOT NULL,
  pessoa_id INTEGER REFERENCES pessoas_escala(id),
  criado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agenda_tarefas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data TEXT,
  pessoa_id INTEGER REFERENCES pessoas_escala(id),
  feito INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agenda_compromissos_data ON agenda_compromissos(data);
CREATE INDEX IF NOT EXISTS idx_agenda_tarefas_data ON agenda_tarefas(data);
