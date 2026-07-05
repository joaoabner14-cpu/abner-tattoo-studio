<?php

include '../config/conexao.php';

date_default_timezone_set('America/Sao_Paulo');

$tipo = $_GET['tipo'] ?? 'calendario';

$sql = "
SELECT
    a.id,
    a.data_hora,
    a.status,
    c.nome,
    c.telefone
FROM agendamentos a
INNER JOIN clientes c
    ON c.id = a.id_cliente
ORDER BY a.data_hora
";

$result = $conn->query($sql);

if($tipo == 'lista'){

    $dados = [];

    $hoje = date('Y-m-d');

    $amanha = date(
        'Y-m-d',
        strtotime('+1 day')
    );

    while($row = $result->fetch_assoc()){

        $dataAgendamento = date(
            'Y-m-d',
            strtotime($row['data_hora'])
        );

        // NÃO MOSTRA AGENDAMENTOS PASSADOS NA LISTA
        if($dataAgendamento < $hoje){
            continue;
        }

        $data = date(
            'd/m/Y',
            strtotime($row['data_hora'])
        );

        $hora = date(
            'H:i',
            strtotime($row['data_hora'])
        );

        $telefone = preg_replace(
            '/[^0-9]/',
            '',
            $row['telefone']
        );

        $dataHoraFormatada = date(
            'd/m/Y H:i',
            strtotime($row['data_hora'])
        );

        $mensagem = urlencode(
            "Olá tudo bem?

Você possui uma sessão de tatuagem agendada no Abner Tattoo Studio dia *{$dataHoraFormatada}*.

Vou te passar um pequeno preparo para esse dia.

Confirme sua presença respondendo SIM.

Responda NÃO para cancelar ou solicite um REAGENDAMENTO.

1- hidratação é muito importante, mantenha-se hidratada bebendo água regularmente 💧

2- comece a passar hidratante na região onde será feita a tatuagem, uma pele bem hidratada pigmentará melhor e doerá bem menos 😉

3- alimente-se antes da sessão, é ideal que esteja bem para que a tatuagem fique linda 🤩"
        );

        $linkWhatsapp =
            "https://wa.me/55{$telefone}?text={$mensagem}";

        $dados[$data][] = [

            'id_agendamento' => $row['id'],

            'hora' => $hora,

            'nome' => $row['nome'],

            'status' => $row['status'],

            'cancelado' => (
                strtolower($row['status']) == 'cancelado'
            ),

            'eh_amanha' => (
                $dataAgendamento == $amanha
            ),

            'link_whatsapp' => $linkWhatsapp

        ];
    }

    header('Content-Type: application/json');

    echo json_encode($dados);

    exit;
}

/*
|--------------------------------------------------------------------------
| CALENDÁRIO
|--------------------------------------------------------------------------
| Mostra histórico completo, exceto cancelados
|--------------------------------------------------------------------------
*/

$result = $conn->query($sql);

$eventos = [];

while($row = $result->fetch_assoc()){

    if(
        strtolower($row['status']) == 'cancelado'
    ){
        continue;
    }

    $eventos[] = [

        'id' => $row['id'],

        'title' => $row['nome'],

        'start' => $row['data_hora']

    ];
}

header('Content-Type: application/json');

echo json_encode($eventos);