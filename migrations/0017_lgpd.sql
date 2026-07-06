ALTER TABLE estudios ADD COLUMN email_privacidade TEXT NOT NULL DEFAULT '';
ALTER TABLE estudios ADD COLUMN versao_aviso_privacidade TEXT NOT NULL DEFAULT '1.0';
ALTER TABLE estudios ADD COLUMN prazo_retencao_anos INTEGER NOT NULL DEFAULT 5;

UPDATE estudios
SET email_privacidade='joao.abner14@gmail.com'
WHERE id=1;

CREATE TABLE lgpd_auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_estudio INTEGER NOT NULL,
  id_usuario INTEGER NOT NULL,
  acao TEXT NOT NULL,
  recurso TEXT NOT NULL,
  resultado INTEGER NOT NULL,
  ip TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  data_evento TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_lgpd_auditoria_estudio
  ON lgpd_auditoria(id_estudio,data_evento);

CREATE TABLE lgpd_clientes (
  id_cliente INTEGER PRIMARY KEY,
  id_estudio INTEGER NOT NULL,
  base_cadastro TEXT NOT NULL DEFAULT 'Execucao de contrato',
  aceita_marketing INTEGER NOT NULL DEFAULT 0 CHECK (aceita_marketing IN (0,1)),
  data_consentimento_marketing TEXT,
  data_revogacao_marketing TEXT,
  versao_aviso TEXT NOT NULL DEFAULT '1.0',
  data_atualizacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_cliente) REFERENCES clientes(id)
);
CREATE INDEX idx_lgpd_clientes_estudio ON lgpd_clientes(id_estudio);

CREATE TABLE lgpd_solicitacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_estudio INTEGER NOT NULL,
  id_cliente INTEGER NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN
    ('Acesso','Correcao','Anonimizacao','Bloqueio','Eliminacao','Portabilidade','Revogacao')),
  status TEXT NOT NULL DEFAULT 'Aberta'
    CHECK (status IN ('Aberta','Em analise','Concluida','Recusada')),
  descricao TEXT NOT NULL DEFAULT '',
  resposta TEXT NOT NULL DEFAULT '',
  data_solicitacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_limite TEXT NOT NULL DEFAULT (datetime('now','+15 days')),
  data_conclusao TEXT,
  FOREIGN KEY (id_cliente) REFERENCES clientes(id)
);
CREATE INDEX idx_lgpd_solicitacoes_estudio
  ON lgpd_solicitacoes(id_estudio,status,data_solicitacao);
