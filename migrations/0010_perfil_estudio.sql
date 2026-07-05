CREATE TABLE perfil_estudio (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  nome_estudio TEXT NOT NULL DEFAULT 'Abner Tattoo Studio',
  endereco TEXT NOT NULL DEFAULT '',
  cnpj TEXT NOT NULL DEFAULT '',
  instagram TEXT NOT NULL DEFAULT '',
  data_atualizacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO perfil_estudio(id) VALUES(1);
