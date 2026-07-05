<?php include 'includes/header.php'; ?>

<div class="container-fluid py-3">

    <div class="row">

        <!-- LISTA CLIENTES -->

        <div class="d-md-none mb-3">

            <label>

                Pesquisar Cliente

            </label>

            <input
            type="text"
            id="buscaClienteMobile"
            class="form-control"
            placeholder="Digite o nome">

            <div
            id="resultadoClienteMobile"
            class="list-group mt-2">
            </div>

        </div>

        <div class="col-md-3 d-none d-md-block">

            <div class="card h-100">

                <div class="card-header">

                    Clientes

                </div>

                <div class="card-body">

                    <input
                    type="text"
                    id="buscarCliente"
                    class="form-control mb-3"
                    placeholder="Pesquisar cliente...">

                    <div
                    id="listaClientes"
                    class="list-group">

                        <div
                        class="text-secondary text-center py-3">

                            Carregando...

                        </div>

                    </div>

                </div>

            </div>

        </div>

        <!-- DADOS CLIENTE -->

        <div class="col-md-9">

            <div
            id="painelCliente">

                <div class="card">

                    <div class="card-body text-center text-secondary" id="painelSelecioneCliente">

                        Selecione um cliente

                    </div>

                </div>

            </div>

        </div>

    </div>

</div>

<?php include 'includes/footer.php'; ?>