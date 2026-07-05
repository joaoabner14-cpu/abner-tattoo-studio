PRAGMA foreign_keys = ON;

CREATE TABLE clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL DEFAULT '',
  cidade TEXT DEFAULT '',
  data_nascimento TEXT,
  instagram TEXT DEFAULT '',
  cpf TEXT DEFAULT '',
  rg TEXT DEFAULT '',
  observacoes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Ativo',
  data_cadastro TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX idx_clientes_nome ON clientes(nome COLLATE NOCASE);
CREATE INDEX idx_clientes_telefone ON clientes(telefone);

CREATE TABLE agendamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_cliente INTEGER NOT NULL REFERENCES clientes(id),
  data_hora TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Agendado',
  valor_orcado REAL NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX idx_agendamentos_data ON agendamentos(data_hora);

CREATE TABLE ordem_servico (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_cliente INTEGER NOT NULL REFERENCES clientes(id),
  id_agendamento INTEGER REFERENCES agendamentos(id),
  status TEXT NOT NULL DEFAULT 'Agendada',
  descricao TEXT DEFAULT '',
  valor_tatuagem REAL NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE financeiro (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_cliente INTEGER NOT NULL REFERENCES clientes(id),
  id_os INTEGER NOT NULL UNIQUE REFERENCES ordem_servico(id),
  valor_orcado REAL NOT NULL DEFAULT 0,
  valor_sinal REAL NOT NULL DEFAULT 0,
  valor_adicional REAL NOT NULL DEFAULT 0,
  valor_desconto REAL NOT NULL DEFAULT 0,
  valor_final REAL NOT NULL DEFAULT 0,
  forma_pagamento TEXT NOT NULL DEFAULT 'Pix',
  sinal_pago INTEGER NOT NULL DEFAULT 0,
  data_pagamento_sinal TEXT,
  status TEXT NOT NULL DEFAULT 'Pendente'
);

CREATE TABLE financeiro_movimentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_financeiro INTEGER NOT NULL REFERENCES financeiro(id),
  tipo TEXT NOT NULL CHECK(tipo IN ('Pagamento', 'Estorno')),
  valor REAL NOT NULL CHECK(valor > 0),
  forma_pagamento TEXT NOT NULL,
  observacao TEXT DEFAULT '',
  data_pagamento TEXT NOT NULL,
  data_movimento TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE financeiro_ajustes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_financeiro INTEGER NOT NULL REFERENCES financeiro(id),
  tipo TEXT NOT NULL CHECK(tipo IN ('Acrescimo', 'Desconto')),
  valor REAL NOT NULL CHECK(valor > 0),
  descricao TEXT DEFAULT '',
  data_registro TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE crediario (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_financeiro INTEGER NOT NULL REFERENCES financeiro(id),
  numero_parcela INTEGER NOT NULL,
  valor_parcela REAL NOT NULL,
  data_vencimento TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pendente'
);

CREATE TABLE caixa (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL,
  categoria TEXT NOT NULL,
  descricao TEXT DEFAULT '',
  valor REAL NOT NULL,
  id_cliente INTEGER REFERENCES clientes(id),
  id_financeiro INTEGER REFERENCES financeiro(id),
  id_os INTEGER REFERENCES ordem_servico(id),
  forma_pagamento TEXT DEFAULT '',
  data_registro TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
