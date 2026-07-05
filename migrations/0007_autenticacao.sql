CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  login TEXT NOT NULL UNIQUE COLLATE NOCASE,
  nome TEXT NOT NULL,
  senha_salt TEXT NOT NULL,
  senha_hash TEXT NOT NULL,
  senha_iteracoes INTEGER NOT NULL DEFAULT 310000,
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  data_criacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_login TEXT
);

INSERT INTO usuarios(login,nome,senha_salt,senha_hash,senha_iteracoes)
VALUES(
  'abner',
  'Abner',
  'rZOJUr+U0aSCG0jbACDSHdf7adAdMj26aHVR5ZVP/vk=',
  'lW/hqvw67lxQkcvv7q5NwrrzroacvLjpxUu8xdnCO1M=',
  310000
);

CREATE TABLE sessoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_usuario INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  data_criacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_expiracao TEXT NOT NULL,
  revogada INTEGER NOT NULL DEFAULT 0 CHECK (revogada IN (0, 1)),
  ip TEXT,
  user_agent TEXT,
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id)
);
CREATE INDEX idx_sessoes_token ON sessoes(token_hash);
CREATE INDEX idx_sessoes_expiracao ON sessoes(data_expiracao);

CREATE TABLE tentativas_login (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  login TEXT NOT NULL,
  ip TEXT NOT NULL,
  sucesso INTEGER NOT NULL DEFAULT 0 CHECK (sucesso IN (0, 1)),
  data_tentativa TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_tentativas_login ON tentativas_login(login,ip,data_tentativa);

CREATE TABLE webauthn_credenciais (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_usuario INTEGER NOT NULL,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT DEFAULT '[]',
  device_type TEXT,
  backed_up INTEGER NOT NULL DEFAULT 0 CHECK (backed_up IN (0, 1)),
  data_criacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_uso TEXT,
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id)
);
CREATE INDEX idx_webauthn_usuario ON webauthn_credenciais(id_usuario);

CREATE TABLE webauthn_desafios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_usuario INTEGER,
  desafio TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL CHECK (tipo IN ('registro', 'autenticacao')),
  data_expiracao TEXT NOT NULL,
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id)
);
CREATE INDEX idx_webauthn_desafio ON webauthn_desafios(desafio);
