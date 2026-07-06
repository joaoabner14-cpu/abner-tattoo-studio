ALTER TABLE lgpd_clientes
  ADD COLUMN autoriza_fotos_divulgacao INTEGER NOT NULL DEFAULT 0
  CHECK (autoriza_fotos_divulgacao IN (0,1));
ALTER TABLE lgpd_clientes ADD COLUMN data_consentimento_fotos TEXT;
ALTER TABLE lgpd_clientes ADD COLUMN data_revogacao_fotos TEXT;
ALTER TABLE lgpd_clientes ADD COLUMN id_usuario_marketing INTEGER;
ALTER TABLE lgpd_clientes ADD COLUMN id_usuario_fotos INTEGER;

CREATE TABLE lgpd_historico (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_estudio INTEGER NOT NULL,
  id_cliente INTEGER NOT NULL,
  id_usuario INTEGER,
  tipo TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  data_evento TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_cliente) REFERENCES clientes(id),
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id)
);
CREATE INDEX idx_lgpd_historico_cliente
  ON lgpd_historico(id_estudio,id_cliente,data_evento);

CREATE TABLE lgpd_solicitacoes_novo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_estudio INTEGER NOT NULL,
  id_cliente INTEGER NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN
    ('Acesso','Correcao','Exclusao','Revogacao de consentimento','Portabilidade','Outro')),
  status TEXT NOT NULL DEFAULT 'Pendente'
    CHECK (status IN ('Pendente','Em andamento','Concluida','Recusada')),
  descricao TEXT NOT NULL DEFAULT '',
  observacao_interna TEXT NOT NULL DEFAULT '',
  data_solicitacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_limite TEXT,
  data_conclusao TEXT,
  FOREIGN KEY (id_cliente) REFERENCES clientes(id)
);

INSERT INTO lgpd_solicitacoes_novo
  (id,id_estudio,id_cliente,tipo,status,descricao,observacao_interna,
    data_solicitacao,data_limite,data_conclusao)
SELECT id,id_estudio,id_cliente,
  CASE tipo
    WHEN 'Correcao' THEN 'Correcao'
    WHEN 'Portabilidade' THEN 'Portabilidade'
    WHEN 'Revogacao' THEN 'Revogacao de consentimento'
    WHEN 'Acesso' THEN 'Acesso'
    ELSE 'Exclusao'
  END,
  CASE status
    WHEN 'Aberta' THEN 'Pendente'
    WHEN 'Em analise' THEN 'Em andamento'
    WHEN 'Concluida' THEN 'Concluida'
    ELSE 'Recusada'
  END,
  descricao,resposta,data_solicitacao,data_limite,data_conclusao
FROM lgpd_solicitacoes;

DROP TABLE lgpd_solicitacoes;
ALTER TABLE lgpd_solicitacoes_novo RENAME TO lgpd_solicitacoes;
CREATE INDEX idx_lgpd_solicitacoes_estudio
  ON lgpd_solicitacoes(id_estudio,status,data_solicitacao);

UPDATE estudios SET prazo_retencao_anos=0 WHERE prazo_retencao_anos=5;
