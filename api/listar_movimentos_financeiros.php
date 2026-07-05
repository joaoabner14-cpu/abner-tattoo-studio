<?php

include '../config/conexao.php';

$id_os = intval(
    $_GET['id_os']
);

$sql = "

SELECT

    fm.id,
    fm.data_movimento,
    fm.tipo,
    fm.valor,
    fm.forma_pagamento,
    fm.observacao,
	fm.data_pagamento

FROM financeiro_movimentos fm

INNER JOIN financeiro f
    ON f.id = fm.id_financeiro

WHERE f.id_os = ?

ORDER BY fm.data_movimento DESC

";

$stmt =
    $conn->prepare($sql);

$stmt->bind_param(
    "i",
    $id_os
);

$stmt->execute();

$result =
    $stmt->get_result();

$dados = [];

while(
    $row =
    $result->fetch_assoc()
){
    $dados[] = $row;
}

header(
    'Content-Type: application/json'
);

echo json_encode(
    $dados
);