ALTER TABLE estoque ADD COLUMN lote TEXT DEFAULT '';
ALTER TABLE estoque ADD COLUMN data_validade TEXT;
ALTER TABLE estoque ADD COLUMN validade_apos_aberto_dias INTEGER;
ALTER TABLE estoque ADD COLUMN data_abertura TEXT;
ALTER TABLE estoque ADD COLUMN alerta_validade_dias INTEGER NOT NULL DEFAULT 30;

CREATE INDEX idx_estoque_lote ON estoque(lote);
CREATE INDEX idx_estoque_validade ON estoque(data_validade);
