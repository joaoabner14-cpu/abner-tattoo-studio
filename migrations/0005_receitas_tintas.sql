ALTER TABLE estoque ADD COLUMN tipo_item TEXT NOT NULL DEFAULT 'Material'
  CHECK (tipo_item IN ('Material', 'Tinta'));
ALTER TABLE estoque ADD COLUMN cor TEXT DEFAULT '';
ALTER TABLE estoque ADD COLUMN volume_embalagem_ml REAL;
ALTER TABLE estoque ADD COLUMN ml_por_gota REAL DEFAULT 0.05;

CREATE TABLE os_batoques (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_os INTEGER NOT NULL,
  identificacao TEXT NOT NULL,
  tamanho TEXT NOT NULL DEFAULT 'P',
  capacidade_ml REAL,
  observacao TEXT DEFAULT '',
  data_registro TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_os) REFERENCES ordem_servico(id)
);
CREATE INDEX idx_batoques_os ON os_batoques(id_os);

CREATE TABLE os_batoque_tintas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_batoque INTEGER NOT NULL,
  id_estoque INTEGER NOT NULL,
  nome_tinta TEXT NOT NULL,
  cor TEXT DEFAULT '',
  gotas INTEGER NOT NULL CHECK (gotas > 0),
  ml_por_gota REAL NOT NULL,
  volume_consumido_ml REAL NOT NULL,
  FOREIGN KEY (id_batoque) REFERENCES os_batoques(id) ON DELETE CASCADE,
  FOREIGN KEY (id_estoque) REFERENCES estoque(id)
);
CREATE INDEX idx_batoque_tintas_batoque ON os_batoque_tintas(id_batoque);
CREATE INDEX idx_batoque_tintas_estoque ON os_batoque_tintas(id_estoque);
