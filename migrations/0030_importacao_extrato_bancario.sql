CREATE TABLE IF NOT EXISTS extrato_bancario_importacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_estudio INTEGER NOT NULL,
  chave_importacao TEXT NOT NULL,
  nome_arquivo TEXT DEFAULT '',
  data_movimento TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('Entrada', 'Saida')),
  descricao TEXT DEFAULT '',
  valor REAL NOT NULL CHECK (valor >= 0),
  id_caixa INTEGER REFERENCES caixa(id),
  data_criacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_estudio) REFERENCES estudios(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_extrato_importacoes_estudio_chave
ON extrato_bancario_importacoes(id_estudio,chave_importacao);

CREATE INDEX IF NOT EXISTS idx_extrato_importacoes_estudio_data
ON extrato_bancario_importacoes(id_estudio,data_movimento);
