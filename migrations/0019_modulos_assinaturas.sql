CREATE TABLE estudio_modulos (
  id_estudio INTEGER NOT NULL,
  modulo TEXT NOT NULL CHECK (modulo IN
    ('agenda','clientes','financeiro','estoque','marketing')),
  habilitado INTEGER NOT NULL DEFAULT 1 CHECK (habilitado IN (0,1)),
  data_atualizacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_estudio,modulo),
  FOREIGN KEY (id_estudio) REFERENCES estudios(id)
);

INSERT INTO estudio_modulos(id_estudio,modulo,habilitado)
SELECT id,'agenda',1 FROM estudios
UNION ALL SELECT id,'clientes',1 FROM estudios
UNION ALL SELECT id,'financeiro',1 FROM estudios
UNION ALL SELECT id,'estoque',1 FROM estudios
UNION ALL SELECT id,'marketing',CASE WHEN id=1 THEN 1 ELSE 0 END FROM estudios;

CREATE TABLE assinaturas_estudios (
  id_estudio INTEGER PRIMARY KEY,
  valor_mensal REAL NOT NULL DEFAULT 0,
  dia_vencimento INTEGER NOT NULL DEFAULT 10 CHECK (dia_vencimento BETWEEN 1 AND 28),
  status TEXT NOT NULL DEFAULT 'Ativa'
    CHECK (status IN ('Ativa','Pausada','Cancelada')),
  data_inicio TEXT,
  data_cancelamento TEXT,
  observacoes TEXT NOT NULL DEFAULT '',
  data_atualizacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_estudio) REFERENCES estudios(id)
);

INSERT INTO assinaturas_estudios(id_estudio,status,data_inicio)
SELECT id,CASE WHEN ativo=1 THEN 'Ativa' ELSE 'Cancelada' END,date(data_criacao)
FROM estudios;

CREATE TABLE assinatura_parcelas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_estudio INTEGER NOT NULL,
  competencia TEXT NOT NULL,
  data_vencimento TEXT NOT NULL,
  valor REAL NOT NULL CHECK (valor>=0),
  status TEXT NOT NULL DEFAULT 'Pendente'
    CHECK (status IN ('Pendente','Pago','Cancelado')),
  data_pagamento TEXT,
  forma_pagamento TEXT NOT NULL DEFAULT '',
  observacoes TEXT NOT NULL DEFAULT '',
  data_criacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (id_estudio,competencia),
  FOREIGN KEY (id_estudio) REFERENCES estudios(id)
);
CREATE INDEX idx_assinatura_parcelas_estudio
  ON assinatura_parcelas(id_estudio,status,data_vencimento);
