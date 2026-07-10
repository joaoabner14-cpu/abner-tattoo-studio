ALTER TABLE sessoes ADD COLUMN csrf_token TEXT NOT NULL DEFAULT '';

CREATE INDEX idx_sessoes_csrf
ON sessoes(csrf_token);
