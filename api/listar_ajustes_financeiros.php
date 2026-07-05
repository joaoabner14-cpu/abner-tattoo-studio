<?php

include '../config/conexao.php';

$id_os = intval(
    $_GET['id_os']
);

$sql = "

SELECT

    fa.id,
    fa.tipo,
    fa.valor,
    fa.descricao,
    fa.data_registro

FROM financeiro_ajustes fa

INNER JOIN financeiro f
    ON f.id = fa.id_financeiro

WHERE f.id_os = ?

ORDER BY fa.data_registro DESC

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

echo json_encode(
    $dados
);