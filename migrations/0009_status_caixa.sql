ALTER TABLE caixa
ADD COLUMN status TEXT NOT NULL DEFAULT 'Ativo'
  CHECK (status IN ('Ativo', 'Cancelado'));

CREATE INDEX idx_caixa_status ON caixa(status);
