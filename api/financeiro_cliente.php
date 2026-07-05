<?php

include '../config/conexao.php';

$idCliente =
    intval(
        $_GET['id']
    );

$sql = "

SELECT

    COALESCE(
        SUM(valor_final),
        0
    ) AS total_orcado

FROM financeiro

WHERE id_cliente = ?

";

$stmt =
    $conn->prepare($sql);

$stmt->bind_param(
    "i",
    $idCliente
);

$stmt->execute();

$totalOrcado =
    $stmt
    ->get_result()
    ->fetch_assoc();

$sql = "

SELECT

    COALESCE(
        SUM(valor),
        0
    ) AS total_pago

FROM financeiro_movimentos fm

INNER JOIN financeiro f
ON f.id = fm.id_financeiro

WHERE

    f.id_cliente = ?

AND

    fm.tipo = 'Pagamento'

";

$stmt =
    $conn->prepare($sql);

$stmt->bind_param(
    "i",
    $idCliente
);

$stmt->execute();

$totalPago =
    $stmt
    ->get_result()
    ->fetch_assoc();

$sql = "

SELECT

    COALESCE(
        SUM(valor),
        0
    ) AS total_estornado

FROM financeiro_movimentos fm

INNER JOIN financeiro f
ON f.id = fm.id_financeiro

WHERE

    f.id_cliente = ?

AND

    fm.tipo = 'Estorno'

";

$stmt =
    $conn->prepare($sql);

$stmt->bind_param(
    "i",
    $idCliente
);

$stmt->execute();

$totalEstorno =
    $stmt
    ->get_result()
    ->fetch_assoc();

$retorno = [

    'orcado' =>

        floatval(
            $totalOrcado['total_orcado']
        ),

    'pago' =>

        floatval(
            $totalPago['total_pago']
        ),

    'estornado' =>

        floatval(
            $totalEstorno['total_estornado']
        )

];

echo json_encode(
    $retorno
);