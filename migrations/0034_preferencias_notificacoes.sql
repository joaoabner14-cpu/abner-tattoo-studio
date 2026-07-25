ALTER TABLE push_notificacoes ADD COLUMN lida INTEGER NOT NULL DEFAULT 0 CHECK (lida IN (0, 1));
ALTER TABLE push_notificacoes ADD COLUMN resolvida INTEGER NOT NULL DEFAULT 0 CHECK (resolvida IN (0, 1));
ALTER TABLE push_notificacoes ADD COLUMN data_leitura TEXT;
ALTER TABLE push_notificacoes ADD COLUMN data_resolucao TEXT;

CREATE TABLE IF NOT EXISTS push_preferencias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_estudio INTEGER NOT NULL,
  id_usuario INTEGER NOT NULL,
  tipo TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  horario TEXT NOT NULL DEFAULT 'morning'
    CHECK (horario IN ('morning', 'evening', 'both')),
  data_atualizacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_estudio) REFERENCES estudios(id),
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id),
  UNIQUE(id_estudio,id_usuario,tipo)
);

CREATE INDEX IF NOT EXISTS idx_push_preferencias_usuario
ON push_preferencias(id_estudio,id_usuario,ativo);
