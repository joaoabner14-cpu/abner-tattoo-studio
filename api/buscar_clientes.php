<?php

include '../config/conexao.php';

$termo = $_GET['termo'] ?? '';

$sql = "
SELECT
    id,
    nome,
    telefone
FROM clientes
WHERE nome LIKE ?
ORDER BY nome
LIMIT 10
";

$stmt = $conn->prepare($sql);

$busca = "%{$termo}%";

$stmt->bind_param(
    "s",
    $busca
);

$stmt->execute();

$result =
    $stmt->get_result();

$clientes = [];

while($row =
    $result->fetch_assoc()){

    $clientes[] = $row;

}

header('Content-Type: application/json');

echo json_encode($clientes);