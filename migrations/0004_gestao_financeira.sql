CREATE TABLE gestao_financeira (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL CHECK (tipo IN ('Receita', 'Despesa', 'DAS')),
  categoria TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor REAL NOT NULL CHECK (valor > 0),
  competencia TEXT NOT NULL,
  data_vencimento TEXT,
  data_pagamento TEXT,
  forma_pagamento TEXT,
  status TEXT NOT NULL DEFAULT 'Pendente'
    CHECK (status IN ('Pendente', 'Pago', 'Cancelado')),
  nota_fiscal INTEGER NOT NULL DEFAULT 0 CHECK (nota_fiscal IN (0, 1)),
  documento TEXT DEFAULT '',
  observacoes TEXT DEFAULT '',
  data_criacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_gestao_competencia ON gestao_financeira(competencia);
CREATE INDEX idx_gestao_vencimento ON gestao_financeira(data_vencimento);
CREATE INDEX idx_gestao_status ON gestao_financeira(status);

ALTER TABLE caixa ADD COLUMN id_lancamento INTEGER REFERENCES gestao_financeira(id);
CREATE INDEX idx_caixa_lancamento ON caixa(id_lancamento);
