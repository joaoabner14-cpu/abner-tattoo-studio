<div class="modal fade"
     id="modalAgendamento">

<div class="modal-dialog">

<div class="modal-content">

<div class="modal-header">

<h5>Novo Agendamento</h5>

<button
type="button"
class="btn-close"
data-bs-dismiss="modal">
</button>

</div>

<div class="modal-body">

<form id="formAgendamento">

<input
type="hidden"
id="data"
name="data">

<input
type="hidden"
id="id_cliente"
name="id_cliente">

<div class="mb-3">

<label>Nome</label>

<input
type="text"
id="nome"
name="nome"
class="form-control"
autocomplete="off"
required>

<div
id="listaClientes"
class="list-group mt-2">
</div>

</div>

<div class="mb-3">

<label>Telefone</label>

<input
type="text"
name="telefone"
class="form-control"
required>

</div>

<div class="mb-3">

<label>Horário</label>

<input
type="time"
name="hora"
class="form-control"
required>

</div>

<div class="mb-3">

<label>Valor Orçado</label>

<input
type="number"
step="0.01"
name="valor"
class="form-control">

</div>

<div class="mb-3">

<label>Sinal</label>

<input
type="number"
step="0.01"
name="sinal"
class="form-control">

</div>

</form>

</div>

<div class="modal-footer">

<button
id="salvarAgendamento"
class="btn btn-primary">

Salvar

</button>

</div>

</div>

</div>

</div>

<script>

document
.getElementById('salvarAgendamento')
.addEventListener('click', async function(){

    const form =
        document.getElementById('formAgendamento');

    const dados =
        new FormData(form);

    try {

        const resposta =
            await fetch(
                'api/cadastrar_agendamento.php',
                {
                    method:'POST',
                    body:dados
                }
            );

        const texto =
            await resposta.text();

        alert(texto);

        location.reload();

    } catch(erro){

        console.error(erro);

        alert('Erro ao salvar.');

    }

});
</script>

<script>

document
.getElementById('nome')
.addEventListener('keyup', async function(){

    const termo = this.value;

    if(termo.length < 2){

        document
            .getElementById('listaClientes')
            .innerHTML = '';

        return;
    }

    const resposta =
        await fetch(
            'api/buscar_clientes.php?termo=' +
            encodeURIComponent(termo)
        );

    const clientes =
        await resposta.json();

    let html = '';

    clientes.forEach(cliente => {

        html += `
            <a href="#"
               class="list-group-item cliente-item"
               data-id="${cliente.id}"
               data-nome="${cliente.nome}"
               data-telefone="${cliente.telefone}">
               ${cliente.nome}
            </a>
        `;

    });

    document
        .getElementById('listaClientes')
        .innerHTML = html;

});
</script>

<script>

document.addEventListener(
'click',
function(e){

    if(
        e.target.classList.contains(
            'cliente-item'
        )
    ){

        e.preventDefault();

        document
            .getElementById('id_cliente')
            .value =
            e.target.dataset.id;

        document
            .getElementById('nome')
            .value =
            e.target.dataset.nome;

        document
            .querySelector(
                'input[name="telefone"]'
            )
            .value =
            e.target.dataset.telefone;

        document
            .getElementById(
                'listaClientes'
            )
            .innerHTML = '';

    }

});
</script>
<script>

document
.getElementById('modalAgendamento')
.addEventListener(
    'hidden.bs.modal',
    function(){

        document
            .getElementById('formAgendamento')
            .reset();

        document
            .getElementById('id_cliente')
            .value = '';

        document
            .getElementById('listaClientes')
            .innerHTML = '';

    }
);

</script>