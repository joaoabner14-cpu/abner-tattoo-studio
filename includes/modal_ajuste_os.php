<div
class="modal fade"
id="modalAjusteOS">

<div class="modal-dialog">

<div class="modal-content">

<div class="modal-header">

<h5>

Registrar Ajuste

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
id="ajuste_id_os">

<div class="mb-3">

<label>Tipo</label>

<select
id="ajuste_tipo"
class="form-select">

<option value="Acrescimo">
Acréscimo
</option>

<option value="Desconto">
Desconto
</option>

</select>

</div>

<div class="mb-3">

<label>Valor</label>

<input
type="number"
step="0.01"
id="ajuste_valor"
class="form-control">

</div>

<div class="mb-3">

<label>Descrição</label>

<textarea
id="ajuste_descricao"
class="form-control"></textarea>

</div>

</div>

<div class="modal-footer">

<button
id="salvarAjusteOS"
class="btn btn-success">

Salvar Ajuste

</button>

</div>

</div>

</div>

</div>