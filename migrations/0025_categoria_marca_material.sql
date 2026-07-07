CREATE TABLE IF NOT EXISTS categoria_material (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_estudio INTEGER NOT NULL,
  nome TEXT NOT NULL COLLATE NOCASE,
  data_criacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(id_estudio,nome),
  FOREIGN KEY (id_estudio) REFERENCES estudios(id)
);

CREATE TABLE IF NOT EXISTS marca_material (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_estudio INTEGER NOT NULL,
  nome TEXT NOT NULL COLLATE NOCASE,
  data_criacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(id_estudio,nome),
  FOREIGN KEY (id_estudio) REFERENCES estudios(id)
);

INSERT OR IGNORE INTO categoria_material(id_estudio,nome)
SELECT DISTINCT id_estudio,categoria FROM estoque
WHERE COALESCE(categoria,'')<>'';

INSERT OR IGNORE INTO categoria_material(id_estudio,nome)
SELECT DISTINCT id_estudio,nome FROM estoque_categorias
WHERE COALESCE(nome,'')<>'';

INSERT OR IGNORE INTO marca_material(id_estudio,nome)
SELECT DISTINCT id_estudio,marca FROM estoque
WHERE COALESCE(marca,'')<>'';

INSERT OR IGNORE INTO marca_material(id_estudio,nome)
SELECT DISTINCT id_estudio,nome FROM estoque_marcas
WHERE COALESCE(nome,'')<>'';
