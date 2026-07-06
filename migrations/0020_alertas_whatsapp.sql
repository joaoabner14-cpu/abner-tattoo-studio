ALTER TABLE estudios ADD COLUMN whatsapp_alertas TEXT NOT NULL DEFAULT '';
ALTER TABLE estudios ADD COLUMN alertas_whatsapp_ativos INTEGER NOT NULL DEFAULT 0
  CHECK (alertas_whatsapp_ativos IN (0,1));
ALTER TABLE estudios ADD COLUMN horario_resumo_whatsapp TEXT NOT NULL DEFAULT '08:00';

CREATE TABLE whatsapp_resumos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_estudio INTEGER NOT NULL,
  data_referencia TEXT NOT NULL,
  telefone TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pendente'
    CHECK (status IN ('Pendente','Enviado','Erro')),
  resposta TEXT NOT NULL DEFAULT '',
  data_criacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_envio TEXT,
  FOREIGN KEY (id_estudio) REFERENCES estudios(id),
  UNIQUE (id_estudio,data_referencia)
);

CREATE INDEX idx_whatsapp_resumos_estudio
  ON whatsapp_resumos(id_estudio,data_referencia DESC);
