<?php

include '../config/conexao.php';

date_default_timezone_set('America/Sao_Paulo');

$hoje = date('Y-m-d');

$inicioMes = date('Y-m-01');

$fimMes = date('Y-m-t');

$retorno = [

    'resumo' => [

        'receber_hoje' => 0,

        'receber_mes' => 0,

        'atrasado' => 0

    ],

    'sinais_pendentes' => [],

    'parcelas_atrasadas' => [],

    'parcelas_mes' => []

];



/*
|--------------------------------------------------------------------------
| SINAIS PENDENTES
|--------------------------------------------------------------------------
*/

$sql = "

SELECT
    c.nome,
    f.valor_sinal,
    os.id AS id_os,
    a.data_hora
FROM financeiro f

INNER JOIN clientes c
    ON c.id = f.id_cliente

INNER JOIN ordem_servico os
    ON os.id = f.id_os

INNER JOIN agendamentos a
    ON a.id = os.id_agendamento

WHERE f.sinal_pago = 0

";

$result = $conn->query($sql);

while($row = $result->fetch_assoc()){

    $retorno['sinais_pendentes'][] = [

        'nome' => $row['nome'],

        'valor' => $row['valor_sinal'],

        'id_os' => $row['id_os'],

    'data_agendamento' => date(
        'd/m/Y H:i',
        strtotime($row['data_hora'])
    )

    ];

}



/*
|--------------------------------------------------------------------------
| PARCELAS ATRASADAS
|--------------------------------------------------------------------------
*/

$sql = "

SELECT

    cr.id,

    cr.numero_parcela,

    cr.valor_parcela,

    cr.data_vencimento,

    c.nome

FROM crediario cr

INNER JOIN financeiro f
    ON f.id = cr.id_financeiro

INNER JOIN clientes c
    ON c.id = f.id_cliente

WHERE

    cr.status = 'Pendente'

    AND

    cr.data_vencimento < CURDATE()

ORDER BY cr.data_vencimento

";

$result = $conn->query($sql);

while($row = $result->fetch_assoc()){

    $retorno['parcelas_atrasadas'][] = [

        'nome' => $row['nome'],

        'parcela' => $row['numero_parcela'],

        'valor' => $row['valor_parcela'],

        'vencimento' => $row['data_vencimento']

    ];

    $retorno['resumo']['atrasado'] +=
        $row['valor_parcela'];

}



/*
|--------------------------------------------------------------------------
| PARCELAS DO MÊS
|--------------------------------------------------------------------------
*/

$sql = "

SELECT

    cr.numero_parcela,

    cr.valor_parcela,

    cr.data_vencimento,

    c.nome

FROM crediario cr

INNER JOIN financeiro f
    ON f.id = cr.id_financeiro

INNER JOIN clientes c
    ON c.id = f.id_cliente

WHERE

    cr.status = 'Pendente'

    AND

    cr.data_vencimento BETWEEN
    '$inicioMes'
    AND
    '$fimMes'

ORDER BY cr.data_vencimento

";

$result = $conn->query($sql);

while($row = $result->fetch_assoc()){

    $retorno['parcelas_mes'][] = [

        'nome' => $row['nome'],

        'parcela' => $row['numero_parcela'],

        'valor' => $row['valor_parcela'],

        'vencimento' => $row['data_vencimento']

    ];

    $retorno['resumo']['receber_mes'] +=
        $row['valor_parcela'];

}



/*
|--------------------------------------------------------------------------
| RECEBER HOJE
|--------------------------------------------------------------------------
*/

$sql = "

SELECT

    SUM(valor_parcela) total

FROM crediario

WHERE

    status = 'Pendente'

    AND

    data_vencimento = CURDATE()

";

$result = $conn->query($sql);

if($row = $result->fetch_assoc()){

    $retorno['resumo']['receber_hoje'] =
        $row['total'] ?? 0;

}



header('Content-Type: application/json');

echo json_encode($retorno);