<div
class="modal fade"
id="modalMovimentoFinanceiro">

<div
class="modal-dialog">

<div
class="modal-content">

<div class="modal-header">

<h5>

Registrar Movimento

</h5>

<button
type="button"
class="btn-close"
data-bs-dismiss="modal">
</button>

</div>

<div class="modal-body">

<input
type="hidden"
id="mov_id_os">

<div class="mb-3">

<label>Tipo</label>

<select
id="mov_tipo"
class="form-select">

<option value="Pagamento">
Pagamento
</option>

<option value="Estorno">
Estorno
</option>

</select>

</div>

<div class="mb-3">

<label>Valor</label>

<input
type="number"
step="0.01"
id="mov_valor"
class="form-control">

</div>

<div class="mb-3">

<label>Forma de Pagamento</label>

<select
id="mov_forma_pagamento"
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

<div class="mb-3">

    <label>Data do Pagamento</label>

    <input
    type="date"
    id="mov_data_pagamento"
    class="form-control"
    value="<?php echo date('Y-m-d'); ?>">

</div>

<div class="mb-3">

<label>Observação</label>

<textarea
id="mov_observacao"
class="form-control"></textarea>

</div>

</div>

<div class="modal-footer">

<button
id="salvarMovimentoFinanceiro"
class="btn btn-success">

Salvar Movimento

</button>

</div>

</div>

</div>

</div>