<?php

include '../config/conexao.php';

$acao = $_GET['acao'] ?? '';

if($acao == 'salvar'){

    $id =
        intval($_POST['id']);

    $data =
        $_POST['data'];

    $hora =
        $_POST['hora'];

    $status =
        $_POST['status'];

    $dataHora =
        $data . ' ' . $hora . ':00';

    $sql = "
    UPDATE agendamentos
    SET

        data_hora = '{$dataHora}',

        status = '{$status}'

    WHERE id = {$id}
    ";

    $conn->query($sql);

    echo 'OK';

    exit;
}