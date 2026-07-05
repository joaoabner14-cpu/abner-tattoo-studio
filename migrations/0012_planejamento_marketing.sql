CREATE TABLE planejamento_marketing (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('Promoção','Evento','Postagem')),
  descricao TEXT NOT NULL DEFAULT '',
  oferta TEXT NOT NULL DEFAULT '',
  plataformas TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Ideia'
    CHECK (status IN ('Ideia','Planejado','Produção','Agendado','Publicado','Encerrado')),
  data_inicio TEXT,
  data_fim TEXT,
  data_postagem TEXT,
  hora_postagem TEXT,
  texto_postagem TEXT NOT NULL DEFAULT '',
  objetivo TEXT NOT NULL DEFAULT '',
  publico TEXT NOT NULL DEFAULT '',
  impulsionar INTEGER NOT NULL DEFAULT 0 CHECK (impulsionar IN (0,1)),
  impulsionamento_inicio TEXT,
  impulsionamento_fim TEXT,
  orcamento REAL NOT NULL DEFAULT 0,
  observacoes TEXT NOT NULL DEFAULT '',
  data_criacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_marketing_postagem ON planejamento_marketing(data_postagem);
CREATE INDEX idx_marketing_status ON planejamento_marketing(status);
