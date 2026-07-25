CREATE TABLE IF NOT EXISTS push_inscricoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_estudio INTEGER NOT NULL,
  id_usuario INTEGER NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT DEFAULT '',
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  ultimo_uso TEXT,
  data_criacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_estudio) REFERENCES estudios(id),
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_push_inscricoes_endpoint
ON push_inscricoes(endpoint);

CREATE INDEX IF NOT EXISTS idx_push_inscricoes_estudio_ativo
ON push_inscricoes(id_estudio,ativo);

CREATE TABLE IF NOT EXISTS push_notificacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_estudio INTEGER NOT NULL,
  id_usuario INTEGER,
  id_inscricao INTEGER,
  chave TEXT NOT NULL,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  url TEXT DEFAULT '/',
  data_referencia TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pendente'
    CHECK (status IN ('Pendente', 'Enviado', 'Erro')),
  resposta TEXT DEFAULT '',
  data_criacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_envio TEXT,
  FOREIGN KEY (id_estudio) REFERENCES estudios(id),
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id),
  FOREIGN KEY (id_inscricao) REFERENCES push_inscricoes(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_push_notificacoes_unicas
ON push_notificacoes(id_estudio,id_inscricao,chave,data_referencia);

CREATE INDEX IF NOT EXISTS idx_push_notificacoes_estudio_data
ON push_notificacoes(id_estudio,data_referencia DESC,status);
