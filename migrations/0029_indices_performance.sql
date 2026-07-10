CREATE INDEX IF NOT EXISTS idx_agendamentos_estudio_status_data
ON agendamentos(id_estudio,status,data_hora);

CREATE INDEX IF NOT EXISTS idx_financeiro_estudio_status_os
ON financeiro(id_estudio,status,id_os);

CREATE INDEX IF NOT EXISTS idx_financeiro_estudio_cliente
ON financeiro(id_estudio,id_cliente);

CREATE INDEX IF NOT EXISTS idx_movimentos_financeiro_tipo_data
ON financeiro_movimentos(id_financeiro,tipo,data_pagamento,data_movimento);

CREATE INDEX IF NOT EXISTS idx_crediario_status_vencimento_financeiro
ON crediario(status,data_vencimento,id_financeiro);

CREATE INDEX IF NOT EXISTS idx_caixa_estudio_status_data_tipo
ON caixa(id_estudio,status,data_movimento,tipo);

CREATE INDEX IF NOT EXISTS idx_gestao_estudio_status_tipo_datas
ON gestao_financeira(id_estudio,status,tipo,data_vencimento,competencia,data_pagamento);

CREATE INDEX IF NOT EXISTS idx_marketing_estudio_status_datas
ON planejamento_marketing(id_estudio,status,data_inicio,data_postagem,data_fim);
