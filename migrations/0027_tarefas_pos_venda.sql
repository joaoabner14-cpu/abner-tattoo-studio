CREATE TABLE IF NOT EXISTS pos_venda_tarefas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_estudio INTEGER NOT NULL,
  id_cliente INTEGER NOT NULL,
  id_os INTEGER NOT NULL,
  id_agendamento INTEGER,
  dias_apos INTEGER NOT NULL CHECK (dias_apos IN (5, 15)),
  data_tarefa TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pendente'
    CHECK (status IN ('Pendente', 'Concluida', 'Cancelada')),
  data_conclusao TEXT,
  observacoes TEXT DEFAULT '',
  data_criacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(id_os, dias_apos),
  FOREIGN KEY (id_cliente) REFERENCES clientes(id),
  FOREIGN KEY (id_os) REFERENCES ordem_servico(id),
  FOREIGN KEY (id_agendamento) REFERENCES agendamentos(id)
);

CREATE INDEX idx_pos_venda_estudio_data
ON pos_venda_tarefas(id_estudio,status,data_tarefa);

CREATE INDEX idx_pos_venda_cliente
ON pos_venda_tarefas(id_cliente);
