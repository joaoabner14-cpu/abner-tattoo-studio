/*
==================================================
ABNER TATTOO STUDIO
ARQUIVO PRINCIPAL DE SCRIPTS
==================================================

ÍNDICE

#1  CALENDÁRIO

#2  LISTA DE AGENDAMENTOS

#3  DASHBOARD FINANCEIRO

#4  ABRIR ORDEM DE SERVIÇO

#5  SALVAR AGENDAMENTO DA OS

#6  CARREGAR MOVIMENTOS FINANCEIROS

#7  SALVAR MOVIMENTO FINANCEIRO

#8  PULL TO REFRESH IOS

#9  SALVAR FINANCEIRO DA OS

#10 RECEBER SINAL

#11 ABRIR AJUSTE DA OS

#12 SALVAR AJUSTE DA OS

#13 CARREGAR AJUSTES FINANCEIROS

#14 CONFIRMAR SINAL PELO DASHBOARD

#15 CARREGAR CLIENTES

#16 BUSCA CLIENTE

#17 SELECIONAR CLIENTE

#18 CARREGAR DADOS CLIENTE

#19 SALVAR CLIENTE

#20 HISTÓRICO DO CLIENTE

#21 FINANCEIRO DO CLIENTE

#26 BUSCA CLIENTE MOBILE

#27 SELECIONAR CLIENTE MOBILE

==================================================
*/

/*
==================================================
#1 CALENDÁRIO
==================================================
*/

document.addEventListener('DOMContentLoaded', function () {

    var calendarEl =
        document.getElementById('calendar');

    var calendar =
        new FullCalendar.Calendar(calendarEl, {

        locale: 'pt-br',

        initialView: 'dayGridMonth',

        height: 'auto',

        events: 'api/listar_agendamentos.php',

        dateClick: function(info){

            $('#data').val(info.dateStr);

            var modal =
                new bootstrap.Modal(
                    document.getElementById('modalAgendamento')
                );

            modal.show();
        }

    });

    calendar.render();

});

/*
==================================================
#2 LISTA DE AGENDAMENTOS
==================================================
*/
async function carregarListaAgendamentos(){

    const resposta =
        await fetch(
            'api/listar_agendamentos.php?tipo=lista'
        );

    const dados =
        await resposta.json();

    let html = '';

    let totalPendentes = 0;

    Object.keys(dados).forEach(data => {

        let conteudoDia = '';

        let pendentesDia = 0;

        dados[data].forEach(item => {

            let botaoWhatsapp = '';

            if(
                item.eh_amanha &&
                !item.cancelado
            ){

                pendentesDia++;

                totalPendentes++;

                botaoWhatsapp = `
                    <a
                        href="${item.link_whatsapp}"
                        target="_blank"
                        class="btn btn-success btn-sm mt-2">

                        🟢 Confirmar Presença

                    </a>
                `;
            }

            let statusHtml = '';

			if(item.cancelado){

				statusHtml = `
					<span
					class="badge ms-2"
					style="
						background:#7f1d1d;
						color:#fecaca;
					">
						${item.status}
					</span>
				`;

			}else{

				statusHtml = `
					<span
					class="badge ms-2"
					style="
						background:#27272a;
						color:#d4d4d8;
					">
						${item.status}
					</span>
				`;
			}

			let nomeExibicao = `
				${item.nome}
				${statusHtml}
			`;

            conteudoDia += `
                <div class="mb-3">

                    <a
                        href="#"
                        class="abrir-os"
                        data-id="${item.id_agendamento}">

                        <strong>${item.hora}</strong>

                        -

                        ${nomeExibicao}

                    </a>

                    <br>

                    ${botaoWhatsapp}

                </div>
            `;

        });

        let badgePendente = '';

        if(pendentesDia > 0){

            badgePendente = `
                <span
                    class="badge bg-warning text-dark ms-2">

                    ${pendentesDia} pendente(s)

                </span>
            `;
        }

        html += `
            <div class="card mb-3">

                <div class="card-header">

                    <strong>${data}</strong>

                    ${badgePendente}

                </div>

                <div class="card-body">

                    ${conteudoDia}

                </div>

            </div>
        `;

    });

    let painelPendencias = '';

    if(totalPendentes > 0){

        painelPendencias = `
            <div class="alert alert-warning">

                <strong>
                    Confirmações Pendentes:
                    ${totalPendentes}
                </strong>

            </div>
        `;
    }

    document
        .getElementById(
            'listaAgendamentos'
        )
        .innerHTML =
            painelPendencias + html;
}

carregarListaAgendamentos();

/*
==================================================
#3 DASHBOARD FINANCEIRO
==================================================
*/
async function carregarFinanceiro(){

    const resposta =
        await fetch(
            'api/financeiro_dashboard.php'
        );

    const dados =
        await resposta.json();

    let html = '';

    html += `

        <div class="card mb-3">

            <div class="card-header">

                Resumo

            </div>

            <div class="card-body">

                <div>

                    💰 Hoje:
                    R$
                    ${Number(
                        dados.resumo.receber_hoje
                    ).toFixed(2)}

                </div>

                <div>

                    📅 Mês:
                    R$
                    ${Number(
                        dados.resumo.receber_mes
                    ).toFixed(2)}

                </div>

                <div>

                    🚨 Atrasado:
                    R$
                    ${Number(
                        dados.resumo.atrasado
                    ).toFixed(2)}

                </div>

            </div>

        </div>

    `;

    html += `

        <div class="card mb-3">

            <div class="card-header">

                Sinais Pendentes

            </div>

            <div class="card-body">

    `;

    dados.sinais_pendentes.forEach(item => {

        html += `

            <div class="border-bottom pb-3 mb-3">

    <div class="d-flex justify-content-between align-items-center">

        <div>

            <strong>

                ${item.nome}

            </strong>

            -

            <small class="text-secondary">

                ${item.data_agendamento}

            </small>

        </div>

        <button
        class="btn btn-success btn-sm confirmar-sinal"
        data-os="${item.id_os}"
        data-valor="${item.valor}">

            Confirmar Sinal

        </button>

    </div>

    <div class="mt-1">

        R$ ${parseFloat(item.valor).toFixed(2)}

    </div>

</div>

        `;

    });

    html += `
            </div>
        </div>
    `;

    html += `

        <div class="card mb-3">

            <div class="card-header">

                Parcelas Atrasadas

            </div>

            <div class="card-body">

    `;

    dados.parcelas_atrasadas.forEach(item => {

        html += `

            <div class="mb-2">

                <strong>
                    ${item.nome}
                </strong>

                <br>

                Parcela
                ${item.parcela}

                -

                R$
                ${item.valor}

            </div>

        `;

    });

    html += `
            </div>
        </div>
    `;

    html += `

        <div class="card">

            <div class="card-header">

                Parcelas do Mês

            </div>

            <div class="card-body">

    `;

    dados.parcelas_mes.forEach(item => {

        html += `

            <div class="mb-2">

                ${item.vencimento}

                <br>

                ${item.nome}

                -

                R$
                ${item.valor}

            </div>

        `;

    });

    html += `
            </div>
        </div>
    `;

    document
        .getElementById(
            'painelFinanceiro'
        )
        .innerHTML = html;
}

carregarFinanceiro();

/*
==================================================
#4 ABRIR ORDEM DE SERVIÇO
==================================================
*/
document.addEventListener(
'click',
async function(e){

    if(
        e.target.closest(
            '.abrir-os'
        )
    ){

        e.preventDefault();

        let id =
            e.target
            .closest('.abrir-os')
            .dataset.id;

        const resposta =
            await fetch(
                'api/ordem_servico.php?acao=abrir&id='
                + id
            );

        const dados =
            await resposta.json();
			
			
			
		document
			.getElementById('id_agendamento')
			.value =
			dados.id_agendamento;

		const dataHora =
			dados.data_hora.split(' ');

		document
			.getElementById('ag_data')
			.value =
			dataHora[0];

		document
			.getElementById('ag_hora')
			.value =
			dataHora[1].substring(0,5);

		document
			.getElementById('ag_status')
			.value =
			dados.status_agendamento;
			
		document
			.getElementById('tituloOS')
			.innerHTML =
			'Ordem de Serviço #' +
			dados.id_os;

        document
            .getElementById('os_nome')
            .value =
            dados.nome ?? '';

        document
            .getElementById('os_telefone')
            .value =
            dados.telefone ?? '';

        document
            .getElementById('os_cidade')
            .value =
            dados.cidade ?? '';

        document
            .getElementById('os_instagram')
            .value =
            dados.instagram ?? '';

        document
            .getElementById('os_cpf')
            .value =
            dados.cpf ?? '';

        document
            .getElementById('os_rg')
            .value =
            dados.rg ?? '';

        document
            .getElementById('os_observacoes')
            .value =
            dados.observacoes ?? '';

        $('#id_os_financeiro')
		.val(
			dados.id_os
		);

		$('#fin_valor_orcado')
		.val(
			dados.valor_orcado ?? 0
		);

		$('#fin_valor_sinal')
		.val(
			dados.valor_sinal ?? 0
		);

		$('#fin_valor_adicional')
		.val(
			dados.valor_adicional ?? 0
		);

		$('#fin_valor_desconto')
		.val(
			dados.valor_desconto ?? 0
		);

		$('#fin_forma_pagamento')
		.val(
			dados.forma_pagamento ?? 'Pix'
		);

		$('#fin_sinal_pago')
		.prop(
			'checked',
			dados.sinal_pago == 1
		);
		
		if(dados.sinal_pago == 1){

			$('#receberSinal')
				.prop('disabled', true)
				.removeClass('btn-success')
				.addClass('btn-secondary')
				.text('Sinal Recebido');

		}else{

			$('#receberSinal')
				.prop('disabled', false)
				.removeClass('btn-secondary')
				.addClass('btn-success')
				.text('Receber Sinal');

		}

		await carregarMovimentosFinanceiros(
			dados.id_os
		);
		
		await carregarAjustesFinanceiros(
			dados.id_os
		);

		atualizarFinanceiroOS();

		new bootstrap.Modal(
			document.getElementById(
				'modalOS'
			)
		).show();
    }

});

/*
==================================================
#5 SALVAR AGENDAMENTO DA OS
==================================================
*/
document.addEventListener('click',async function(e){

    if(
        e.target.id ==
        'salvarAgendamentoOS'
    ){

        const dados =
            new FormData();

        dados.append(
            'id',
            document
            .getElementById(
                'id_agendamento'
            ).value
        );

        dados.append(
            'data',
            document
            .getElementById(
                'ag_data'
            ).value
        );

        dados.append(
            'hora',
            document
            .getElementById(
                'ag_hora'
            ).value
        );

        dados.append(
            'status',
            document
            .getElementById(
                'ag_status'
            ).value
        );

        await fetch(
            'api/agendamentos.php?acao=salvar',
            {
                method:'POST',
                body:dados
            }
        );

        alert(
            'Agendamento atualizado'
        );

        location.reload();

    }

});

/*
==================================================
#6 CARREGAR MOVIMENTOS FINANCEIROS
==================================================
*/
async function carregarMovimentosFinanceiros(id_os){

    const resposta =
        await fetch(
            'api/listar_movimentos_financeiros.php?id_os='
            + id_os
        );

    const movimentos =
        await resposta.json();

    let html = '';

    let totalPago = 0;

    movimentos.forEach(item => {

        if(
            item.tipo ==
            'Pagamento'
        ){

            totalPago +=
                parseFloat(
                    item.valor
                );
        }

        html += `

            <div class="border-bottom pb-2 mb-2">

                <strong>

					${item.tipo}

				</strong>

				-

				R$
				${parseFloat(item.valor).toFixed(2)}

				-

				${item.data_pagamento
					?.split('-')
					.reverse()
					.join('/')
					?? ''
				}

                <br>

                <small>

                    ${item.forma_pagamento ?? ''}

                </small>

                <br>

                <small>

                    ${item.observacao ?? ''}

                </small>

            </div>

        `;

    });

    if(html == ''){

        html =
            'Nenhuma movimentação.';
    }

    $('#historicoFinanceiro')
    .html(html);

    $('#fin_total_pago')
    .text(
        totalPago.toFixed(2)
    );

    $('#fin_total_pago')
    .attr(
        'data-valor',
        totalPago
    );

    atualizarFinanceiroOS();
}

/*
==================================================
#7 SALVAR MOVIMENTO FINANCEIRO
==================================================
*/
document.addEventListener(
'click',
async function(e){

    if(
        e.target.id ==
        'salvarMovimentoFinanceiro'
    ){

        const dados =
            new FormData();

        dados.append(
            'id_os',
            $('#mov_id_os').val()
        );

        dados.append(
            'tipo',
            $('#mov_tipo').val()
        );

        dados.append(
            'valor',
            $('#mov_valor').val()
        );

        dados.append(
            'forma_pagamento',
            $('#mov_forma_pagamento').val()
        );
		
		dados.append(
			'data_pagamento',
			$('#mov_data_pagamento').val()
		);

        dados.append(
            'observacao',
            $('#mov_observacao').val()
        );

        await fetch(
            'api/registrar_movimento_financeiro.php',
            {
                method:'POST',
                body:dados
            }
        );

        bootstrap.Modal
        .getInstance(
            document.getElementById(
                'modalMovimentoFinanceiro'
            )
        )
        .hide();

        await carregarMovimentosFinanceiros(
            $('#id_os_financeiro').val()
        );

        $('#mov_valor').val('');

        $('#mov_observacao').val('');

    }

});

/*
==================================================
#8 PULL TO REFRESH IOS
==================================================
*/
let touchStartY = 0;

let touchEndY = 0;

let puxando = false;

document.addEventListener(
    'touchstart',
    function(e){

        if(window.scrollY === 0){

            touchStartY =
                e.touches[0].clientY;

            puxando = true;
        }

    },
    { passive:true }
);

document.addEventListener(
    'touchmove',
    function(e){

        if(!puxando){
            return;
        }

        touchEndY =
            e.touches[0].clientY;

    },
    { passive:true }
);

document.addEventListener(
    'touchend',
    function(){

        if(!puxando){
            return;
        }

        const distancia =
            touchEndY - touchStartY;

        if(distancia > 200){

    const aviso =
        document.createElement('div');

    aviso.innerHTML =
        'Atualizando...';

    aviso.style.position = 'absolute';
    aviso.style.top = '35px';
    aviso.style.left = '50%';
    aviso.style.transform = 'translateX(-50%)';
    aviso.style.background = '#242424';
    aviso.style.color = '#fff';
    aviso.style.padding = '10px 15px';
    aviso.style.borderRadius = '10px';
    aviso.style.zIndex = '99999';

    document.body.appendChild(aviso);

    setTimeout(() => {

        location.reload();

    }, 300);
}

        puxando = false;

        touchStartY = 0;

        touchEndY = 0;

    }
);

/*
==================================================
#9 SALVAR FINANCEIRO DA OS
==================================================
*/
document.addEventListener('click',async function(e){

    if(
        e.target.id ==
        'salvarFinanceiro'
    ){

        const dados =
            new FormData();

        dados.append(
            'id_os',
            $('#id_os_financeiro').val()
        );

        dados.append(
            'valor_orcado',
            $('#fin_valor_orcado').val()
        );

        dados.append(
            'valor_sinal',
            $('#fin_valor_sinal').val()
        );

        dados.append(
            'valor_adicional',
            $('#fin_valor_adicional').val()
        );

        dados.append(
            'valor_desconto',
            $('#fin_valor_desconto').val()
        );

        dados.append(
            'forma_pagamento',
            $('#fin_forma_pagamento').val()
        );

        await fetch(
            'api/salvar_financeiro.php',
            {
                method:'POST',
                body:dados
            }
        );

        alert(
            'Financeiro atualizado'
        );

    }

});

/*
==================================================
#10 RECEBER SINAL
==================================================
*/
document.addEventListener('click',async function(e){

    if(
        e.target.id ==
        'receberSinal'
    ){

        if(
            !confirm(
                'Confirmar recebimento do sinal?'
            )
        ){
            return;
        }

        const dados =
            new FormData();

        dados.append(
            'id_os',
            $('#id_os_financeiro').val()
        );

        await fetch(
            'api/receber_sinal.php',
            {
                method:'POST',
                body:dados
            }
        );

        $('#fin_sinal_pago')
        .prop(
            'checked',
            true
        );

        alert(
            'Sinal recebido com sucesso'
        );

        carregarFinanceiro();

    }

});

/*
==================================================
#11 ABRIR AJUSTE DA OS
==================================================
*/
document.addEventListener('click',function(e){

    if(
        e.target.id ==
        'abrirAjusteOS'
    ){

        $('#ajuste_id_os')
        .val(
            $('#id_os_financeiro')
            .val()
        );

        new bootstrap.Modal(
            document.getElementById(
                'modalAjusteOS'
            )
        ).show();

    }

});

/*
==================================================
#12 SALVAR AJUSTE DA OS
==================================================
*/
document.addEventListener('click',async function(e){

    if(
        e.target.id ==
        'salvarAjusteOS'
    ){

        const dados =
            new FormData();

        dados.append(
            'id_os',
            $('#ajuste_id_os').val()
        );

        dados.append(
            'tipo',
            $('#ajuste_tipo').val()
        );

        dados.append(
            'valor',
            $('#ajuste_valor').val()
        );

        dados.append(
            'descricao',
            $('#ajuste_descricao').val()
        );

        await fetch(
            'api/registrar_ajuste_financeiro.php',
            {
                method:'POST',
                body:dados
            }
        );

        bootstrap.Modal
        .getInstance(
            document.getElementById(
                'modalAjusteOS'
            )
        )
        .hide();

        $('#ajuste_valor').val('');

        $('#ajuste_descricao').val('');

        await carregarAjustesFinanceiros(
            $('#id_os_financeiro').val()
        );

    }

});

/*
==================================================
#13 CARREGAR AJUSTES FINANCEIROS
==================================================
*/
async function carregarAjustesFinanceiros(id_os){

    const resposta =
        await fetch(
            'api/listar_ajustes_financeiros.php?id_os='
            + id_os
        );

    const ajustes =
        await resposta.json();

    let html = '';

    let totalAcrescimo = 0;

    let totalDesconto = 0;

    ajustes.forEach(item => {

        if(
            item.tipo ==
            'Acrescimo'
        ){

            totalAcrescimo +=
                parseFloat(
                    item.valor
                );

        }else{

            totalDesconto +=
                parseFloat(
                    item.valor
                );
        }

        html += `

            <div class="border-bottom pb-2 mb-2">

                <strong>

                    ${item.tipo}

                </strong>

                -

                R$
                ${parseFloat(
                    item.valor
                ).toFixed(2)}

                <br>

                <small>

                    ${item.descricao ?? ''}

                </small>

            </div>

        `;
    });

    if(html == ''){

        html =
            'Nenhum ajuste registrado.';
    }

    $('#historicoAjustes')
    .html(html);
	

    $('#fin_valor_adicional')
    .val(
        totalAcrescimo.toFixed(2)
    );

    $('#fin_valor_desconto')
    .val(
        totalDesconto.toFixed(2)
    );

    atualizarFinanceiroOS();
}

/*
==================================================
#14 CONFIRMAR SINAL PELO DASHBOARD
==================================================
*/
$(document).on('click','.confirmar-sinal',function(){

    $('#mov_id_os')
    .val(
        $(this).data('os')
    );

    $('#mov_tipo')
    .val(
        'Pagamento'
    );

    $('#mov_valor')
    .val(
        $(this).data('valor')
    );

    $('#mov_observacao')
    .val(
        'Sinal'
    );

    $('#mov_data_pagamento')
    .val(
        new Date()
        .toISOString()
        .split('T')[0]
    );

    new bootstrap.Modal(
        document.getElementById(
            'modalMovimentoFinanceiro'
        )
    ).show();

});

let clienteAtual = null;

/*
==================================================
#15 CARREGAR CLIENTES
==================================================
*/
async function carregarClientes(
    termo = ''
){

    const resposta =
        await fetch(
            'api/listar_clientes.php?busca=' +
            encodeURIComponent(
                termo
            )
        );

    const clientes =
        await resposta.json();

    let html = '';

    let htmlMobile = `

        <option value="">

            Selecione um cliente

        </option>

    `;

    clientes.forEach(cliente => {

        html += `

            <a
            href="#"
            class="list-group-item list-group-item-action selecionar-cliente"
            data-id="${cliente.id}">

                ${cliente.nome}

            </a>

        `;

        htmlMobile += `

            <option value="${cliente.id}">

                ${cliente.nome}

            </option>

        `;

    });

    $('#listaClientes')
    .html(html);

    $('#clienteMobile')
    .html(htmlMobile);

}

$(document).on(
'change',
'#clienteMobile',
function(){

    let id =
        $(this).val();

    if(id){

        carregarCliente(id);

    }

});

/*
==================================================
#16 BUSCA CLIENTE
==================================================
*/
$(document).on(
'keyup',
'#buscarCliente',
function(){

    carregarClientes(
        $(this).val()
    );

});

/*
==================================================
#17 SELECIONAR CLIENTE
==================================================
*/
$(document).on(
'click',
'.selecionar-cliente',
async function(e){

    e.preventDefault();

    clienteAtual =
        $(this).data('id');

    carregarCliente(
        clienteAtual
    );

});

/*
==================================================
#18 CARREGAR DADOS CLIENTE
==================================================
*/
async function carregarCliente(
    id
){

    const resposta =
        await fetch(
            'api/detalhes_cliente.php?id='
            + id
        );

    const cliente =
        await resposta.json();

    let html = `

        <div class="card">

            <div class="card-header">

                <ul
                class="nav nav-tabs card-header-tabs">

                    <li class="nav-item">

                        <button
                        class="nav-link active"
                        data-bs-toggle="tab"
                        data-bs-target="#cliente_dados">

                            Dados

                        </button>

                    </li>

                    <li class="nav-item">

                        <button
                        class="nav-link"
                        data-bs-toggle="tab"
                        data-bs-target="#cliente_historico">

                            Histórico de Atendimentos

                        </button>

                    </li>

                    <li class="nav-item">

                        <button
                        class="nav-link"
                        data-bs-toggle="tab"
                        data-bs-target="#cliente_financeiro">

                            Financeiro

                        </button>

                    </li>

                    <li class="nav-item">

                        <button
                        class="nav-link"
                        data-bs-toggle="tab"
                        data-bs-target="#cliente_tattoos">

                            Tattoos

                        </button>

                    </li>

                    <li class="nav-item">

                        <button
                        class="nav-link"
                        data-bs-toggle="tab"
                        data-bs-target="#cliente_fotos">

                            Fotos

                        </button>

                    </li>

                </ul>

            </div>

            <div class="card-body">

                <div class="tab-content">

                    <!-- DADOS -->

                    <div
                    class="tab-pane fade show active"
                    id="cliente_dados">

                        <div
                        class="tab-pane fade show active"
                        id="cliente_dados">

                            <input
                            type="hidden"
                            id="cliente_id"
                            value="${cliente.id}">

                            <div class="card mb-3">

                                <div class="card-body">

                                    <h4>

                                        ${cliente.nome ?? ''}

                                    </h4>

                                    <div class="text-secondary">

                                        Cliente desde:
                                        ${cliente.data_cadastro ?? '-'}

                                    </div>

                                </div>

                            </div>

                            <div class="row">

                                <div class="col-md-6 mb-3">

                                    <label>Nome</label>

                                    <input
                                    type="text"
                                    id="cliente_nome"
                                    class="form-control"
                                    value="${cliente.nome ?? ''}">

                                </div>

                                <div class="col-md-6 mb-3">

                                    <label>Telefone</label>

                                    <input
                                    type="text"
                                    id="cliente_telefone"
                                    class="form-control"
                                    value="${cliente.telefone ?? ''}">

                                </div>

                            </div>

                            <div class="row">

                                <div class="col-md-6 mb-3">

                                    <label>Cidade</label>

                                    <input
                                    type="text"
                                    id="cliente_cidade"
                                    class="form-control"
                                    value="${cliente.cidade ?? ''}">

                                </div>

                                <div class="col-md-6 mb-3">

                                    <label>Instagram</label>

                                    <input
                                    type="text"
                                    id="cliente_instagram"
                                    class="form-control"
                                    value="${cliente.instagram ?? ''}">

                                </div>

                            </div>

                            <div class="row">

                                <div class="col-md-6 mb-3">

                                    <label>CPF</label>

                                    <input
                                    type="text"
                                    id="cliente_cpf"
                                    class="form-control"
                                    value="${cliente.cpf ?? ''}">

                                </div>

                                <div class="col-md-6 mb-3">

                                    <label>RG</label>

                                    <input
                                    type="text"
                                    id="cliente_rg"
                                    class="form-control"
                                    value="${cliente.rg ?? ''}">

                                </div>

                            </div>

                            <div class="mb-3">

                                <label>Data de Nascimento</label>

                                <input
                                type="date"
                                id="cliente_data_nascimento"
                                class="form-control"
                                value="${cliente.data_nascimento ?? ''}">

                            </div>

                            <div class="mb-3">

                                <label>Observações</label>

                                <textarea
                                id="cliente_observacoes"
                                class="form-control"
                                rows="6">${cliente.observacoes ?? ''}</textarea>

                            </div>

                            <button
                            id="salvarCliente"
                            class="btn btn-success">

                                Salvar Cadastro

                            </button>

                        </div>

                    </div>

                    <!-- HISTÓRICO -->

                    <div
                    class="tab-pane fade"
                    id="cliente_historico">

                        Carregando histórico...

                    </div>

                    <!-- FINANCEIRO -->

                    <div
                    class="tab-pane fade"
                    id="cliente_financeiro">

                        Carregando financeiro...

                    </div>

                    <!-- TATTOOS -->

                    <div
                    class="tab-pane fade"
                    id="cliente_tattoos">

                        Em desenvolvimento

                    </div>

                    <!-- FOTOS -->

                    <div
                    class="tab-pane fade"
                    id="cliente_fotos">

                        Em desenvolvimento

                    </div>

                </div>

            </div>

        </div>

    `;

    $('#painelCliente')
    .html(html);

    carregarHistoricoCliente(id);

    carregarFinanceiroCliente(id);

}

/*
==================================================
INICIAR
==================================================
*/

carregarClientes();

/*
==================================================
#19 SALVAR CLIENTE
==================================================
*/

$(document).on(
'click',
'#salvarCliente',
async function(){

    let formData =
        new FormData();

    formData.append(
        'id',
        $('#cliente_id').val()
    );

    formData.append(
        'nome',
        $('#cliente_nome').val()
    );

    formData.append(
        'telefone',
        $('#cliente_telefone').val()
    );

    formData.append(
        'cidade',
        $('#cliente_cidade').val()
    );

    formData.append(
        'instagram',
        $('#cliente_instagram').val()
    );

    formData.append(
        'cpf',
        $('#cliente_cpf').val()
    );

    formData.append(
        'rg',
        $('#cliente_rg').val()
    );

    formData.append(
        'data_nascimento',
        $('#cliente_data_nascimento').val()
    );

    formData.append(
        'observacoes',
        $('#cliente_observacoes').val()
    );

    const resposta =
        await fetch(
            'api/salvar_cliente.php',
            {
                method:'POST',
                body:formData
            }
        );

    const retorno =
        await resposta.text();

    if(
        retorno == 'ok'
    ){

        alert(
            'Cadastro atualizado!'
        );

        carregarClientes();

    }

});

/*
==================================================
#20 HISTÓRICO DO CLIENTE
==================================================
*/
async function carregarHistoricoCliente(id){

    const resposta =
        await fetch(
            'api/historico_cliente.php?id='
            + id
        );

    const dados =
        await resposta.json();

    let html = '';

    dados.forEach(item => {

        html += `

        <div
        class="border-bottom pb-2 mb-2">

            <strong>

                ${item.tipo}

            </strong>

            <br>

            <small>

                ${item.data}

            </small>

            <br>

            ${item.descricao}

        </div>

        `;

    });

    $('#cliente_historico')
    .html(html);

}

/*
==================================================
#21 FINANCEIRO DO CLIENTE
==================================================
*/
async function carregarFinanceiroCliente(id){

    const resposta =
        await fetch(
            'api/financeiro_cliente.php?id='
            + id
        );

    const financeiro =
        await resposta.json();

    let saldo =

        financeiro.orcado -

        (
            financeiro.pago -

            financeiro.estornado
        );

    $('#cliente_financeiro').html(`

        <div class="row">

            <div class="col-md-4">

                <div class="card">

                    <div class="card-body">

                        <h5>

                            Total Orçado

                        </h5>

                        <h3>

                            R$
                            ${financeiro.orcado.toFixed(2)}

                        </h3>

                    </div>

                </div>

            </div>

            <div class="col-md-4">

                <div class="card">

                    <div class="card-body">

                        <h5>

                            Total Pago

                        </h5>

                        <h3>

                            R$
                            ${financeiro.pago.toFixed(2)}

                        </h3>

                    </div>

                </div>

            </div>

            <div class="col-md-4">

                <div class="card">

                    <div class="card-body">

                        <h5>

                            Saldo Aberto

                        </h5>

                        <h3>

                            R$
                            ${saldo.toFixed(2)}

                        </h3>

                    </div>

                </div>

            </div>

        </div>

    `);

}

/*
==================================================
#26 BUSCA CLIENTE MOBILE
==================================================
*/

$(document).on(
'keyup',
'#buscaClienteMobile',
async function(){

    let busca =
        $(this).val();

    if(
        busca.length < 2
    ){

        $('#resultadoClienteMobile')
        .html('');

        return;
    }

    const resposta =
        await fetch(
            'api/listar_clientes.php?busca=' +
            encodeURIComponent(
                busca
            )
        );

    const clientes =
        await resposta.json();

    let html = '';

    clientes.forEach(cliente => {

        html += `

            <a
            href="#"
            class="list-group-item list-group-item-action selecionar-cliente-mobile"
            data-id="${cliente.id}">

                ${cliente.nome}

            </a>

        `;

    });

    $('#resultadoClienteMobile')
    .html(html);

});

/*
==================================================
#27 SELECIONAR CLIENTE MOBILE
==================================================
*/

$(document).on(
'click',
'.selecionar-cliente-mobile',
function(e){

    e.preventDefault();

    let id =
        $(this).data('id');

    carregarCliente(id);

    $('#buscaClienteMobile')
    .val(
        $(this).text().trim()
    );

    $('#resultadoClienteMobile')
    .html('');

});