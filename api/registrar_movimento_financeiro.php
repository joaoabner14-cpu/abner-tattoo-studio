<?php

include '../config/conexao.php';

date_default_timezone_set(
    'America/Sao_Paulo'
);

$id_os =
    intval($_POST['id_os']);

$tipo =
    $_POST['tipo'];

$valor =
    floatval($_POST['valor']);

$forma_pagamento =
    $_POST['forma_pagamento'];

$observacao =
    $_POST['observacao'];

$dataPagamento =
    $_POST['data_pagamento'];

$sql = "

SELECT

    f.id,
    f.id_cliente

FROM financeiro f

WHERE f.id_os = ?

LIMIT 1

";

$stmt =
    $conn->prepare($sql);

$stmt->bind_param(
    "i",
    $id_os
);

$stmt->execute();

$financeiro =
    $stmt
    ->get_result()
    ->fetch_assoc();

if(!$financeiro){

    die(
        'Financeiro não encontrado'
    );
}

$id_financeiro =
    $financeiro['id'];

$id_cliente =
    $financeiro['id_cliente'];

$sql = "

INSERT INTO financeiro_movimentos(

    id_financeiro,
    tipo,
    valor,
    forma_pagamento,
    observacao,
	data_pagamento

)

VALUES(

    ?,
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

    "isdsss",

    $id_financeiro,

    $tipo,

    $valor,

    $forma_pagamento,

    $observacao,

    $dataPagamento

);

$stmt->execute();

if(
    $tipo == 'Pagamento'
){

    $sql = "

    INSERT INTO caixa(

        tipo,
        categoria,
        descricao,
        valor,
        id_cliente,
        id_financeiro,
        id_os,
        forma_pagamento

    )

    VALUES(

        'Entrada',
        'Pagamento',
        ?,
        ?,
        ?,
        ?,
        ?,
        ?

    )

    ";

    $descricao =

        $observacao != ''

        ?

        $observacao

        :

        'Pagamento recebido';

    $stmt =
        $conn->prepare($sql);

    $stmt->bind_param(

        "sdiiis",

        $descricao,

        $valor,

        $id_cliente,

        $id_financeiro,

        $id_os,

        $forma_pagamento

    );

    $stmt->execute();
}

echo 'ok';