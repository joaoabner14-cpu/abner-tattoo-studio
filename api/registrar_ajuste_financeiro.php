<?php

include '../config/conexao.php';

$id_os = intval($_POST['id_os']);

$tipo = $_POST['tipo'];

$valor = floatval($_POST['valor']);

$descricao = $_POST['descricao'];

$sql = "
SELECT
    id
FROM financeiro
WHERE id_os = ?
LIMIT 1
";

$stmt = $conn->prepare($sql);

$stmt->bind_param(
    "i",
    $id_os
);

$stmt->execute();

$result =
    $stmt
    ->get_result()
    ->fetch_assoc();

if(!$result){

    die(
        'Financeiro não encontrado'
    );
}

$id_financeiro =
    $result['id'];

$sql = "

INSERT INTO financeiro_ajustes(

    id_financeiro,
    tipo,
    valor,
    descricao

)

VALUES(

    ?,
    ?,
    ?,
    ?

)

";

$stmt =
    $conn->prepare($sql);

$stmt->bind_param(

    "isds",

    $id_financeiro,

    $tipo,

    $valor,

    $descricao

);

$stmt->execute();

echo 'ok';