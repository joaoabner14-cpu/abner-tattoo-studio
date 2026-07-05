<?php

include '../config/conexao.php';

$acao = $_GET['acao'] ?? '';

if($acao == 'abrir'){

    $idAgendamento = intval(
        $_GET['id']
    );

    $sql = "
SELECT

    a.id AS id_agendamento,
    a.data_hora,
    a.status AS status_agendamento,

    c.id AS id_cliente,
    c.nome,
    c.telefone,
    c.cidade,
    c.data_nascimento,
    c.instagram,
    c.cpf,
    c.rg,
    c.observacoes,

    os.id AS id_os,
    os.status,
    os.descricao,

    f.id AS id_financeiro,

    f.valor_orcado,

    f.valor_sinal,

    f.valor_adicional,

    f.valor_desconto,

    f.valor_final,

    f.forma_pagamento,

    f.sinal_pago,

    f.data_pagamento_sinal

FROM agendamentos a

INNER JOIN clientes c
    ON c.id = a.id_cliente

LEFT JOIN ordem_servico os
    ON os.id_agendamento = a.id

LEFT JOIN financeiro f
    ON f.id_os = os.id

WHERE a.id = {$idAgendamento}

LIMIT 1
";

    $result =
        $conn->query($sql);

    echo json_encode(
        $result->fetch_assoc()
    );

    exit;
}