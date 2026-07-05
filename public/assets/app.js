const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const api = async (path, options = {}) => {
  const response = await fetch(path, options);
  const data = await response.json();
  if (response.status === 401 && !path.startsWith("/api/auth/")) showLogin();
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir.");
  return data;
};
const money = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const moneyInput = value => value === "" || value == null ? "" : money(value);
const dateBr = value => value ? value.slice(0, 10).split("-").reverse().join("/") : "";
const todaySp = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const toast = message => {
  $("#toast").textContent = message; $("#toast").classList.add("show");
  setTimeout(() => $("#toast").classList.remove("show"), 2500);
};
const send = (path, method, form) => api(path, {
  method, headers: { "content-type": "application/json" },
  body: JSON.stringify(Object.fromEntries(new FormData(form)))
});
const post = (path, data = {}) => api(path, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data)
});
const maskMoney = input => {
  const digits = input.value.replace(/\D/g, "").slice(0, 15);
  input.value = digits ? money(Number(digits) / 100) : "";
};
const maskCpf = input => {
  const digits = input.value.replace(/\D/g, "").slice(0, 11);
  input.value = digits.replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
};
const applyInputMasks = (root = document) => {
  $$("[data-money]", root).forEach(input => {
    if (input.value && !input.value.includes("R$")) input.value = moneyInput(input.value);
  });
  $$("[data-cpf]", root).forEach(maskCpf);
};

let calendar;
let selectedClientId = null;
let activeOrderData = null;
let clientSearchRequest = 0;
let stockData = null;
let managementData = null;
async function loadAgenda() {
  if (!calendar) {
    calendar = new FullCalendar.Calendar($("#calendar"), {
      locale: "pt-br", initialView: "dayGridMonth", height: "auto",
      events: "/api/agendamentos",
      dateClick: info => openAppointment(info.dateStr),
      eventClick: info => openOrder(info.event.id)
    });
    calendar.render();
  } else calendar.refetchEvents();
  const grouped = await api("/api/agendamentos?tipo=lista");
  $("#appointmentList").innerHTML = Object.entries(grouped).map(([date, items]) => `
    <article class="card appointment-group"><div class="card-head"><strong>${date}</strong><span class="badge">${items.length}</span></div>
    <div class="appointment-items">${items.map(item => `<div class="appointment-entry">
      <button class="appointment-main open-order" data-id="${item.id_agendamento}">
        <span class="appointment-person"><strong>${item.hora}</strong><span>·</span><span class="appointment-name">${escapeHtml(item.nome)}</span></span>
        <span class="badge">${escapeHtml(item.status)}</span>
      </button>
      ${item.eh_amanha && !item.cancelado ? `<a class="primary appointment-confirm" target="_blank" rel="noopener" href="${item.link_whatsapp}">Confirmar presença</a>` : ""}
    </div>`).join("")}</div></article>
  `).join("") || `<div class="panel empty">Nenhum agendamento futuro.</div>`;
  await loadFinance();
}

async function showAgenda() {
  await loadAgenda();
  requestAnimationFrame(() => requestAnimationFrame(() => calendar?.updateSize()));
}

async function loadFinance() {
  const data = await api("/api/dashboard");
  const html = `<div class="stats">
    <div class="card stat"><span class="muted">Disponível hoje</span><strong>${money(data.resumo.receber_hoje)}</strong><small>Entradas disponíveis no caixa</small></div>
    <div class="card stat"><span class="muted">Entrou no mês</span><strong>${money(data.resumo.receber_mes)}</strong><small>Total recebido neste mês</small></div>
    <div class="card stat stat-late"><span class="muted">Crediário atrasado</span><strong>${money(data.resumo.atrasado)}</strong><small>Parcelas vencidas neste mês</small></div>
  </div><h2>Sinais pendentes</h2>${data.sinais_pendentes.map(x => `<div class="card card-head"><div><strong>${escapeHtml(x.nome)}</strong><div class="muted">${x.data_agendamento} · ${money(x.valor)}</div></div><button class="primary receive-signal" data-id="${x.id_agendamento}" data-value="${Number(x.valor)}">Receber sinal</button></div>`).join("") || `<div class="card muted">Nenhum sinal pendente.</div>`}
  <h2>Parcelas atrasadas</h2>${data.parcelas_atrasadas.map(x => `<div class="card overdue-card">
    <div><strong>${escapeHtml(x.nome)}</strong><div class="muted">Parcela ${x.parcela} · ${money(x.valor)} · venceu ${dateBr(x.vencimento)}</div></div>
    <div class="card-actions"><a class="secondary" target="_blank" rel="noopener" href="${x.link_whatsapp}">Cobrar</a>${x.id_agendamento ? `<button class="primary open-order" data-id="${x.id_agendamento}">Abrir</button>` : ""}</div>
  </div>`).join("") || `<div class="card muted">Nenhuma parcela atrasada.</div>`}`;
  $("#financePanel").innerHTML = html;
}

async function loadFinancialManagement(month = todaySp().slice(0, 7)) {
  managementData = await api(`/api/financeiro/gestao?mes=${month}`);
  const summary = managementData.resumo;
  const limitPercent = Math.min(100, (Number(summary.faturamento_anual) / Number(summary.limite_mei)) * 100);
  const pending = managementData.lancamentos.filter(item => item.status === "Pendente").map(item => {
    const overdue = item.data_vencimento && item.data_vencimento < todaySp();
    return `<article class="card management-pending ${overdue ? "is-overdue" : ""}"><div><strong>${escapeHtml(item.descricao)}</strong>
      <div class="muted">${escapeHtml(item.tipo)} · ${escapeHtml(item.categoria)}${item.data_vencimento ? ` · vence ${dateBr(item.data_vencimento)}` : ""}</div></div>
      <div><strong>${money(item.valor)}</strong><button class="primary pay-management" data-id="${item.id}" data-value="${item.valor}" data-type="${item.tipo}">Dar baixa</button></div></article>`;
  }).join("") || `<div class="card muted">Nenhuma conta pendente.</div>`;
  const cash = managementData.caixa.map(item => `<div class="management-event ${item.tipo.toLowerCase()}">
    <span>${item.tipo === "Entrada" ? "↑" : "↓"}</span><div><strong>${escapeHtml(item.descricao || item.categoria)}</strong>
    <small>${dateBr(item.data_movimento)} · ${escapeHtml(item.categoria)}${item.forma_pagamento ? ` · ${escapeHtml(item.forma_pagamento)}` : ""}${item.cliente ? ` · ${escapeHtml(item.cliente)}` : ""}</small></div>
    <strong>${item.tipo === "Entrada" ? "+" : "-"} ${money(item.valor)}</strong></div>`).join("") || `<div class="card muted">Nenhuma movimentação neste mês.</div>`;
  const categories = managementData.despesas_categoria.map(item => `<div class="category-row"><span>${escapeHtml(item.categoria)}</span><strong>${money(item.total)}</strong></div>`).join("") || `<p class="muted">Nenhuma despesa paga no período.</p>`;
  $("#fullFinancePanel").innerHTML = `<div class="management-period"><label>Período<input id="financeMonth" type="month" value="${managementData.periodo}"></label></div>
    <div class="management-stats">
      <div class="card stat income"><span class="muted">Entradas</span><strong>${money(summary.entradas)}</strong></div>
      <div class="card stat expense"><span class="muted">Saídas</span><strong>${money(summary.saidas)}</strong></div>
      <div class="card stat ${summary.resultado < 0 ? "stat-late" : ""}"><span class="muted">Resultado</span><strong>${money(summary.resultado)}</strong></div>
      <div class="card stat"><span class="muted">A receber</span><strong>${money(summary.receber)}</strong></div>
      <div class="card stat"><span class="muted">A pagar</span><strong>${money(summary.pagar)}</strong></div>
      <div class="card stat stat-late"><span class="muted">Em atraso</span><strong>${money(summary.atrasado)}</strong></div>
    </div>
    <section class="card mei-card"><div class="card-head"><div><span class="eyebrow">MEI 2026</span><h2>Faturamento anual</h2></div><strong>${money(summary.faturamento_anual)} / ${money(summary.limite_mei)}</strong></div>
      <div class="mei-progress"><span style="width:${limitPercent}%"></span></div><small class="muted">${limitPercent.toFixed(1).replace(".", ",")}% do limite anual. Receitas a prazo devem ser conferidas pelo mês da prestação para o relatório oficial.</small></section>
    <div class="management-actions"><button class="primary" data-management-action="Receita">Registrar receita</button><button class="secondary" data-management-action="Despesa">Registrar despesa</button>
      <button class="secondary" data-management-action="Conta">Conta a pagar</button><button class="secondary" data-management-action="DAS">Cadastrar DAS</button></div>
    <div class="management-columns"><section><h2>Contas pendentes</h2>${pending}</section><section><h2>Despesas por categoria</h2><div class="card category-list">${categories}</div></section></div>
    <h2>Fluxo de caixa do mês</h2><div class="management-history">${cash}</div>
    <p class="management-note">Controle gerencial. Confira o Relatório Mensal de Receitas Brutas e a DASN-SIMEI nos canais oficiais do MEI.</p>`;
  $("#financeMonth").onchange = event => loadFinancialManagement(event.target.value);
}

function nextMonthDueDay20() {
  const [year, month] = todaySp().split("-").map(Number);
  return new Date(Date.UTC(year, month, 20)).toISOString().slice(0, 10);
}

function openManagementAction(action) {
  const month = $("#financeMonth")?.value || todaySp().slice(0, 7);
  const isBill = action === "Conta";
  const isDas = action === "DAS";
  const type = isDas ? "DAS" : isBill ? "Despesa" : action;
  const title = isDas ? "Cadastrar DAS mensal" : isBill ? "Nova conta a pagar" : `Registrar ${action.toLowerCase()}`;
  const categories = type === "Receita"
    ? ["Serviços", "Venda de produto", "Outras receitas"]
    : ["Materiais", "Aluguel", "Energia", "Água", "Internet", "Marketing", "Equipamentos", "Manutenção", "Impostos", "Taxas", "Outras despesas"];
  $("#actionContent").innerHTML = `<header><h2>${title}</h2><button class="close" type="button">×</button></header>
    <form id="managementForm"><input type="hidden" name="tipo" value="${type}">
      <label>Descrição<input name="descricao" value="${isDas ? `DAS MEI ${month}` : ""}" required></label>
      <label>Categoria<select name="categoria">${categories.map(category => `<option ${isDas && category === "Impostos" ? "selected" : ""}>${category}</option>`).join("")}</select></label>
      <label>Valor<input name="valor" data-money inputmode="numeric" value="${isDas ? moneyInput(86.05) : ""}" required></label>
      <label>Competência<input name="competencia" type="month" value="${month}" required></label>
      <label>Vencimento<input name="data_vencimento" type="date" value="${isDas ? nextMonthDueDay20() : ""}"></label>
      <label>Status<select name="status"><option ${isBill || isDas ? "selected" : ""}>Pendente</option><option ${!isBill && !isDas ? "selected" : ""}>Pago</option></select></label>
      <label>Data do pagamento<input name="data_pagamento" type="date" value="${todaySp()}"></label>
      <label>Forma de pagamento<select name="forma_pagamento"><option>Pix</option><option>Dinheiro</option><option>Debito</option><option>Credito</option></select></label>
      ${type === "Receita" ? `<label class="check-label"><input type="checkbox" name="nota_fiscal" value="1"> Nota fiscal emitida</label>` : ""}
      <label>Documento ou referência<input name="documento" placeholder="Número da nota, boleto ou recibo"></label>
      <label>Observações<textarea name="observacoes"></textarea></label><button class="primary">Salvar lançamento</button></form>`;
  applyInputMasks($("#actionContent"));
  $("#actionDialog").showModal();
  $("#managementForm").onsubmit = async event => {
    event.preventDefault();
    await send("/api/financeiro/gestao", "POST", event.currentTarget);
    $("#actionDialog").close(); toast("Lançamento financeiro salvo.");
    await loadFinancialManagement(month); await loadFinance();
  };
}

function openManagementPayment(trigger) {
  $("#actionContent").innerHTML = `<header><h2>Dar baixa</h2><button class="close" type="button">×</button></header>
    <form id="managementPaymentForm"><label>Valor<input value="${moneyInput(trigger.dataset.value)}" readonly></label>
      <label>Data do pagamento<input name="data_pagamento" type="date" value="${todaySp()}" required></label>
      <label>Forma de pagamento<select name="forma_pagamento"><option>Pix</option><option>Dinheiro</option><option>Debito</option><option>Credito</option></select></label>
      <button class="primary">Confirmar pagamento</button></form>`;
  $("#actionDialog").showModal();
  $("#managementPaymentForm").onsubmit = async event => {
    event.preventDefault();
    await post(`/api/financeiro/gestao/${trigger.dataset.id}/pagar`, Object.fromEntries(new FormData(event.currentTarget)));
    $("#actionDialog").close(); toast("Baixa registrada.");
    await loadFinancialManagement($("#financeMonth")?.value); await loadFinance();
  };
}

async function loadStock() {
  stockData = await api("/api/estoque");
  const items = stockData.itens.map(item => {
    const low = Number(item.quantidade_atual) <= Number(item.quantidade_minima);
    const expiryAlert = item.status_validade === "Vencida" || item.status_validade === "Próxima do vencimento";
    const search = `${item.nome} ${item.categoria || ""} ${item.marca || ""} ${item.cor || ""} ${item.lote || ""}`.toLocaleLowerCase("pt-BR");
    return `<article class="card stock-card ${low ? "stock-low" : ""}" data-stock-search="${escapeHtml(search)}">
      <div class="stock-card-head"><div><strong>${escapeHtml(item.nome)}${item.cor ? ` · ${escapeHtml(item.cor)}` : ""}</strong><span class="badge ${low || expiryAlert ? "badge-late" : ""}">${expiryAlert ? item.status_validade : low ? "Estoque baixo" : item.tipo_item}</span></div>
      <strong class="stock-balance">${item.quantidade_atual} ${escapeHtml(item.unidade)}</strong></div>
      <div class="muted">${escapeHtml(item.categoria || "Sem categoria")}${item.marca ? ` · ${escapeHtml(item.marca)}` : ""}${item.tipo_item === "Tinta" && item.volume_embalagem_ml ? ` · Frasco ${item.volume_embalagem_ml} ml` : ""}${item.lote ? ` · Lote ${escapeHtml(item.lote)}` : ""}${item.validade_efetiva ? ` · validade ${dateBr(item.validade_efetiva)}` : ""}</div>
      <div class="stock-details"><span>Mínimo: ${item.quantidade_minima} ${escapeHtml(item.unidade)}</span><span>${money(item.valor_unitario)} / ${escapeHtml(item.unidade)}</span></div>
      <div class="card-actions"><button class="secondary" type="button" data-stock-action="edit" data-id="${item.id}">Editar</button>
      <button class="primary" type="button" data-stock-action="movement" data-id="${item.id}">Movimentar</button></div>
    </article>`;
  }).join("") || `<div class="card muted">Nenhum material cadastrado.</div>`;
  const history = stockData.historico.map(item => `<div class="stock-event ${item.tipo.toLowerCase()}">
    <span class="stock-event-icon">${item.tipo === "Entrada" ? "↑" : item.tipo === "Saida" ? "↓" : "•"}</span>
    <div><strong>${escapeHtml(item.nome)}</strong><small>${dateBr(item.data_movimento)} · ${escapeHtml(item.tipo)} de ${item.quantidade} ${escapeHtml(item.unidade)}${item.id_os ? ` · OS #${item.id_os}` : ""}${item.observacao ? ` · ${escapeHtml(item.observacao)}` : ""}</small></div>
    <strong>${item.saldo_atual} ${escapeHtml(item.unidade)}</strong></div>`).join("") || `<div class="card muted">Nenhuma movimentação registrada.</div>`;
  const expiryAlerts = (stockData.alertas || []).map(item => `<article class="card expiry-alert ${item.status_validade === "Vencida" ? "expired" : ""}">
    <div><strong>${escapeHtml(item.nome)}${item.cor ? ` · ${escapeHtml(item.cor)}` : ""}</strong><div class="muted">Lote ${escapeHtml(item.lote || "não informado")} · validade ${dateBr(item.validade_efetiva)}</div></div>
    <strong>${item.status_validade === "Vencida" ? `Vencida há ${Math.abs(item.dias_para_vencer)} dias` : `Vence em ${item.dias_para_vencer} dias`}</strong></article>`).join("");
  $("#stockPanel").innerHTML = `<div class="stats">
    <div class="card stat"><span class="muted">Materiais</span><strong>${stockData.resumo.itens}</strong><small>Itens ativos cadastrados</small></div>
    <div class="card stat stat-late"><span class="muted">Estoque baixo</span><strong>${stockData.resumo.baixos}</strong><small>No mínimo ou abaixo</small></div>
    <div class="card stat"><span class="muted">Valor estimado</span><strong>${money(stockData.resumo.valor_total)}</strong><small>Saldo atual em estoque</small></div>
    <div class="card stat ${stockData.resumo.vencidos ? "stat-late" : ""}"><span class="muted">Alertas de validade</span><strong>${stockData.resumo.vencendo + stockData.resumo.vencidos}</strong><small>${stockData.resumo.vencidos} vencidas · ${stockData.resumo.vencendo} próximas</small></div>
  </div>${expiryAlerts ? `<h2>Alertas de validade</h2><div class="expiry-alerts">${expiryAlerts}</div>` : ""}
  <div class="stock-toolbar"><button class="primary" type="button" data-stock-action="movement">Registrar entrada ou saída</button>
  <input id="stockSearch" placeholder="Pesquisar material..." autocomplete="off"></div>
  <div id="stockList" class="stock-grid">${items}</div>
  <h2>Histórico de movimentações</h2><div class="stock-history">${history}</div>`;
  $("#stockSearch").oninput = event => {
    const term = event.target.value.toLocaleLowerCase("pt-BR").trim();
    $$("[data-stock-search]", $("#stockList")).forEach(card => {
      card.hidden = term && !card.dataset.stockSearch.includes(term);
    });
  };
}

function openStockAction(action, itemId = "") {
  const item = stockData?.itens.find(entry => String(entry.id) === String(itemId));
  let title;
  let form;
  if (action === "new") {
    title = "Novo material";
    form = `<form id="stockActionForm"><label>Nome<input name="nome" required></label>
      <label>Tipo<select name="tipo_item"><option>Material</option><option>Tinta</option></select></label>
      <div class="fields"><label>Categoria<input name="categoria" placeholder="Ex.: Tintas"></label><label>Marca<input name="marca"></label></div>
      <div class="ink-only-fields" hidden><div class="fields"><label>Cor da tinta<input name="cor" placeholder="Ex.: Azul turquesa"></label><label>Número do lote<input name="lote"></label></div>
      <div class="fields"><label>Volume da embalagem (ml)<input name="volume_embalagem_ml" type="number" min="0" step=".01" inputmode="decimal"></label><label>Validade do fabricante<input name="data_validade" type="date"></label></div>
      <div class="fields"><label>Validade após aberto (dias)<input name="validade_apos_aberto_dias" type="number" min="1" step="1" inputmode="numeric"></label><label>Data de abertura<input name="data_abertura" type="date"></label></div>
      <label>Alertar com antecedência de<input name="alerta_validade_dias" type="number" min="1" step="1" inputmode="numeric" value="30"><small class="muted">Quantidade de dias antes do vencimento.</small></label>
      <label>Estimativa de ml por gota<input name="ml_por_gota" type="number" min=".0001" step=".0001" inputmode="decimal" value="0.05"><small class="muted">Ajustável conforme o bico e a viscosidade da tinta.</small></label></div>
      <div class="fields"><label>Unidade<select name="unidade" data-stock-unit><option>un.</option><option>ml</option><option>g</option><option>caixa</option><option>rolo</option><option>folha</option></select></label>
      <label>Quantidade inicial<input name="quantidade_atual" type="number" min="0" step=".01" inputmode="decimal" value="0"></label></div>
      <div class="fields"><label>Estoque mínimo<input name="quantidade_minima" type="number" min="0" step=".01" inputmode="decimal" value="0"></label>
      <label>Valor unitário<input name="valor_unitario" data-money inputmode="numeric"></label></div>
      <label>Observações<textarea name="observacoes"></textarea></label><button class="primary">Cadastrar material</button></form>`;
  } else if (action === "edit" && item) {
    title = "Editar material";
    form = `<form id="stockActionForm"><label>Nome<input name="nome" value="${escapeHtml(item.nome)}" required></label>
      <label>Tipo<select name="tipo_item"><option ${item.tipo_item === "Material" ? "selected" : ""}>Material</option><option ${item.tipo_item === "Tinta" ? "selected" : ""}>Tinta</option></select></label>
      <div class="fields"><label>Categoria<input name="categoria" value="${escapeHtml(item.categoria)}"></label><label>Marca<input name="marca" value="${escapeHtml(item.marca)}"></label></div>
      <div class="ink-only-fields" ${item.tipo_item === "Tinta" ? "" : "hidden"}><div class="fields"><label>Cor da tinta<input name="cor" value="${escapeHtml(item.cor)}"></label><label>Número do lote<input name="lote" value="${escapeHtml(item.lote)}"></label></div>
      <div class="fields"><label>Volume da embalagem (ml)<input name="volume_embalagem_ml" type="number" min="0" step=".01" inputmode="decimal" value="${item.volume_embalagem_ml || ""}"></label><label>Validade do fabricante<input name="data_validade" type="date" value="${item.data_validade || ""}"></label></div>
      <div class="fields"><label>Validade após aberto (dias)<input name="validade_apos_aberto_dias" type="number" min="1" step="1" inputmode="numeric" value="${item.validade_apos_aberto_dias || ""}"></label><label>Data de abertura<input name="data_abertura" type="date" value="${item.data_abertura || ""}"></label></div>
      <label>Alertar com antecedência de<input name="alerta_validade_dias" type="number" min="1" step="1" inputmode="numeric" value="${item.alerta_validade_dias || 30}"></label>
      <label>Estimativa de ml por gota<input name="ml_por_gota" type="number" min=".0001" step=".0001" inputmode="decimal" value="${item.ml_por_gota || 0.05}"></label></div>
      <div class="fields"><label>Unidade<input name="unidade" data-stock-unit value="${escapeHtml(item.unidade)}" required></label>
      <label>Estoque mínimo<input name="quantidade_minima" type="number" min="0" step=".01" inputmode="decimal" value="${item.quantidade_minima}"></label></div>
      <label>Valor unitário<input name="valor_unitario" data-money inputmode="numeric" value="${moneyInput(item.valor_unitario)}"></label>
      <label>Observações<textarea name="observacoes">${escapeHtml(item.observacoes)}</textarea></label><button class="primary">Salvar material</button></form>`;
  } else {
    title = "Movimentar estoque";
    const options = stockData.itens.map(entry => `<option value="${entry.id}" ${String(entry.id) === String(itemId) ? "selected" : ""}>${escapeHtml(entry.nome)} · ${entry.quantidade_atual} ${escapeHtml(entry.unidade)}</option>`).join("");
    form = `<form id="stockActionForm"><label>Material<select name="id_estoque" required><option value="">Selecione...</option>${options}</select></label>
      <div class="fields"><label>Movimento<select name="tipo"><option>Entrada</option><option>Saida</option></select></label>
      <label>Quantidade<input name="quantidade" type="number" min=".01" step=".01" inputmode="decimal" required></label></div>
      <label>Valor unitário da entrada<input name="valor_unitario" data-money inputmode="numeric"><small class="muted">Opcional. Atualiza o valor do material.</small></label>
      <label>Observação<input name="observacao" placeholder="Ex.: Compra do fornecedor"></label><button class="primary">Registrar movimentação</button></form>`;
  }
  $("#actionContent").innerHTML = `<header><h2>${title}</h2><button class="close" type="button">×</button></header>${form}`;
  applyInputMasks($("#actionContent"));
  const typeField = $("#stockActionForm").elements.tipo_item;
  if (typeField) {
    const toggleInkFields = () => {
      const isInk = typeField.value === "Tinta";
      $(".ink-only-fields", $("#stockActionForm")).hidden = !isInk;
      const unitField = $("[data-stock-unit]", $("#stockActionForm"));
      if (isInk && unitField) unitField.value = "ml";
      if (isInk && !$("#stockActionForm").elements.categoria.value) {
        $("#stockActionForm").elements.categoria.value = "Tintas";
      }
    };
    typeField.onchange = toggleInkFields;
  }
  $("#actionDialog").showModal();
  $("#stockActionForm").onsubmit = async event => {
    event.preventDefault();
    let path = "/api/estoque";
    let method = "POST";
    if (action === "edit") { path = `/api/estoque/${item.id}`; method = "PUT"; }
    if (action === "movement") path = `/api/estoque/${event.currentTarget.elements.id_estoque.value}/movimentos`;
    await send(path, method, event.currentTarget);
    $("#actionDialog").close();
    toast(action === "new" ? "Material cadastrado." : action === "edit" ? "Material atualizado." : "Movimentação registrada.");
    await loadStock();
  };
}

function openAppointment(date = "") {
  const form = $("#appointmentForm"); form.reset();
  form.elements.data.value = date;
  $("#appointmentDialog").showModal();
}

async function loadClients(search = "") {
  const requestId = ++clientSearchRequest;
  const term = search.trim();
  if (term.length < 2) {
    $("#clientList").innerHTML = `<p class="muted client-search-hint">Digite pelo menos 2 letras para localizar um cliente.</p>`;
    return;
  }
  const clients = await api(`/api/clientes?busca=${encodeURIComponent(term)}`);
  if (requestId !== clientSearchRequest) return;
  $("#clientList").innerHTML = clients.map(c => `<button class="client-item select-client" data-id="${c.id}" data-name="${escapeHtml(c.nome)}"><strong>${escapeHtml(c.nome)}</strong><br><span class="muted">${escapeHtml(c.telefone)}</span></button>`).join("") || `<p class="muted client-search-hint">Nenhum cliente encontrado.</p>`;
}

async function loadClient(id) {
  selectedClientId = id;
  const [client, history, finance] = await Promise.all([
    api(`/api/clientes/${id}`), api(`/api/clientes/${id}/historico`), api(`/api/clientes/${id}/financeiro`)
  ]);
  const balance = Math.max(0, finance.orcado - finance.pago + finance.estornado);
  const historyHtml = history.map(order => `<article class="card client-order">
    <div class="card-head"><div><strong>Ordem de serviço #${order.id_os}</strong><div class="muted">${dateBr(order.data_hora)} · ${escapeHtml(order.status)}</div></div>
    ${order.id_agendamento ? `<button class="secondary open-order" data-id="${order.id_agendamento}">Abrir</button>` : ""}</div>
    <p>${escapeHtml(order.descricao || "Sem descrição da tatuagem.")}</p>
    <div class="client-order-footer"><strong>${money(order.valor_final)}</strong><span class="muted">${order.materiais.length ? order.materiais.map(item => `${escapeHtml(item.material)} (${item.quantidade} ${escapeHtml(item.unidade)})`).join(" · ") : "Nenhum material registrado"}</span></div>
  </article>`).join("") || `<p class="muted">Nenhuma ordem de serviço.</p>`;
  const financialOrders = finance.ordens.map(order => {
    const open = Math.max(0, Number(order.valor_final) - Number(order.pago));
    return `<article class="card financial-order"><div class="card-head"><div><strong>OS #${order.id_os}</strong><div class="muted">${dateBr(order.data_hora)}</div></div>
      ${order.id_agendamento ? `<button class="secondary open-order" data-id="${order.id_agendamento}">Abrir</button>` : ""}</div>
      <div class="financial-line"><span>Valor</span><strong>${money(order.valor_final)}</strong></div>
      <div class="financial-line"><span>Pago</span><strong>${money(order.pago)}</strong></div>
      <div class="financial-line"><span>Pendente</span><strong>${money(open)}</strong></div></article>`;
  }).join("") || `<div class="card muted">Nenhum financeiro registrado.</div>`;
  const creditHistory = finance.crediarios.map(item => {
    const late = item.status !== "Pago" && item.data_vencimento < todaySp();
    return `<div class="card installment-card"><div><strong>OS #${item.id_os} · Parcela ${item.numero_parcela}</strong>
      <div class="muted">${dateBr(item.data_vencimento)} · ${money(item.valor_parcela)}</div></div>
      <div class="installment-state"><span class="badge ${late ? "badge-late" : ""}">${item.status === "Pago" ? "Pago" : late ? "Atrasado" : "Pendente"}</span>
      ${item.status !== "Pago" ? `<button type="button" class="secondary pay-installment" data-id="${item.id}" data-appointment="${item.id_agendamento}" data-number="${item.numero_parcela}" data-value="${item.valor_parcela}">Dar baixa</button>` : ""}</div></div>`;
  }).join("") || `<div class="card muted">Nenhum crediário.</div>`;
  const movementHistory = finance.movimentos.map(item => `<div class="financial-movement">
    <div><strong>${escapeHtml(item.tipo)}</strong><span class="muted">OS #${item.id_os} · ${dateBr(item.data_pagamento)}${item.forma_pagamento ? ` · ${escapeHtml(item.forma_pagamento)}` : ""}</span></div>
    <strong>${money(item.valor)}</strong></div>`).join("") || `<p class="muted">Nenhum pagamento lançado.</p>`;
  const adjustmentHistory = finance.ajustes.map(item => `<div class="financial-movement">
    <div><strong>${escapeHtml(item.tipo)}</strong><span class="muted">OS #${item.id_os} · ${dateBr(item.data_registro)}${item.descricao ? ` · ${escapeHtml(item.descricao)}` : ""}</span></div>
    <strong>${money(item.valor)}</strong></div>`).join("") || `<p class="muted">Nenhum ajuste lançado.</p>`;
  $("#clientDetail").classList.remove("empty");
  $("#clientDetail").innerHTML = `<div class="tabs"><button class="tab active" data-tab="data">Dados</button><button class="tab" data-tab="history">Histórico</button><button class="tab" data-tab="client-finance">Financeiro</button></div>
    <div class="tab-pane active" id="data"><form id="clientForm">
      <div class="fields"><label>Nome<input name="nome" value="${escapeHtml(client.nome)}" required></label><label>Telefone<input name="telefone" value="${escapeHtml(client.telefone)}"></label></div>
      <div class="fields"><label>Cidade<input name="cidade" value="${escapeHtml(client.cidade)}"></label><label>Instagram<input name="instagram" value="${escapeHtml(client.instagram)}"></label></div>
      <div class="fields"><label>CPF<input name="cpf" data-cpf inputmode="numeric" maxlength="14" value="${escapeHtml(client.cpf)}"></label><label>RG<input name="rg" value="${escapeHtml(client.rg)}"></label></div>
      <label>Data de nascimento<input type="date" name="data_nascimento" value="${client.data_nascimento || ""}"></label>
      <label>Observações<textarea name="observacoes">${escapeHtml(client.observacoes)}</textarea></label><button class="primary">Salvar cadastro</button>
    </form></div>
    <div class="tab-pane" id="history">${historyHtml}</div>
    <div class="tab-pane" id="client-finance"><div class="stats"><div class="card stat">Total em serviços<strong>${money(finance.orcado)}</strong></div><div class="card stat">Total pago<strong>${money(finance.pago)}</strong></div><div class="card stat">Total pendente<strong>${money(balance)}</strong></div></div>
      <h2>Ordens de serviço</h2>${financialOrders}
      <h2>Crediários</h2>${creditHistory}
      <h2>Pagamentos</h2><div class="movement-list">${movementHistory}</div>
      <h2>Acréscimos e descontos</h2><div class="movement-list">${adjustmentHistory}</div>
    </div>`;
  applyInputMasks($("#clientDetail"));
  $("#clientForm").addEventListener("submit", async event => {
    event.preventDefault();
    if (!confirm("Confirmar a atualização do cadastro deste cliente?")) return;
    await send(`/api/clientes/${id}`, "PUT", event.currentTarget);
    $("#clientSearch").value = event.currentTarget.elements.nome.value;
    $("#clientList").innerHTML = "";
    toast("Cadastro atualizado.");
  });
}

function openNewClient() {
  $("#actionContent").innerHTML = `<header><h2>Novo cliente</h2><button class="close" type="button">×</button></header>
    <form id="newClientForm"><label>Nome<input name="nome" autocomplete="name" required></label>
    <label>Telefone<input name="telefone" type="tel" inputmode="tel" autocomplete="tel" required></label>
    <div class="fields"><label>Cidade<input name="cidade"></label><label>Instagram<input name="instagram"></label></div>
    <div class="fields"><label>CPF<input name="cpf" data-cpf inputmode="numeric" maxlength="14"></label><label>RG<input name="rg"></label></div>
    <label>Data de nascimento<input name="data_nascimento" type="date"></label>
    <label>Observações<textarea name="observacoes"></textarea></label><button class="primary">Cadastrar cliente</button></form>`;
  $("#actionDialog").showModal();
  $("#newClientForm").onsubmit = async event => {
    event.preventDefault();
    const result = await send("/api/clientes", "POST", event.currentTarget);
    $("#actionDialog").close();
    $("#clientSearch").value = result.nome;
    $("#clientList").innerHTML = "";
    await loadClient(result.id);
    toast("Cliente cadastrado.");
  };
}

async function refreshOrder(tab = "os-finance") {
  const appointmentId = activeOrderData.id_agendamento;
  if ($("#actionDialog").open) $("#actionDialog").close();
  if ($("#orderDialog").open) $("#orderDialog").close();
  await openOrder(appointmentId);
  $(`[data-tab=${tab}]`, $("#orderDialog"))?.click();
  loadFinance();
  if (selectedClientId) loadClient(selectedClientId);
}

function openFinanceAction(action, defaults = {}, returnToOrder = true) {
  const data = activeOrderData;
  let title = "";
  let form = "";
  if (action === "payment") {
    const isSignal = defaults.tipo === "Sinal";
    title = isSignal ? "Receber sinal" : "Registrar pagamento";
    form = `<form id="actionForm"><input type="hidden" name="id_os" value="${data.id_os}"><input type="hidden" name="tipo" value="${isSignal ? "Sinal" : "Pagamento"}">
      <label>Valor<input name="valor" type="text" inputmode="numeric" data-money value="${moneyInput(defaults.valor)}" required></label>
      <label>Forma<select name="forma_pagamento"><option ${defaults.forma_pagamento === "Pix" ? "selected" : ""}>Pix</option><option>Dinheiro</option><option>Debito</option><option>Credito</option></select></label>
      <label>Data<input type="date" name="data_pagamento" value="${defaults.data_pagamento || todaySp()}" required></label>
      <label>Observação<input name="observacao" value="${escapeHtml(defaults.observacao || "")}"></label><button class="primary">${isSignal ? "Dar baixa no sinal" : "Registrar pagamento"}</button></form>`;
  } else if (action === "credit") {
    title = "Criar crediário";
    form = `<form id="actionForm"><input type="hidden" name="id_os" value="${data.id_os}">
      <p class="muted action-help">O saldo de <strong>${money(data.saldo_aberto)}</strong> será dividido em parcelas mensais via Pix.</p>
      <label>Quantidade de parcelas<input name="quantidade" type="number" min="1" max="60" inputmode="numeric" required></label>
      <label>Primeiro vencimento<input name="primeiro_vencimento" type="date" required></label>
      <button class="primary">Criar crediário</button></form>`;
  } else {
    title = "Acréscimo ou desconto";
    form = `<form id="actionForm"><input type="hidden" name="id_os" value="${data.id_os}">
      <label>Tipo<select name="tipo"><option>Acrescimo</option><option>Desconto</option></select></label>
      <label>Valor<input name="valor" type="text" inputmode="numeric" data-money required></label>
      <label>Descrição<input name="descricao"></label><button class="primary">Registrar ajuste</button></form>`;
  }
  $("#actionContent").innerHTML = `<header><h2>${title}</h2><button class="close" type="button">×</button></header>${form}`;
  applyInputMasks($("#actionContent"));
  $("#actionDialog").showModal();
  $("#actionForm").onsubmit = async event => {
    event.preventDefault();
    const path = action === "payment" ? "/api/movimentos" : action === "credit" ? "/api/crediario" : "/api/ajustes";
    await send(path, "POST", event.currentTarget);
    toast(defaults.tipo === "Sinal" ? "Sinal recebido." : action === "payment" ? "Pagamento registrado." : action === "credit" ? "Crediário criado." : "Ajuste registrado.");
    if (returnToOrder) await refreshOrder();
    else {
      $("#actionDialog").close();
      await loadAgenda();
    }
  };
}

function openServiceAction(action) {
  if (action === "ink") return openInkRecipeAction();
  const data = activeOrderData;
  const isDescription = action === "description";
  const title = isDescription ? "Descrição do serviço" : "Adicionar material";
  const form = isDescription
    ? `<form id="serviceActionForm"><label>Descrição da tatuagem<textarea name="descricao" placeholder="Descreva a arte, região do corpo, tamanho e demais detalhes...">${escapeHtml(data.descricao)}</textarea></label><button class="primary">Salvar descrição</button></form>`
    : `<form id="serviceActionForm"><label>Material<input name="material" placeholder="Ex.: Tinta preta" required></label>
      <label>Quantidade<input name="quantidade" type="number" min=".01" step=".01" inputmode="decimal" required></label>
      <label>Unidade<select name="unidade"><option>un.</option><option>ml</option><option>g</option><option>par</option><option>folha</option></select></label>
      <label>Observação<input name="observacao" placeholder="Opcional"></label><button class="primary">Adicionar material</button></form>`;
  $("#actionContent").innerHTML = `<header><h2>${title}</h2><button class="close" type="button">×</button></header>${form}`;
  $("#actionDialog").showModal();
  $("#serviceActionForm").onsubmit = async event => {
    event.preventDefault();
    await send(isDescription ? `/api/os/${data.id_os}` : `/api/os/${data.id_os}/materiais`,
      isDescription ? "PUT" : "POST", event.currentTarget);
    toast(isDescription ? "Descrição salva." : "Material adicionado.");
    await refreshOrder("os-service");
  };
}

async function openInkRecipeAction() {
  const data = activeOrderData;
  const inventory = await api("/api/estoque");
  const inks = inventory.itens.filter(item =>
    item.tipo_item === "Tinta" && item.status_validade !== "Vencida"
  );
  if (!inks.length) return toast("Cadastre uma tinta válida no Estoque antes de criar a mistura.");
  const options = inks.map(item => `<option value="${item.id}">${escapeHtml(item.nome)}${item.cor ? ` · ${escapeHtml(item.cor)}` : ""}${item.lote ? ` · lote ${escapeHtml(item.lote)}` : ""} · ${item.quantidade_atual} ml</option>`).join("");
  const inkRow = () => `<div class="ink-row"><label>Tinta<select class="ink-stock">${options}</select></label>
    <label>Gotas<input class="ink-drops" type="number" min="1" step="1" inputmode="numeric" required></label>
    <button type="button" class="danger remove-ink-row" aria-label="Remover cor">×</button></div>`;
  $("#actionContent").innerHTML = `<header><h2>Registrar mistura de tintas</h2><button class="close" type="button">×</button></header>
    <form id="inkRecipeForm"><div class="fields"><label>Identificação do batoque<input name="identificacao" placeholder="Ex.: Batoque 1" required></label>
    <label>Tamanho<select name="tamanho"><option value="P">P · 0,5 ml</option><option value="M">M · 1 ml</option><option value="G">G · 2 ml</option><option value="GG">GG · 4 ml</option><option value="Outro">Outro</option></select></label></div>
    <label>Capacidade aproximada (ml)<input name="capacidade_ml" type="number" min="0" step=".01" inputmode="decimal" value="0.5"></label>
    <div class="ink-rows">${inkRow()}</div><button type="button" class="secondary add-ink-row">+ Adicionar outra cor</button>
    <label>Observação<textarea name="observacao" placeholder="Diluição, proporção ou detalhe para o retoque"></textarea></label>
    <button class="primary">Salvar receita do batoque</button></form>`;
  $("#actionDialog").showModal();
  const sizeSelect = $("#inkRecipeForm").elements.tamanho;
  const capacityInput = $("#inkRecipeForm").elements.capacidade_ml;
  sizeSelect.onchange = () => {
    const capacities = { P: "0.5", M: "1", G: "2", GG: "4" };
    capacityInput.value = capacities[sizeSelect.value] || "";
    if (sizeSelect.value === "Outro") capacityInput.focus();
  };
  $(".add-ink-row", $("#actionDialog")).onclick = () => {
    $(".ink-rows", $("#actionDialog")).insertAdjacentHTML("beforeend", inkRow());
  };
  $(".ink-rows", $("#actionDialog")).onclick = event => {
    const remove = event.target.closest(".remove-ink-row");
    if (remove && $$(".ink-row", $("#actionDialog")).length > 1) remove.closest(".ink-row").remove();
  };
  $("#inkRecipeForm").onsubmit = async event => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget));
    payload.tintas = $$(".ink-row", event.currentTarget).map(row => ({
      id_estoque: $(".ink-stock", row).value,
      gotas: $(".ink-drops", row).value
    }));
    await post(`/api/os/${data.id_os}/tintas`, payload);
    toast("Receita de tintas salva.");
    await refreshOrder("os-service");
  };
}

function openInstallmentPayment(trigger) {
  const orderWasOpen = $("#orderDialog").open;
  const number = trigger.dataset.number || "";
  $("#actionContent").innerHTML = `<header><h2>Receber parcela${number ? ` ${number}` : ""}</h2><button class="close" type="button">×</button></header>
    <form id="installmentPaymentForm"><label>Valor<input value="${moneyInput(trigger.dataset.value)}" readonly></label>
    <label>Forma<input value="Pix" readonly></label>
    <label>Data<input name="data_pagamento" type="date" value="${todaySp()}" required></label>
    <label>Observação<input name="observacao" value="CREDIÁRIO${number ? ` - PARCELA ${number}` : ""}"></label>
    <button class="primary">Confirmar recebimento</button></form>`;
  $("#actionDialog").showModal();
  $("#installmentPaymentForm").onsubmit = async event => {
    event.preventDefault();
    await post(`/api/crediario/${trigger.dataset.id}/pagar`,
      Object.fromEntries(new FormData(event.currentTarget)));
    $("#actionDialog").close();
    toast("Parcela recebida.");
    if (orderWasOpen) await refreshOrder();
    else {
      if (selectedClientId) {
        await loadClient(selectedClientId);
        $("[data-tab=client-finance]", $("#clientDetail"))?.click();
      }
      await loadFinance();
    }
  };
}

async function openOrder(appointmentId) {
  const data = await api(`/api/os?id=${appointmentId}`);
  activeOrderData = data;
  const [date, time] = data.data_hora.split(" ");
  const today = todaySp();
  const installmentHtml = data.parcelas.length ? `<div class="installment-list">${data.parcelas.map(item => {
    const late = item.status !== "Pago" && item.data_vencimento < today;
    const status = item.status === "Pago" ? "Pago" : late ? "Atrasado" : "Pendente";
    return `<div class="card installment-card">
      <div><strong>Parcela ${item.numero_parcela}</strong><div class="muted">${dateBr(item.data_vencimento)} · ${money(item.valor_parcela)}</div></div>
      <div class="installment-state"><span class="badge ${late ? "badge-late" : ""}">${status}</span>
      ${item.status !== "Pago" ? `<button type="button" class="secondary pay-installment" data-id="${item.id}" data-appointment="${data.id_agendamento}" data-number="${item.numero_parcela}" data-value="${item.valor_parcela}">Dar baixa</button>` : ""}</div>
    </div>`;
  }).join("")}</div>` : "";
  const financeEvents = [
    ...data.movimentos.map(item => ({
      date: item.data_pagamento || item.data_movimento,
      title: item.tipo,
      detail: `${item.forma_pagamento || "Sem forma"}${item.observacao ? ` · ${item.observacao}` : ""}`,
      value: item.valor,
      kind: "movement"
    })),
    ...data.ajustes.map(item => ({
      date: item.data_registro,
      title: item.tipo,
      detail: item.descricao || "Ajuste financeiro",
      value: item.valor,
      kind: item.tipo === "Desconto" ? "discount" : "adjustment"
    })),
    ...data.parcelas.map(item => ({
      date: item.data_vencimento,
      title: `Crediário · Parcela ${item.numero_parcela}`,
      detail: item.status === "Pago" ? `Pago em ${dateBr(item.data_pagamento)}` : item.data_vencimento < today ? "Parcela atrasada" : "Parcela pendente",
      value: item.valor_parcela,
      kind: item.status === "Pago" ? "paid" : item.data_vencimento < today ? "late" : "installment"
    }))
  ].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const financeHistory = financeEvents.map(item => `<div class="finance-event ${item.kind}">
    <span class="finance-event-dot"></span><div><strong>${escapeHtml(item.title)}</strong><small>${dateBr(item.date)} · ${escapeHtml(item.detail)}</small></div>
    <strong>${money(item.value)}</strong></div>`).join("") || `<div class="card muted">Nenhum lançamento financeiro nesta ordem.</div>`;
  const materialHtml = data.materiais.map(item => `<div class="card material-card">
    <div><strong>${escapeHtml(item.material)}</strong><div class="muted">${dateBr(item.data_lancamento)} · ${item.quantidade} ${escapeHtml(item.unidade)}${item.observacao ? ` · ${escapeHtml(item.observacao)}` : ""}</div></div>
    <button type="button" class="danger remove-material" data-id="${item.id}" data-os="${data.id_os}" data-appointment="${data.id_agendamento}" aria-label="Remover ${escapeHtml(item.material)}">Remover</button>
  </div>`).join("") || `<div class="card muted">Nenhum material registrado nesta OS.</div>`;
  const inkRecipeHtml = data.batoques.map(cup => `<article class="card ink-recipe-card">
    <div class="card-head"><div><strong>${escapeHtml(cup.identificacao)} · ${escapeHtml(cup.tamanho)}</strong>
      <div class="muted">${dateBr(cup.data_registro)}${cup.capacidade_ml ? ` · capacidade ${cup.capacidade_ml} ml` : ""}</div></div>
      <button type="button" class="danger remove-ink-recipe" data-id="${cup.id}" data-os="${data.id_os}">Remover</button></div>
    <div class="ink-formula">${cup.tintas.map(ink => `<div><span>${escapeHtml(ink.nome_tinta)}${ink.cor ? ` · ${escapeHtml(ink.cor)}` : ""}</span>
      <strong>${ink.gotas} gotas</strong><small>${ink.volume_consumido_ml} ml estimados</small></div>`).join("")}</div>
    ${cup.observacao ? `<p class="muted">${escapeHtml(cup.observacao)}</p>` : ""}
  </article>`).join("") || `<div class="card muted">Nenhuma mistura de tinta registrada.</div>`;
  $("#orderContent").innerHTML = `<header><h2>Ordem de serviço #${data.id_os}</h2><button class="close" type="button">×</button></header>
    <div class="tabs"><button class="tab active" data-tab="os-data">Cliente</button><button class="tab" data-tab="os-service">Serviço</button><button class="tab" data-tab="os-schedule">Agendamento</button><button class="tab" data-tab="os-finance">Financeiro</button></div>
    <div class="tab-pane active" id="os-data"><h2>${escapeHtml(data.nome)}</h2><p>${escapeHtml(data.telefone)} · ${escapeHtml(data.cidade)}</p><p class="muted">${escapeHtml(data.observacoes)}</p></div>
    <div class="tab-pane" id="os-service"><div class="card service-summary"><span class="muted">Descrição atual</span><p>${escapeHtml(data.descricao || "Nenhuma descrição registrada.")}</p></div>
      <div class="finance-actions service-actions"><button class="primary" type="button" data-service-action="description">Editar descrição</button><button class="secondary" type="button" data-service-action="ink">Mistura de tintas</button><button class="secondary" type="button" data-service-action="material">Adicionar material</button></div>
      <h2>Receitas de tintas</h2>${inkRecipeHtml}
      <h2>Outros materiais utilizados</h2>${materialHtml}
    </div>
    <div class="tab-pane" id="os-schedule"><form id="scheduleForm"><div class="fields"><label>Data<input name="data" type="date" value="${date}"></label><label>Hora<input name="hora" type="time" value="${time.slice(0,5)}"></label></div><label>Status<select name="status">${["Agendado","Confirmado","Em Atendimento","Finalizado","Cancelado","Remarcado"].map(x => `<option ${x === data.status_agendamento ? "selected" : ""}>${x}</option>`).join("")}</select></label><button class="primary">Salvar</button></form></div>
    <div class="tab-pane" id="os-finance"><div class="stats"><div class="card stat">Valor final<strong>${money(data.valor_final)}</strong></div><div class="card stat">Total pago<strong>${money(data.total_pago)}</strong></div><div class="card stat">Saldo aberto<strong>${money(data.saldo_aberto)}</strong></div></div>
      <div class="finance-actions"><button class="primary" type="button" data-finance-action="payment">Registrar pagamento</button>
      ${!data.parcelas.length && data.saldo_aberto > 0 ? `<button class="secondary" type="button" data-finance-action="credit">Criar crediário</button>` : ""}
      <button class="secondary" type="button" data-finance-action="adjustment">Acréscimo ou desconto</button></div>
      ${installmentHtml ? `<h2>Parcelas</h2>${installmentHtml}` : ""}
      <h2>Histórico financeiro</h2><div class="finance-history">${financeHistory}</div></div>`;
  $("#orderDialog").showModal();
  $("#scheduleForm").onsubmit = async e => { e.preventDefault(); await send(`/api/agendamentos/${data.id_agendamento}`, "PUT", e.currentTarget); toast("Agendamento atualizado."); $("#orderDialog").close(); loadAgenda(); };
}

document.addEventListener("input", event => {
  if (event.target.matches("[data-money]")) maskMoney(event.target);
  if (event.target.matches("[data-cpf]")) maskCpf(event.target);
});

document.addEventListener("click", event => {
  const nav = event.target.closest(".nav-link");
  if (nav) { try { sessionStorage.setItem("activePage", nav.dataset.page); } catch {} $$(".nav-link,.page").forEach(x => x.classList.remove("active")); nav.classList.add("active"); $(`#${nav.dataset.page}`).classList.add("active"); $("#sidebar").classList.remove("open"); if (nav.dataset.page === "agenda") showAgenda().catch(error => toast(error.message)); if (nav.dataset.page === "clientes") { $("#clientSearch").value = ""; loadClients(); } if (nav.dataset.page === "financeiro") { loadFinance(); loadFinancialManagement(); } if (nav.dataset.page === "estoque") loadStock(); }
  if (event.target.closest("[data-open=appointment]")) openAppointment();
  if (event.target.closest("[data-open=client]")) openNewClient();
  if (event.target.closest(".close")) event.target.closest("dialog").close();
  const client = event.target.closest(".select-client");
  if (client) {
    $("#clientSearch").value = client.dataset.name;
    $("#clientList").innerHTML = "";
    loadClient(client.dataset.id);
  }
  const order = event.target.closest(".open-order"); if (order && !order.dataset.os) openOrder(order.dataset.id);
  const signal = event.target.closest(".receive-signal");
  if (signal) {
    api(`/api/os?id=${signal.dataset.id}`).then(data => {
      activeOrderData = data;
      openFinanceAction("payment", {
        tipo: "Sinal", valor: signal.dataset.value, forma_pagamento: "Pix",
        data_pagamento: todaySp(), observacao: "SINAL"
      }, false);
    }).catch(error => toast(error.message));
  }
  const financeAction = event.target.closest("[data-finance-action]");
  if (financeAction) openFinanceAction(financeAction.dataset.financeAction);
  const serviceAction = event.target.closest("[data-service-action]");
  if (serviceAction) openServiceAction(serviceAction.dataset.serviceAction);
  const stockAction = event.target.closest("[data-stock-action]");
  if (stockAction) openStockAction(stockAction.dataset.stockAction, stockAction.dataset.id);
  const managementAction = event.target.closest("[data-management-action]");
  if (managementAction) openManagementAction(managementAction.dataset.managementAction);
  const managementPayment = event.target.closest(".pay-management");
  if (managementPayment) openManagementPayment(managementPayment);
  const installment = event.target.closest(".pay-installment");
  if (installment) openInstallmentPayment(installment);
  const material = event.target.closest(".remove-material");
  if (material) {
    if (!confirm("Remover este material da ordem de serviço?")) return;
    api(`/api/os/${material.dataset.os}/materiais/${material.dataset.id}`, { method: "DELETE" })
      .then(async () => {
        toast("Material removido.");
        $("#orderDialog").close();
        await openOrder(material.dataset.appointment);
        $("[data-tab=os-service]").click();
      }).catch(error => toast(error.message));
  }
  const inkRecipe = event.target.closest(".remove-ink-recipe");
  if (inkRecipe) {
    if (!confirm("Remover esta receita e devolver o volume estimado ao estoque?")) return;
    api(`/api/os/${inkRecipe.dataset.os}/tintas/${inkRecipe.dataset.id}`, { method: "DELETE" })
      .then(async () => {
        toast("Receita removida e estoque restaurado.");
        await refreshOrder("os-service");
      }).catch(error => toast(error.message));
  }
  const tab = event.target.closest(".tab"); if (tab) { const root = tab.closest("dialog") || $("#clientDetail"); $$(".tab,.tab-pane", root).forEach(x => x.classList.remove("active")); tab.classList.add("active"); $(`#${tab.dataset.tab}`, root).classList.add("active"); }
});
$("#menuButton").onclick = () => $("#sidebar").classList.toggle("open");
$("#clientSearch").oninput = event => loadClients(event.target.value);
$("#appointmentForm").onsubmit = async event => {
  event.preventDefault(); await send("/api/agendamentos", "POST", event.currentTarget);
  $("#appointmentDialog").close(); toast("Agendamento criado."); loadAgenda();
};
$("#appointmentForm").elements.nome.oninput = async event => {
  const value = event.target.value; if (value.length < 2) return $("#clientSuggestions").innerHTML = "";
  const clients = await api(`/api/clientes?busca=${encodeURIComponent(value)}`);
  $("#clientSuggestions").innerHTML = clients.slice(0, 6).map(c => `<button type="button" class="client-item suggestion" data-id="${c.id}" data-name="${escapeHtml(c.nome)}" data-phone="${escapeHtml(c.telefone)}">${escapeHtml(c.nome)}</button>`).join("");
};
$("#clientSuggestions").onclick = event => {
  const item = event.target.closest(".suggestion"); if (!item) return;
  const form = $("#appointmentForm"); form.elements.id_cliente.value = item.dataset.id; form.elements.nome.value = item.dataset.name; form.elements.telefone.value = item.dataset.phone; $("#clientSuggestions").innerHTML = "";
};

function setupPullToRefresh() {
  if (!window.matchMedia("(max-width: 800px)").matches) return;

  const indicator = $("#pullRefresh");
  const icon = $(".pull-refresh-icon", indicator);
  const label = $(".pull-refresh-text", indicator);
  const threshold = 48;
  const maxPull = 96;
  let startY = 0;
  let startX = 0;
  let distance = 0;
  let tracking = false;
  let refreshing = false;
  const atTop = () => Math.max(window.scrollY, document.scrollingElement?.scrollTop || 0) <= 4;

  const reset = () => {
    distance = 0;
    tracking = false;
    indicator.setAttribute("aria-hidden", "true");
    indicator.removeAttribute("aria-busy");
    indicator.style.setProperty("--pull-distance", "0px");
    indicator.classList.remove("visible", "ready");
    icon.textContent = "↓";
    label.textContent = "Puxe para atualizar";
  };

  document.addEventListener("touchstart", event => {
    if (refreshing || !atTop() || $("dialog[open]") || event.touches.length !== 1) return;
    startY = event.touches[0].clientY;
    startX = event.touches[0].clientX;
    tracking = true;
  }, { passive: true });

  document.addEventListener("touchmove", event => {
    if (!tracking || refreshing) return;
    const touch = event.touches[0];
    const delta = touch.clientY - startY;
    const horizontal = Math.abs(touch.clientX - startX);
    if (horizontal > Math.abs(delta) || delta <= 0 || !atTop()) return reset();

    if (event.cancelable) event.preventDefault();
    distance = Math.min(maxPull, delta * 0.65);
    indicator.setAttribute("aria-hidden", "false");
    indicator.style.setProperty("--pull-distance", `${distance}px`);
    indicator.classList.add("visible");
    indicator.classList.toggle("ready", distance >= threshold);
    icon.textContent = distance >= threshold ? "↑" : "↓";
    label.textContent = distance >= threshold ? "Solte para atualizar" : "Puxe para atualizar";
  }, { passive: false });

  document.addEventListener("touchend", async () => {
    if (!tracking || refreshing) return;
    tracking = false;
    if (distance < threshold) return reset();

    refreshing = true;
    indicator.setAttribute("aria-hidden", "false");
    indicator.setAttribute("aria-busy", "true");
    indicator.classList.add("refreshing");
    indicator.classList.remove("ready");
    indicator.style.setProperty("--pull-distance", "58px");
    label.textContent = "Atualizando";
    icon.textContent = "↻";
    try {
      try { sessionStorage.setItem("activePage", $(".page.active")?.id || "agenda"); } catch {}
      await new Promise(resolve => setTimeout(resolve, 700));
      window.location.reload();
    } catch (error) {
      toast(error.message);
    } finally {
      refreshing = false;
      indicator.classList.remove("refreshing");
      reset();
    }
  }, { passive: true });

  document.addEventListener("touchcancel", reset, { passive: true });
}

let applicationStarted = false;

function showLogin() {
  document.body.classList.add("auth-loading");
  document.body.classList.remove("authenticated");
  applicationStarted = false;
}

async function startApplication() {
  document.body.classList.remove("auth-loading");
  document.body.classList.add("authenticated");
  if (applicationStarted) return;
  applicationStarted = true;
  setupPullToRefresh();
  try {
    const savedPage = sessionStorage.getItem("activePage");
    const savedNav = savedPage ? $(`.nav-link[data-page="${savedPage}"]`) : null;
    if (savedNav && savedPage !== "agenda") savedNav.click();
  } catch {}
  if ($("#agenda").classList.contains("active")) {
    showAgenda().catch(error => toast(error.message));
  }
}

async function checkAuthentication() {
  try {
    const session = await api("/api/auth/me");
    if (session.authenticated) await startApplication();
  } catch {
    showLogin();
  }
}

$("#loginForm").onsubmit = async event => {
  event.preventDefault();
  $("#loginError").textContent = "";

  const form = event.currentTarget;
  const button = form.querySelector("button[type='submit']");

  if (button) button.disabled = true;

  try {
    await send("/api/auth/login", "POST", form);

    if (form) {
      form.reset();
    }

    await startApplication();
  } catch (error) {
    $("#loginError").textContent = error.message;
  } finally {
    if (button) button.disabled = false;
  }
};

$("#logoutButton").onclick = async () => {
  await post("/api/auth/logout");
  $("#sidebar").classList.remove("open");
  showLogin();
};

window.addEventListener("resize", () => {
  if ($("#agenda").classList.contains("active")) calendar?.updateSize();
});

checkAuthentication();
