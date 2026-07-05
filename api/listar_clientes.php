<?php

include '../config/conexao.php';

$busca =
    $_GET['busca']
    ?? '';

$busca =
    trim($busca);

$sql = "

SELECT

    id,
    nome,
    telefone

FROM clientes

";

if($busca != ''){

    $sql .= "

    WHERE nome LIKE ?

    ";
}

$sql .= "

ORDER BY nome ASC

";

$stmt =
    $conn->prepare($sql);

if($busca != ''){

    $termo =
        '%' .
        $busca .
        '%';

    $stmt->bind_param(
        "s",
        $termo
    );
}

$stmt->execute();

$result =
    $stmt->get_result();

$clientes = [];

while(
    $row =
    $result->fetch_assoc()
){

    $clientes[] =
        $row;
}

header(
    'Content-Type: application/json'
);

echo json_encode(
    $clientes
);