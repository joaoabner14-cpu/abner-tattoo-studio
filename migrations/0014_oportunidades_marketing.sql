CREATE TABLE marketing_oportunidade_planos (
  chave TEXT PRIMARY KEY,
  id_planejamento INTEGER NOT NULL,
  data_vinculo TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_planejamento) REFERENCES planejamento_marketing(id)
);

CREATE INDEX idx_oportunidade_planejamento
ON marketing_oportunidade_planos(id_planejamento);
