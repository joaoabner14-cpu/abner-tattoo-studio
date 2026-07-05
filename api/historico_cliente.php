<?php

include '../config/conexao.php';

$idCliente =
    intval(
        $_GET['id']
    );

$historico = [];

/*
==================================================
AGENDAMENTOS
==================================================
*/

$sql = "

SELECT

    data_hora,
    'Agendamento' AS tipo,
    status AS descricao

FROM agendamentos

WHERE id_cliente = ?

";

$stmt =
    $conn->prepare($sql);

$stmt->bind_param(
    "i",
    $idCliente
);

$stmt->execute();

$result =
    $stmt->get_result();

while(
    $row =
    $result->fetch_assoc()
){

    $historico[] = [

        'data' =>
            $row['data_hora'],

        'tipo' =>
            $row['tipo'],

        'descricao' =>
            $row['descricao']

    ];
}

/*
==================================================
MOVIMENTOS FINANCEIROS
==================================================
*/

$sql = "

SELECT

    fm.data_pagamento,
    fm.tipo,
    CONCAT(
        'R$ ',
        fm.valor,
        ' - ',
        fm.observacao
    ) AS descricao

FROM financeiro_movimentos fm

INNER JOIN financeiro f
ON f.id = fm.id_financeiro

WHERE f.id_cliente = ?

";

$stmt =
    $conn->prepare($sql);

$stmt->bind_param(
    "i",
    $idCliente
);

$stmt->execute();

$result =
    $stmt->get_result();

while(
    $row =
    $result->fetch_assoc()
){

    $historico[] = [

        'data' =>
            $row['data_pagamento'],

        'tipo' =>
            $row['tipo'],

        'descricao' =>
            $row['descricao']

    ];
}

/*
==================================================
AJUSTES
==================================================
*/

$sql = "

SELECT

    fa.data_registro,
    fa.tipo,
    CONCAT(
        'R$ ',
        fa.valor,
        ' - ',
        fa.descricao
    ) AS descricao

FROM financeiro_ajustes fa

INNER JOIN financeiro f
ON f.id = fa.id_financeiro

WHERE f.id_cliente = ?

";

$stmt =
    $conn->prepare($sql);

$stmt->bind_param(
    "i",
    $idCliente
);

$stmt->execute();

$result =
    $stmt->get_result();

while(
    $row =
    $result->fetch_assoc()
){

    $historico[] = [

        'data' =>
            $row['data_registro'],

        'tipo' =>
            $row['tipo'],

        'descricao' =>
            $row['descricao']

    ];
}

usort(
    $historico,
    function($a,$b){

        return strtotime(
            $b['data']
        )
        -
        strtotime(
            $a['data']
        );
    }
);

echo json_encode(
    $historico
);