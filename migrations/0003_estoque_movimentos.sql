CREATE TABLE estoque_movimentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_estoque INTEGER NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('Entrada', 'Saida', 'Ajuste')),
  quantidade REAL NOT NULL CHECK (quantidade > 0),
  saldo_anterior REAL NOT NULL,
  saldo_atual REAL NOT NULL,
  valor_unitario REAL,
  observacao TEXT DEFAULT '',
  id_os INTEGER,
  data_movimento TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_estoque) REFERENCES estoque(id),
  FOREIGN KEY (id_os) REFERENCES ordem_servico(id)
);

CREATE INDEX idx_estoque_movimentos_item ON estoque_movimentos(id_estoque);
CREATE INDEX idx_estoque_movimentos_data ON estoque_movimentos(data_movimento);
