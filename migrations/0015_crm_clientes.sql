ALTER TABLE ordem_servico ADD COLUMN regiao_corpo TEXT NOT NULL DEFAULT '';
ALTER TABLE ordem_servico ADD COLUMN tempo_sessao_minutos INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agendamentos ADD COLUMN faltou INTEGER NOT NULL DEFAULT 0 CHECK (faltou IN (0,1));

CREATE TABLE crm_fotos_clientes (
  id_cliente INTEGER PRIMARY KEY,
  mime_type TEXT NOT NULL,
  dados_base64 TEXT NOT NULL,
  data_atualizacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_cliente) REFERENCES clientes(id)
);

CREATE TABLE crm_fotos_tatuagens (
  id_os INTEGER PRIMARY KEY,
  mime_type TEXT NOT NULL,
  dados_base64 TEXT NOT NULL,
  data_atualizacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_os) REFERENCES ordem_servico(id)
);

CREATE TABLE crm_eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_cliente INTEGER NOT NULL,
  id_os INTEGER,
  id_agendamento INTEGER,
  tipo TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  data_evento TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_cliente) REFERENCES clientes(id),
  FOREIGN KEY (id_os) REFERENCES ordem_servico(id),
  FOREIGN KEY (id_agendamento) REFERENCES agendamentos(id)
);

CREATE INDEX idx_crm_eventos_cliente ON crm_eventos(id_cliente,data_evento);
