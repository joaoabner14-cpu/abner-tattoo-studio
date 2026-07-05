ALTER TABLE financeiro_movimentos
ADD COLUMN id_crediario INTEGER REFERENCES crediario(id);

CREATE INDEX idx_movimentos_crediario
ON financeiro_movimentos(id_crediario);
