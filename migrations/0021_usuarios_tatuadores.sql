ALTER TABLE usuarios ADD COLUMN perfil_acesso TEXT NOT NULL DEFAULT 'ADMINISTRADOR'
  CHECK (perfil_acesso IN ('ADMINISTRADOR','TATUADOR','RECEPCAO'));
ALTER TABLE usuarios ADD COLUMN cor_agenda TEXT NOT NULL DEFAULT '#d5a75b';

ALTER TABLE agendamentos ADD COLUMN id_tatuador INTEGER REFERENCES usuarios(id);

CREATE INDEX idx_agendamentos_tatuador
  ON agendamentos(id_estudio,id_tatuador,data_hora);

UPDATE agendamentos
SET id_tatuador=(
  SELECT u.id FROM usuarios u
  WHERE u.id_estudio=agendamentos.id_estudio AND u.ativo=1
  ORDER BY CASE WHEN u.papel='SUPERADMIN' THEN 0 ELSE 1 END,u.id
  LIMIT 1
)
WHERE id_tatuador IS NULL;
