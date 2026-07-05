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

		atualizarFinanceiroOS();

        new bootstrap.Modal(
            document.getElementById(
                'modalOS'
            )
        ).show();
    }

});