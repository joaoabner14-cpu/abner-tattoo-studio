<?php include 'includes/header.php'; ?>

<div id="calendar"></div>



<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>

<script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.15/index.global.min.js"></script>

<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>


<?php include 'includes/modal_agendamento.php'; ?>
<?php include 'includes/modal_os.php'; ?>
<?php include 'includes/modal_movimento_financeiro.php'; ?>
<?php include 'includes/modal_ajuste_os.php'; ?>

<div class="container-fluid mt-4">

    <div class="row">

        <div class="col-lg-6">

            <h4>
                Próximos Agendamentos
            </h4>

            <div id="listaAgendamentos"></div>

        </div>

        <div class="col-lg-6">

            <h4>
                Financeiro
            </h4>

            <div id="painelFinanceiro"></div>

        </div>

    </div>

</div>

<?php include 'includes/footer.php'; ?>