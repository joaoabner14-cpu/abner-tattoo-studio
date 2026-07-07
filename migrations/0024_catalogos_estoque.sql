ALTER TABLE estoque ADD COLUMN tipo_material TEXT NOT NULL DEFAULT '';

CREATE TABLE estoque_tipos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_estudio INTEGER NOT NULL,
  nome TEXT NOT NULL COLLATE NOCASE,
  data_criacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(id_estudio,nome),
  FOREIGN KEY (id_estudio) REFERENCES estudios(id)
);

CREATE TABLE estoque_categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_estudio INTEGER NOT NULL,
  nome TEXT NOT NULL COLLATE NOCASE,
  data_criacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(id_estudio,nome),
  FOREIGN KEY (id_estudio) REFERENCES estudios(id)
);

CREATE TABLE estoque_marcas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_estudio INTEGER NOT NULL,
  nome TEXT NOT NULL COLLATE NOCASE,
  data_criacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(id_estudio,nome),
  FOREIGN KEY (id_estudio) REFERENCES estudios(id)
);

UPDATE estoque
SET tipo_material = CASE
  WHEN tipo_item='Tinta' THEN 'Tinta'
  WHEN COALESCE(categoria,'')<>'' THEN categoria
  ELSE ''
END
WHERE COALESCE(tipo_material,'')='';

INSERT OR IGNORE INTO estoque_tipos(id_estudio,nome)
SELECT DISTINCT id_estudio,tipo_material FROM estoque
WHERE COALESCE(tipo_material,'')<>'';

INSERT OR IGNORE INTO estoque_categorias(id_estudio,nome)
SELECT DISTINCT id_estudio,categoria FROM estoque
WHERE COALESCE(categoria,'')<>'';

INSERT OR IGNORE INTO estoque_marcas(id_estudio,nome)
SELECT DISTINCT id_estudio,marca FROM estoque
WHERE COALESCE(marca,'')<>'';
