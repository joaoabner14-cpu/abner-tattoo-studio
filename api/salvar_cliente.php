<?php

include '../config/conexao.php';

$id =
    intval(
        $_POST['id']
    );

$nome =
    $_POST['nome'];

$telefone =
    $_POST['telefone'];

$cidade =
    $_POST['cidade'];

$instagram =
    $_POST['instagram'];

$cpf =
    $_POST['cpf'];

$rg =
    $_POST['rg'];

$data_nascimento =
    $_POST['data_nascimento'];

$observacoes =
    $_POST['observacoes'];

$sql = "

UPDATE clientes

SET

    nome = ?,
    telefone = ?,
    cidade = ?,
    instagram = ?,
    cpf = ?,
    rg = ?,
    data_nascimento = ?,
    observacoes = ?

WHERE id = ?

";

$stmt =
    $conn->prepare($sql);

$stmt->bind_param(

    "ssssssssi",

    $nome,
    $telefone,
    $cidade,
    $instagram,
    $cpf,
    $rg,
    $data_nascimento,
    $observacoes,
    $id

);

$stmt->execute();

echo 'ok';