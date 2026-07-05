<?php

include '../config/conexao.php';

$idCliente =
    $_POST['id_cliente'] ?? '';

$nome =
    $_POST['nome'];

$telefone =
    $_POST['telefone'];

$data = $_POST['data'];
$hora = $_POST['hora'];

$valor = $_POST['valor'];
$sinal = $_POST['sinal'];

$sqlCliente = "
SELECT id
FROM clientes
WHERE telefone = '$telefone'
LIMIT 1
";

$result =
$conn->query($sqlCliente);

if($result->num_rows > 0){

    $cliente =
        $result->fetch_assoc();

    $idCliente =
        $cliente['id'];

}else{

    $conn->query("
    INSERT INTO clientes
    (
        nome,
        telefone,
        status
    )
    VALUES
    (
        '$nome',
        '$telefone',
        'Ativo'
    )
    ");

    $idCliente =
        $conn->insert_id;
}

$dataHora =
    $data . ' ' . $hora . ':00';

$conn->query("
INSERT INTO agendamentos
(
    id_cliente,
    data_hora,
    valor_orcado
)
VALUES
(
    '$idCliente',
    '$dataHora',
    '$valor'
)
");

$idAgendamento =
    $conn->insert_id;

$conn->query("
INSERT INTO ordem_servico
(
    id_cliente,
    id_agendamento,
    status,
    valor_tatuagem
)
VALUES
(
    '$idCliente',
    '$idAgendamento',
    'Agendada',
    '$valor'
)
");

$idOs =
    $conn->insert_id;

$conn->query("
INSERT INTO financeiro
(
    id_cliente,
    id_os,
    valor_orcado,
    valor_sinal,
    valor_final,
    status
)
VALUES
(
    '$idCliente',
    '$idOs',
    '$valor',
    '$sinal',
    '$valor',
    'Pendente'
)
");

echo "Agendamento criado com sucesso";