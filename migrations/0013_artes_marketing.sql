CREATE TABLE marketing_artes (
  id_planejamento INTEGER PRIMARY KEY,
  mime_type TEXT NOT NULL,
  dados_base64 TEXT NOT NULL,
  data_atualizacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_planejamento) REFERENCES planejamento_marketing(id) ON DELETE CASCADE
);
