ALTER TABLE extrato_bancario_importacoes
ADD COLUMN chave_conciliacao TEXT;

UPDATE extrato_bancario_importacoes
SET chave_conciliacao = substr(data_movimento,1,7) || '|' || tipo || '|' || printf('%.2f', valor)
WHERE chave_conciliacao IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_extrato_importacoes_estudio_conciliacao
ON extrato_bancario_importacoes(id_estudio,chave_conciliacao);
