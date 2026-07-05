<div
class="modal fade"
id="modalOS">

<div
class="modal-dialog modal-lg">

<div
class="modal-content">

<div
class="modal-header">

<h5 id="tituloOS">
Ordem de Serviço
</h5>

<button
type="button"
class="btn-close"
data-bs-dismiss="modal">
</button>

</div>

<div
class="modal-body">

<ul
class="nav nav-tabs">

<li class="nav-item">

<button
class="nav-link active"
data-bs-toggle="tab"
data-bs-target="#dados">

Dados

</button>

</li>

<li class="nav-item">

<button
class="nav-link"
data-bs-toggle="tab"
data-bs-target="#tattoo">

Tattoo

</button>

</li>

<li class="nav-item">

<button
class="nav-link"
data-bs-toggle="tab"
data-bs-target="#agendamento">

Agendamento

</button>

</li>

<li class="nav-item">

<button
class="nav-link"
data-bs-toggle="tab"
data-bs-target="#financeiro">

Financeiro

</button>

</li>

</ul>

<div
class="tab-content mt-3">

<!-- DADOS -->

<div
class="tab-pane fade show active"
id="dados">

<input
type="hidden"
id="id_cliente">

<div class="mb-2">

<label>Nome</label>

<input
type="text"
id="os_nome"
class="form-control">

</div>

<div class="mb-2">

<label>Telefone</label>

<input
type="text"
id="os_telefone"
class="form-control">

</div>

<div class="mb-2">

<label>Cidade</label>

<input
type="text"
id="os_cidade"
class="form-control">

</div>

<div class="mb-2">

<label>Instagram</label>

<input
type="text"
id="os_instagram"
class="form-control">

</div>

<div class="mb-2">

<label>CPF</label>

<input
type="text"
id="os_cpf"
class="form-control">

</div>

<div class="mb-2">

<label>RG</label>

<input
type="text"
id="os_rg"
class="form-control">

</div>

<div class="mb-2">

<label>Observações</label>

<textarea
id="os_observacoes"
class="form-control"></textarea>

</div>

<button
class="btn btn-primary">

Salvar Cadastro

</button>

</div>

<!-- TATTOO -->

<div
class="tab-pane fade"
id="tattoo">

<p>

Área reservada para:

<br><br>

Descrição

<br>

Insumos

<br>

Mistura de Cores

<br>

Fotos

<br>

Anamnese

</p>

</div>

<!-- AGENDAMENTO -->

<div
class="tab-pane fade"
id="agendamento">

<input
type="hidden"
id="id_agendamento">

<div class="mb-3">

<label>Data</label>

<input
type="date"
id="ag_data"
class="form-control">

</div>

<div class="mb-3">

<label>Hora</label>

<input
type="time"
id="ag_hora"
class="form-control">

</div>

<div class="mb-3">

<label>Status</label>

<select
id="ag_status"
class="form-select">

<option value="Agendado">
Agendado
</option>

<option value="Confirmado">
Confirmado
</option>

<option value="Em Atendimento">
Em Atendimento
</option>

<option value="Finalizado">
Finalizado
</option>

<option value="Cancelado">
Cancelado
</option>

<option value="Remarcado">
Remarcado
</option>

</select>

</div>

<button
id="salvarAgendamentoOS"
class="btn btn-primary">

Salvar Alterações

</button>

</div>

<!-- FINANCEIRO -->

<div
class="tab-pane fade"
id="financeiro">

<input
type="hidden"
id="id_os_financeiro">

<div class="row">

<div class="col-6 mb-3">

<label>Valor Orçado</label>

<input
type="number"
step="0.01"
id="fin_valor_orcado"
class="form-control">

</div>

<div class="col-6 mb-3">

<label>Valor Sinal</label>

<input
type="number"
step="0.01"
id="fin_valor_sinal"
class="form-control">

</div>

</div>

<div class="row">

<div class="col-6 mb-3">

<input
type="hidden"
step="0.01"
id="fin_valor_adicional"
class="form-control"
value="0">

</div>

<div class="col-6 mb-3">

<input
type="hidden"
step="0.01"
id="fin_valor_desconto"
class="form-control"
value="0">

</div>

</div>

<div class="mb-3">

<label>Forma de Pagamento Padrão</label>

<select
id="fin_forma_pagamento"
class="form-select">

<option value="Pix">
PIX
</option>

<option value="Dinheiro">
Dinheiro
</option>

<option value="Debito">
Débito
</option>

<option value="Credito">
Crédito
</option>

</select>

</div>

<hr>

<div class="card mb-3">

<div class="card-body">

<div class="row">

<div class="col-4">

<strong>
Valor Final
</strong>

<h5>

R$

<span id="fin_valor_final">

0.00

</span>

</h5>

</div>

<div class="col-4">

<strong>
Total Pago
</strong>

<h5 class="text-success">

R$

<span
id="fin_total_pago"
data-valor="0">

0.00

</span>

</h5>

</div>

<div class="col-4">

<strong>
Saldo Restante
</strong>

<h5 class="text-warning">

R$

<span id="fin_saldo_restante">

0.00

</span>

</h5>

</div>

</div>

<div class="mt-3">

<span
id="statusSinal"
class="badge bg-secondary">

Sinal não recebido

</span>

</div>

</div>

</div>

<div
class="d-flex gap-2 flex-wrap mb-3">

<button
id="salvarFinanceiro"
class="btn btn-primary">

Salvar Financeiro

</button>

<button
id="abrirMovimentoFinanceiro"
class="btn btn-success">

Registrar Pagamento

</button>

<button
id="abrirAjusteOS"
class="btn btn-info">

Acréscimo / Desconto

</button>

<button
id="finalizarOS"
class="btn btn-warning">

Finalizar OS

</button>

</div>

<div class="card">

<div class="card mb-3">

    <div class="card-header">

        Ajustes da OS

    </div>

    <div
    class="card-body"
    id="historicoAjustes">

        Nenhum ajuste registrado.

    </div>

</div>

<div class="card-header">

Histórico Financeiro

</div>

<div
class="card-body"
id="historicoFinanceiro">

Nenhuma movimentação.

</div>

</div>

</div>

</div>

</div>

</div>

</div>

</div>

<script>

function atualizarFinanceiroOS(){

    let orcado = parseFloat(
        $('#fin_valor_orcado').val()
    ) || 0;

    let adicional = parseFloat(
        $('#fin_valor_adicional').val()
    ) || 0;

    let desconto = parseFloat(
        $('#fin_valor_desconto').val()
    ) || 0;

    let valorSinal = parseFloat(
        $('#fin_valor_sinal').val()
    ) || 0;

    let totalPago = parseFloat(
        $('#fin_total_pago')
        .attr('data-valor')
    ) || 0;

    let valorFinal =

        orcado +

        adicional -

        desconto;

    let saldo =

        valorFinal -

        totalPago;

    $('#fin_valor_final')
    .text(
        valorFinal.toFixed(2)
    );

    $('#fin_saldo_restante')
    .text(
        saldo.toFixed(2)
    );

    if(
        totalPago >= valorSinal
        &&
        valorSinal > 0
    ){

        $('#statusSinal')
        .removeClass(
            'bg-secondary'
        )
        .addClass(
            'bg-success'
        )
        .text(
            'Sinal Recebido'
        );

    }else{

        $('#statusSinal')
        .removeClass(
            'bg-success'
        )
        .addClass(
            'bg-secondary'
        )
        .text(
            'Sinal não recebido'
        );
    }
}

$(document).on(

'keyup change',

'#fin_valor_orcado,#fin_valor_sinal,#fin_valor_adicional,#fin_valor_desconto',

atualizarFinanceiroOS

);

document.addEventListener(
'click',
function(e){

    if(
        e.target.id ==
        'abrirMovimentoFinanceiro'
    ){

        $('#mov_id_os')
        .val(
            $('#id_os_financeiro')
            .val()
        );

        new bootstrap.Modal(
            document.getElementById(
                'modalMovimentoFinanceiro'
            )
        ).show();
    }

});

</script>