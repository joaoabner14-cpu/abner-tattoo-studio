PRAGMA foreign_keys = ON;

CREATE TABLE estudios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome_estudio TEXT NOT NULL,
  nome_responsavel TEXT NOT NULL DEFAULT '',
  cnpj TEXT NOT NULL DEFAULT '',
  endereco TEXT NOT NULL DEFAULT '',
  instagram TEXT NOT NULL DEFAULT '',
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0,1)),
  data_criacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO estudios
  (id,nome_estudio,nome_responsavel,cnpj,endereco,instagram)
SELECT 1,nome_estudio,'Abner',cnpj,endereco,instagram
FROM perfil_estudio WHERE id=1;

ALTER TABLE usuarios ADD COLUMN id_estudio INTEGER REFERENCES estudios(id);
ALTER TABLE usuarios ADD COLUMN papel TEXT NOT NULL DEFAULT 'ADMIN_ESTUDIO'
  CHECK (papel IN ('SUPERADMIN','ADMIN_ESTUDIO'));
UPDATE usuarios SET id_estudio=1,papel='SUPERADMIN' WHERE login='abner';
UPDATE usuarios SET id_estudio=1 WHERE id_estudio IS NULL;
CREATE INDEX idx_usuarios_estudio ON usuarios(id_estudio);

ALTER TABLE clientes ADD COLUMN id_estudio INTEGER NOT NULL DEFAULT 1;
ALTER TABLE agendamentos ADD COLUMN id_estudio INTEGER NOT NULL DEFAULT 1;
ALTER TABLE ordem_servico ADD COLUMN id_estudio INTEGER NOT NULL DEFAULT 1;
ALTER TABLE financeiro ADD COLUMN id_estudio INTEGER NOT NULL DEFAULT 1;
ALTER TABLE caixa ADD COLUMN id_estudio INTEGER NOT NULL DEFAULT 1;
ALTER TABLE estoque ADD COLUMN id_estudio INTEGER NOT NULL DEFAULT 1;
ALTER TABLE gestao_financeira ADD COLUMN id_estudio INTEGER NOT NULL DEFAULT 1;
ALTER TABLE planejamento_marketing ADD COLUMN id_estudio INTEGER NOT NULL DEFAULT 1;
ALTER TABLE crm_eventos ADD COLUMN id_estudio INTEGER NOT NULL DEFAULT 1;

DROP INDEX IF EXISTS idx_clientes_cpf;
CREATE UNIQUE INDEX idx_clientes_estudio_cpf
  ON clientes(id_estudio,cpf) WHERE cpf IS NOT NULL AND cpf<>'';
CREATE INDEX idx_clientes_estudio ON clientes(id_estudio);
CREATE INDEX idx_agendamentos_estudio ON agendamentos(id_estudio,data_hora);
CREATE INDEX idx_ordem_servico_estudio ON ordem_servico(id_estudio);
CREATE INDEX idx_financeiro_estudio ON financeiro(id_estudio);
CREATE INDEX idx_caixa_estudio ON caixa(id_estudio,data_movimento);
CREATE INDEX idx_estoque_estudio ON estoque(id_estudio);
CREATE INDEX idx_gestao_financeira_estudio ON gestao_financeira(id_estudio);
CREATE INDEX idx_marketing_estudio ON planejamento_marketing(id_estudio);
CREATE INDEX idx_crm_eventos_estudio ON crm_eventos(id_estudio);

CREATE TABLE marketing_oportunidade_planos_novo (
  id_estudio INTEGER NOT NULL REFERENCES estudios(id),
  chave TEXT NOT NULL,
  id_planejamento INTEGER NOT NULL,
  data_vinculo TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_estudio,chave),
  FOREIGN KEY (id_planejamento) REFERENCES planejamento_marketing(id)
);
INSERT INTO marketing_oportunidade_planos_novo
  (id_estudio,chave,id_planejamento,data_vinculo)
SELECT 1,chave,id_planejamento,data_vinculo FROM marketing_oportunidade_planos;
DROP TABLE marketing_oportunidade_planos;
ALTER TABLE marketing_oportunidade_planos_novo RENAME TO marketing_oportunidade_planos;
CREATE INDEX idx_oportunidade_planejamento
  ON marketing_oportunidade_planos(id_planejamento);
