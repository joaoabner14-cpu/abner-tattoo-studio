<?php

include '../config/conexao.php';

date_default_timezone_set(
    'America/Sao_Paulo'
);

$id_os =
    $_POST['id_os'];

$sql = "

SELECT

f.*,

o.id_cliente

FROM financeiro f

INNER JOIN ordem_servico o

ON o.id = f.id_os

WHERE f.id_os = ?

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

$financeiro =
    $result->fetch_assoc();

if(!$financeiro){

    die('Financeiro não encontrado');

}

$sql = "

UPDATE financeiro

SET

sinal_pago = 1,

data_pagamento_sinal = NOW()

WHERE id_os = ?

";

$stmt =
    $conn->prepare($sql);

$stmt->bind_param(
    "i",
    $id_os
);

$stmt->execute();

$sql = "

INSERT INTO caixa (

tipo,

categoria,

descricao,

valor,

id_cliente,

id_financeiro,

id_os,

forma_pagamento

)

VALUES (

'Entrada',

'Sinal',

'Recebimento de sinal',

?,

?,

?,

?,

?

)

";

$stmt =
    $conn->prepare($sql);

$stmt->bind_param(

    "diiis",

    $financeiro['valor_sinal'],

    $financeiro['id_cliente'],

    $financeiro['id'],

    $id_os,

    $financeiro['forma_pagamento']

);

$stmt->execute();

echo 'ok';