ALTER TABLE estoque ADD COLUMN valor_compra_embalagem REAL DEFAULT 0;
ALTER TABLE estoque ADD COLUMN valor_custo_unitario REAL DEFAULT 0;
ALTER TABLE estoque ADD COLUMN margem_venda_percentual REAL DEFAULT 0;
ALTER TABLE estoque ADD COLUMN valor_venda_unitario REAL DEFAULT 0;

UPDATE estoque
SET valor_custo_unitario = COALESCE(valor_unitario, 0),
    valor_venda_unitario = COALESCE(valor_unitario, 0)
WHERE COALESCE(valor_custo_unitario, 0) = 0;

ALTER TABLE estoque_movimentos ADD COLUMN valor_total_pago REAL DEFAULT 0;
ALTER TABLE estoque_movimentos ADD COLUMN valor_venda_unitario REAL DEFAULT 0;
