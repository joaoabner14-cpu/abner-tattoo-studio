PRAGMA foreign_keys = ON;

CREATE TABLE clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  telefone TEXT DEFAULT '',
  cidade TEXT DEFAULT '',
  data_nascimento TEXT,
  instagram TEXT DEFAULT '',
  cpf TEXT,
  rg TEXT DEFAULT '',
  observacoes TEXT DEFAULT '',
  historico_tatuagens TEXT DEFAULT '',
  historico_financeiro TEXT DEFAULT '',
  data_cadastro TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'Ativo'
);
CREATE INDEX idx_clientes_nome ON clientes(nome COLLATE NOCASE);
CREATE INDEX idx_clientes_telefone ON clientes(telefone);
CREATE UNIQUE INDEX idx_clientes_cpf
  ON clientes(cpf) WHERE cpf IS NOT NULL AND cpf <> '';

CREATE TABLE agendamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_cliente INTEGER NOT NULL,
  data_hora TEXT NOT NULL,
  valor_orcado REAL NOT NULL,
  status TEXT DEFAULT 'Agendado'
    CHECK (status IN ('Agendado', 'Confirmado', 'Concluido', 'Cancelado', 'Remarcado')),
  observacoes TEXT DEFAULT '',
  data_criacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  google_event_id TEXT,
  FOREIGN KEY (id_cliente) REFERENCES clientes(id)
);
CREATE INDEX idx_agendamentos_cliente ON agendamentos(id_cliente);
CREATE INDEX idx_agendamentos_data ON agendamentos(data_hora);
CREATE INDEX idx_agendamentos_status ON agendamentos(status);

CREATE TABLE ordem_servico (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_cliente INTEGER NOT NULL,
  data_execucao TEXT,
  descricao TEXT DEFAULT '',
  valor_tatuagem REAL DEFAULT 0,
  custo_total REAL DEFAULT 0,
  lucro_estimado REAL DEFAULT 0,
  status TEXT DEFAULT 'Em Andamento',
  data_criacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  id_agendamento INTEGER,
  FOREIGN KEY (id_cliente) REFERENCES clientes(id),
  FOREIGN KEY (id_agendamento) REFERENCES agendamentos(id)
);
CREATE INDEX idx_os_cliente ON ordem_servico(id_cliente);
CREATE INDEX idx_os_agendamento ON ordem_servico(id_agendamento);
CREATE INDEX idx_os_status ON ordem_servico(status);

CREATE TABLE financeiro (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_cliente INTEGER NOT NULL,
  id_agendamento INTEGER,
  valor_orcado REAL NOT NULL,
  valor_sinal REAL DEFAULT 0,
  valor_adicional REAL DEFAULT 0,
  valor_desconto REAL DEFAULT 0,
  valor_final REAL NOT NULL,
  forma_pagamento TEXT NOT NULL DEFAULT 'Pix'
    CHECK (forma_pagamento IN ('Dinheiro', 'Pix', 'Debito', 'Credito', 'Crediario')),
  status TEXT DEFAULT 'Pendente'
    CHECK (status IN ('Pendente', 'Parcial', 'Pago', 'Cancelado')),
  data_criacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  id_os INTEGER,
  sinal_pago INTEGER NOT NULL DEFAULT 0 CHECK (sinal_pago IN (0, 1)),
  data_pagamento_sinal TEXT,
  data_vencimento_sinal TEXT,
  observacoes TEXT DEFAULT '',
  FOREIGN KEY (id_cliente) REFERENCES clientes(id),
  FOREIGN KEY (id_agendamento) REFERENCES agendamentos(id),
  FOREIGN KEY (id_os) REFERENCES ordem_servico(id)
);
CREATE INDEX idx_financeiro_cliente ON financeiro(id_cliente);
CREATE INDEX idx_financeiro_agendamento ON financeiro(id_agendamento);
CREATE UNIQUE INDEX idx_financeiro_os ON financeiro(id_os) WHERE id_os IS NOT NULL;
CREATE INDEX idx_financeiro_status ON financeiro(status);

CREATE TABLE financeiro_ajustes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_financeiro INTEGER NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('Acrescimo', 'Desconto')),
  valor REAL NOT NULL CHECK (valor > 0),
  descricao TEXT DEFAULT '',
  data_registro TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_financeiro) REFERENCES financeiro(id)
);
CREATE INDEX idx_ajustes_financeiro ON financeiro_ajustes(id_financeiro);

CREATE TABLE financeiro_movimentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_financeiro INTEGER NOT NULL,
  data_movimento TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  tipo TEXT NOT NULL
    CHECK (tipo IN ('Sinal', 'Pagamento', 'Adicional', 'Desconto', 'Estorno')),
  valor REAL NOT NULL CHECK (valor > 0),
  observacao TEXT DEFAULT '',
  forma_pagamento TEXT
    CHECK (forma_pagamento IS NULL OR forma_pagamento IN ('Pix', 'Dinheiro', 'Debito', 'Credito')),
  data_pagamento TEXT,
  FOREIGN KEY (id_financeiro) REFERENCES financeiro(id)
);
CREATE INDEX idx_movimentos_financeiro ON financeiro_movimentos(id_financeiro);
CREATE INDEX idx_movimentos_data ON financeiro_movimentos(data_movimento);

CREATE TABLE crediario (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_financeiro INTEGER NOT NULL,
  numero_parcela INTEGER NOT NULL CHECK (numero_parcela > 0),
  data_vencimento TEXT NOT NULL,
  data_pagamento TEXT,
  valor_parcela REAL NOT NULL CHECK (valor_parcela >= 0),
  status TEXT DEFAULT 'Pendente'
    CHECK (status IN ('Pendente', 'Pago', 'Atrasado', 'Cancelado')),
  observacoes TEXT DEFAULT '',
  FOREIGN KEY (id_financeiro) REFERENCES financeiro(id),
  UNIQUE (id_financeiro, numero_parcela)
);
CREATE INDEX idx_crediario_financeiro ON crediario(id_financeiro);
CREATE INDEX idx_crediario_vencimento ON crediario(data_vencimento);
CREATE INDEX idx_crediario_status ON crediario(status);

CREATE TABLE caixa (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data_movimento TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  tipo TEXT NOT NULL CHECK (tipo IN ('Entrada', 'Saida')),
  categoria TEXT NOT NULL,
  descricao TEXT DEFAULT '',
  valor REAL NOT NULL CHECK (valor >= 0),
  id_cliente INTEGER,
  id_financeiro INTEGER,
  id_os INTEGER,
  forma_pagamento TEXT
    CHECK (forma_pagamento IS NULL OR forma_pagamento IN ('Dinheiro', 'Pix', 'Debito', 'Credito')),
  FOREIGN KEY (id_cliente) REFERENCES clientes(id),
  FOREIGN KEY (id_financeiro) REFERENCES financeiro(id),
  FOREIGN KEY (id_os) REFERENCES ordem_servico(id)
);
CREATE INDEX idx_caixa_data ON caixa(data_movimento);
CREATE INDEX idx_caixa_cliente ON caixa(id_cliente);
CREATE INDEX idx_caixa_financeiro ON caixa(id_financeiro);
CREATE INDEX idx_caixa_os ON caixa(id_os);

CREATE TABLE estoque (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  categoria TEXT,
  marca TEXT,
  unidade TEXT,
  quantidade_atual REAL DEFAULT 0,
  quantidade_minima REAL DEFAULT 0,
  valor_unitario REAL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  observacoes TEXT DEFAULT '',
  data_cadastro TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_estoque_nome ON estoque(nome COLLATE NOCASE);
CREATE INDEX idx_estoque_categoria ON estoque(categoria);

CREATE TABLE os_consumo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_os INTEGER NOT NULL,
  id_estoque INTEGER NOT NULL,
  quantidade REAL NOT NULL CHECK (quantidade > 0),
  unidade TEXT,
  observacao TEXT DEFAULT '',
  data_lancamento TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_os) REFERENCES ordem_servico(id),
  FOREIGN KEY (id_estoque) REFERENCES estoque(id)
);
CREATE INDEX idx_consumo_os ON os_consumo(id_os);
CREATE INDEX idx_consumo_estoque ON os_consumo(id_estoque);

CREATE TABLE anamneses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_os INTEGER NOT NULL,
  dados_json TEXT NOT NULL CHECK (json_valid(dados_json)),
  assinatura TEXT,
  data_preenchimento TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_os) REFERENCES ordem_servico(id)
);
CREATE INDEX idx_anamneses_os ON anamneses(id_os);

CREATE TABLE artes_os (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_os INTEGER NOT NULL,
  tipo TEXT,
  arquivo TEXT NOT NULL,
  observacao TEXT DEFAULT '',
  data_upload TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  thumbnail TEXT,
  FOREIGN KEY (id_os) REFERENCES ordem_servico(id)
);
CREATE INDEX idx_artes_os ON artes_os(id_os);

CREATE TABLE fotos_os (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_os INTEGER NOT NULL,
  tipo TEXT,
  arquivo TEXT NOT NULL,
  observacao TEXT DEFAULT '',
  data_upload TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  thumbnail TEXT,
  FOREIGN KEY (id_os) REFERENCES ordem_servico(id)
);
CREATE INDEX idx_fotos_os ON fotos_os(id_os);

CREATE TABLE pagamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_os INTEGER NOT NULL,
  id_financeiro INTEGER NOT NULL,
  data_pagamento TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  valor REAL NOT NULL CHECK (valor > 0),
  forma_pagamento TEXT NOT NULL
    CHECK (forma_pagamento IN ('Dinheiro', 'Pix', 'Debito', 'Credito')),
  observacoes TEXT DEFAULT '',
  FOREIGN KEY (id_os) REFERENCES ordem_servico(id),
  FOREIGN KEY (id_financeiro) REFERENCES financeiro(id)
);
CREATE INDEX idx_pagamentos_os ON pagamentos(id_os);
CREATE INDEX idx_pagamentos_financeiro ON pagamentos(id_financeiro);

CREATE TABLE configuracoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chave TEXT NOT NULL UNIQUE,
  valor TEXT
);
