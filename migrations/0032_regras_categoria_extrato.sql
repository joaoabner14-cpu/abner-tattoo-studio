CREATE TABLE IF NOT EXISTS extrato_categoria_regras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_estudio INTEGER NOT NULL,
  palavra_chave TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'Ambos'
    CHECK (tipo IN ('Entrada', 'Saida', 'Ambos')),
  categoria TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  data_criacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_estudio) REFERENCES estudios(id)
);

CREATE INDEX IF NOT EXISTS idx_extrato_regras_estudio
ON extrato_categoria_regras(id_estudio,ativo,tipo);

INSERT INTO extrato_categoria_regras(id_estudio,palavra_chave,tipo,categoria)
SELECT id,'MINISTERIO DA FAZENDA','Saida','Impostos' FROM estudios
WHERE NOT EXISTS (
  SELECT 1 FROM extrato_categoria_regras
  WHERE id_estudio=estudios.id AND palavra_chave='MINISTERIO DA FAZENDA'
);

INSERT INTO extrato_categoria_regras(id_estudio,palavra_chave,tipo,categoria)
SELECT id,'MARKETPLACE','Saida','Taxas' FROM estudios
WHERE NOT EXISTS (
  SELECT 1 FROM extrato_categoria_regras
  WHERE id_estudio=estudios.id AND palavra_chave='MARKETPLACE'
);

INSERT INTO extrato_categoria_regras(id_estudio,palavra_chave,tipo,categoria)
SELECT id,'PAPELARIA','Saida','Materiais' FROM estudios
WHERE NOT EXISTS (
  SELECT 1 FROM extrato_categoria_regras
  WHERE id_estudio=estudios.id AND palavra_chave='PAPELARIA'
);

INSERT INTO extrato_categoria_regras(id_estudio,palavra_chave,tipo,categoria)
SELECT id,'SUPERMERCADO','Saida','Alimentação' FROM estudios
WHERE NOT EXISTS (
  SELECT 1 FROM extrato_categoria_regras
  WHERE id_estudio=estudios.id AND palavra_chave='SUPERMERCADO'
);

INSERT INTO extrato_categoria_regras(id_estudio,palavra_chave,tipo,categoria)
SELECT id,'PADARIA','Saida','Alimentação' FROM estudios
WHERE NOT EXISTS (
  SELECT 1 FROM extrato_categoria_regras
  WHERE id_estudio=estudios.id AND palavra_chave='PADARIA'
);

INSERT INTO extrato_categoria_regras(id_estudio,palavra_chave,tipo,categoria)
SELECT id,'CASHBACK','Entrada','Outras receitas' FROM estudios
WHERE NOT EXISTS (
  SELECT 1 FROM extrato_categoria_regras
  WHERE id_estudio=estudios.id AND palavra_chave='CASHBACK'
);
