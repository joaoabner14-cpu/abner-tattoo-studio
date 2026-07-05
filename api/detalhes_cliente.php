<?php

include '../config/conexao.php';

$id =
    intval(
        $_GET['id']
        ?? 0
    );

$sql = "

SELECT *

FROM clientes

WHERE id = ?

LIMIT 1

";

$stmt =
    $conn->prepare($sql);

$stmt->bind_param(
    "i",
    $id
);

$stmt->execute();

$result =
    $stmt->get_result();

$cliente =
    $result->fetch_assoc();

header(
    'Content-Type: application/json'
);

echo json_encode(
    $cliente
);