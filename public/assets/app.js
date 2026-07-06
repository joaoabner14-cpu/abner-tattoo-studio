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
const maskCnpj = input => {
  const digits = input.value.replace(/\D/g, "").slice(0, 14);
  input.value = digits.replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};
const applyInputMasks = (root = document) => {
  $$("[data-money]", root).forEach(input => {
    if (input.value && !input.value.includes("R$")) input.value = moneyInput(input.value);
  });
  $$("[data-cpf]", root).forEach(maskCpf);
  $$("[data-cnpj]", root).forEach(maskCnpj);
};
const safeFileName = value => String(value || "cliente").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-")
  .replace(/^-+|-+$/g, "").toLowerCase();

async function exportClientData(id, name) {
  const data = await api(`/api/clientes/${id}/lgpd/exportar`);
  const url = URL.createObjectURL(new Blob(
    [JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" }
  ));
  const link = document.createElement("a");
  link.href = url;
  link.download = `dados-${safeFileName(name)}-${todaySp()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  toast("Dados do cliente exportados.");
}

let calendar;
let selectedClientId = null;
let activeOrderData = null;
let clientSearchRequest = 0;
let stockData = null;
let managementData = null;
let dashboardFinanceData = null;
let profilePhotoData = "";
let profileCrop = null;
let marketingData = [];
let marketingArtData = "";
let marketingOpportunities = [];
let notificationsData = [];
let sessionUser = null;
let studiosData = [];
async function loadAgenda() {
  if (!calendar) {
    calendar = new FullCalendar.Calendar($("#calendar"), {
      locale: "pt-br", initialView: "dayGridMonth", height: "auto",
      events: "/api/agendamentos",
      dateClick: info => openAppointment(info.dateStr),
      eventClick: info => {
        const { tipo, id_agendamento: appointmentId } = info.event.extendedProps;
        if (tipo === "marketing") {
          openMarketingRecord(info.event.extendedProps.id_marketing);
          return;
        }
        if (!appointmentId) return;
        openOrder(appointmentId, tipo === "crediario" ? "os-finance" : "os-data");
      }
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
  const currentMonth = todaySp().slice(0, 7);
  const [data, monthly] = await Promise.all([
    api("/api/dashboard"),
    api(`/api/financeiro/gestao?mes=${currentMonth}&visao=mensal`)
  ]);
  dashboardFinanceData = monthly;
  const summary = monthly.resumo;
  const html = `<div class="stats home-finance-stats">
    <button class="card stat income summary-card" data-home-summary="entradas"><span class="muted">Entradas</span><strong>${money(summary.entradas)}</strong></button>
    <button class="card stat expense summary-card" data-home-summary="saidas"><span class="muted">Saídas</span><strong>${money(summary.saidas)}</strong></button>
    <button class="card stat summary-card ${summary.resultado < 0 ? "stat-late" : ""}" data-home-summary="resultado"><span class="muted">Resultado</span><strong>${money(summary.resultado)}</strong></button>
    <button class="card stat summary-card" data-home-summary="receber"><span class="muted">A receber</span><strong>${money(summary.receber)}</strong></button>
    <button class="card stat summary-card" data-home-summary="pagar"><span class="muted">A pagar</span><strong>${money(summary.pagar)}</strong></button>
    <button class="card stat stat-late summary-card" data-home-summary="atraso"><span class="muted">Em atraso</span><strong>${money(summary.atrasado)}</strong></button>
  </div><h2>Sinais pendentes</h2>${data.sinais_pendentes.map(x => `<div class="card card-head"><div><strong>${escapeHtml(x.nome)}</strong><div class="muted">${x.data_agendamento} · ${money(x.valor)}</div></div><button class="primary receive-signal" data-id="${x.id_agendamento}" data-value="${Number(x.valor)}">Receber sinal</button></div>`).join("") || `<div class="card muted">Nenhum sinal pendente.</div>`}
  <h2>Parcelas atrasadas</h2>${data.parcelas_atrasadas.map(x => `<div class="card overdue-card">
    <div><strong>${escapeHtml(x.nome)}</strong><div class="muted">Parcela ${x.parcela}/${x.total_parcelas} · ${money(x.valor)} · venceu ${dateBr(x.vencimento)}</div></div>
    <div class="card-actions"><a class="secondary" target="_blank" rel="noopener" href="${x.link_whatsapp}">Cobrar</a>${x.id_agendamento ? `<button class="primary open-order" data-id="${x.id_agendamento}">Abrir</button>` : ""}</div>
  </div>`).join("") || `<div class="card muted">Nenhuma parcela atrasada.</div>`}`;
  $("#financePanel").innerHTML = html;
}

async function loadFinancialManagement(
  month = todaySp().slice(0, 7),
  view = managementData?.visao || "mensal"
) {
  managementData = await api(`/api/financeiro/gestao?mes=${month}&visao=${view}`);
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
  $("#fullFinancePanel").innerHTML = `<div class="management-period">
    <label>Visão<select id="financeView"><option value="mensal" ${managementData.visao === "mensal" ? "selected" : ""}>Mensal</option><option value="geral" ${managementData.visao === "geral" ? "selected" : ""}>Visão geral</option></select></label>
    <label ${managementData.visao === "geral" ? "hidden" : ""}>Período<input id="financeMonth" type="month" value="${managementData.periodo}"></label>
  </div>
    <div class="management-stats">
      <button class="card stat income summary-card" data-summary="entradas"><span class="muted">Entradas</span><strong>${money(summary.entradas)}</strong></button>
      <button class="card stat expense summary-card" data-summary="saidas"><span class="muted">Saídas</span><strong>${money(summary.saidas)}</strong></button>
      <button class="card stat summary-card ${summary.resultado < 0 ? "stat-late" : ""}" data-summary="resultado"><span class="muted">Resultado</span><strong>${money(summary.resultado)}</strong></button>
      <button class="card stat summary-card" data-summary="receber"><span class="muted">A receber</span><strong>${money(summary.receber)}</strong></button>
      <button class="card stat summary-card" data-summary="pagar"><span class="muted">A pagar</span><strong>${money(summary.pagar)}</strong></button>
      <button class="card stat stat-late summary-card" data-summary="atraso"><span class="muted">Em atraso</span><strong>${money(summary.atrasado)}</strong></button>
    </div>
    <section class="card mei-card"><div class="card-head"><div><span class="eyebrow">MEI 2026</span><h2>Faturamento anual</h2></div><strong>${money(summary.faturamento_anual)} / ${money(summary.limite_mei)}</strong></div>
      <div class="mei-progress"><span style="width:${limitPercent}%"></span></div><small class="muted">${limitPercent.toFixed(1).replace(".", ",")}% do limite anual. Receitas a prazo devem ser conferidas pelo mês da prestação para o relatório oficial.</small></section>
    <div class="management-actions"><button class="primary" data-management-action="Receita">Registrar receita</button><button class="secondary" data-management-action="Despesa">Registrar despesa</button>
      <button class="secondary" data-management-action="Conta">Conta a pagar</button><button class="secondary" data-management-action="DAS">Cadastrar DAS</button></div>
    <div class="management-columns"><section><h2>Contas pendentes</h2>${pending}</section><section><h2>Despesas por categoria</h2><div class="card category-list">${categories}</div></section></div>
    <h2>Fluxo de caixa do mês</h2><div class="management-history">${cash}</div>
    <p class="management-note">Controle gerencial. Confira o Relatório Mensal de Receitas Brutas e a DASN-SIMEI nos canais oficiais do MEI.</p>`;
  $("#financeMonth")?.addEventListener("change", event =>
    loadFinancialManagement(event.target.value, managementData.visao));
  $("#financeView").onchange = event =>
    loadFinancialManagement(managementData.periodo, event.target.value);
}

function openSummaryDetails(kind, source = managementData) {
  const titles = {
    entradas: "Entradas", saidas: "Saídas", resultado: "Resultado",
    receber: "Valores a receber", pagar: "Valores a pagar", atraso: "Valores em atraso"
  };
  const cashItem = item => ({
    title: item.descricao || item.categoria,
    detail: `${dateBr(item.data_movimento)}${item.cliente ? ` · ${item.cliente}` : ""}`,
    value: item.valor,
    sign: item.tipo === "Saida" ? -1 : 1,
    cashId: item.id,
    appointmentId: item.id_agendamento
  });
  const cash = source.caixa || [];
  let items = [];
  if (kind === "entradas") items = cash.filter(item => item.tipo === "Entrada").map(cashItem);
  if (kind === "saidas") items = cash.filter(item => item.tipo === "Saida").map(cashItem);
  if (kind === "resultado") items = cash.map(cashItem);
  if (kind === "receber") {
    items = [
      ...(source.recebiveis_clientes || []).map(item => ({
        title: item.nome, detail: `OS #${item.id_os}`, value: item.saldo,
        appointmentId: item.id_agendamento
      })),
      ...source.lancamentos.filter(item =>
        item.tipo === "Receita" && item.status === "Pendente" &&
        (source.visao === "geral" || item.competencia === source.periodo)
      ).map(item => ({
        title: item.descricao, detail: item.data_vencimento
          ? `Vence ${dateBr(item.data_vencimento)}` : item.categoria,
        value: item.valor, launchId: item.id
      }))
    ];
  }
  if (kind === "pagar") {
    items = source.lancamentos.filter(item =>
      ["Despesa", "DAS"].includes(item.tipo) && item.status === "Pendente" &&
      (source.visao === "geral" || item.competencia === source.periodo)
    ).map(item => ({
      title: item.descricao, detail: item.data_vencimento
        ? `Vence ${dateBr(item.data_vencimento)}` : item.categoria,
      value: item.valor, launchId: item.id
    }));
  }
  if (kind === "atraso") {
    items = [
      ...source.lancamentos.filter(item =>
        item.status === "Pendente" && item.data_vencimento &&
        item.data_vencimento < todaySp()
      ).map(item => ({
        title: item.descricao, detail: `Venceu ${dateBr(item.data_vencimento)}`,
        value: item.valor, launchId: item.id
      })),
      ...(source.crediarios_atrasados || []).map(item => ({
        title: item.nome, detail: `OS #${item.id_os} · venceu ${dateBr(item.data_vencimento)}`,
        value: item.valor, appointmentId: item.id_agendamento
      }))
    ];
  }
  const rows = items.map(item => `<article class="summary-detail-item">
    <div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail || "")}</small></div>
    <strong class="${item.sign < 0 ? "negative" : ""}">${item.sign < 0 ? "- " : ""}${money(item.value)}</strong>
    <div class="summary-detail-actions">
      ${item.appointmentId ? `<button class="secondary open-summary-order" data-id="${item.appointmentId}">Abrir OS</button>` : ""}
      ${item.cashId ? `<button class="danger cancel-cash-entry" data-id="${item.cashId}">Cancelar lançamento</button>` : ""}
      ${item.launchId ? `<button class="danger cancel-management-entry" data-id="${item.launchId}">Cancelar lançamento</button>` : ""}
    </div>
  </article>`).join("") || `<div class="card muted">Nenhum lançamento neste painel.</div>`;
  $("#actionContent").innerHTML = `<header><h2>${titles[kind]}</h2><button class="close" type="button">×</button></header>
    <div class="summary-detail-list">${rows}</div>`;
  $("#actionDialog").showModal();
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

async function loadMarketing() {
  [marketingData, marketingOpportunities] = await Promise.all([
    api("/api/marketing"), api("/api/marketing/oportunidades")
  ]);
  const month = $("#marketingMonth")?.value || todaySp().slice(0, 7);
  const status = $("#marketingStatus")?.value || "";
  const filtered = marketingData.filter(item => {
    const date = item.data_postagem || item.data_inicio || "";
    return (!month || date.startsWith(month)) && (!status || item.status === status);
  });
  const planned = filtered.filter(item => ["Planejado", "Produção", "Agendado"].includes(item.status)).length;
  const boosted = filtered.filter(item => item.impulsionar).length;
  const boostCost = filtered.reduce((sum, item) =>
    sum + (item.impulsionar ? Number(item.orcamento || 0) : 0), 0);
  const upcoming = marketingOpportunities.filter(item => item.days >= 0).slice(0, 6);
  const next = upcoming[0];
  const attention = upcoming.filter(item =>
    item.days <= 30 && !item.id_planejamento);
  const guidance = item => !item.id_planejamento
    ? item.days <= 30 ? "Criar campanha agora" : "Ainda há tempo para planejar"
    : item.days <= 3 ? "Publicar e reforçar nos stories"
      : item.days <= 7 ? "Finalizar arte e legenda"
        : item.days <= 15 ? "Preparar conteúdo"
          : "Definir oferta e estratégia";
  $("#marketingPanel").innerHTML = `${next ? `<section class="marketing-next ${!next.id_planejamento && next.days <= 30 ? "needs-attention" : ""}">
    <div><span class="eyebrow">PRÓXIMA OPORTUNIDADE</span><h2>${escapeHtml(next.name)}</h2>
    <p>${dateBr(next.date)} · ${next.days === 0 ? "é hoje" : `faltam ${next.days} dias`} · ${guidance(next)}</p></div>
    <div class="opportunity-actions"><button class="${next.id_planejamento ? "secondary open-opportunity-plan" : "primary plan-opportunity"}" data-key="${next.key}" data-id="${next.id_planejamento || ""}">${next.id_planejamento ? "Abrir campanha" : "Planejar campanha"}</button>
    ${next.id_planejamento ? `<button class="danger restart-opportunity-plan" data-id="${next.id_planejamento}">Reiniciar</button>` : ""}</div>
  </section>` : ""}
  ${attention.length ? `<div class="marketing-alert"><strong>${attention.length} oportunidade(s) precisam de planejamento nos próximos 30 dias.</strong></div>` : ""}
  <h2>Calendário de oportunidades</h2>
  <div class="opportunity-grid">${upcoming.map(item => `<article class="card opportunity-card ${!item.id_planejamento && item.days <= 30 ? "is-urgent" : ""}">
    <div><strong>${escapeHtml(item.name)}</strong><small>${dateBr(item.date)} · ${item.days === 0 ? "Hoje" : `${item.days} dias`}</small><small>${guidance(item)}</small></div>
    <span class="badge">${escapeHtml(item.status)}</span>
    <div class="opportunity-actions"><button class="${item.id_planejamento ? "secondary open-opportunity-plan" : "primary plan-opportunity"}" data-key="${item.key}" data-id="${item.id_planejamento || ""}">${item.id_planejamento ? "Abrir" : "Planejar"}</button>
    ${item.id_planejamento ? `<button class="danger restart-opportunity-plan" data-id="${item.id_planejamento}">Reiniciar</button>` : ""}</div>
  </article>`).join("")}</div>
  <h2>Banco de campanhas</h2>
  <div class="marketing-toolbar">
    <label>Mês<input id="marketingMonth" type="month" value="${month}"></label>
    <label>Status<select id="marketingStatus"><option value="">Todos</option>${["Ideia","Planejado","Produção","Agendado","Publicado","Encerrado"].map(value => `<option ${value === status ? "selected" : ""}>${value}</option>`).join("")}</select></label>
  </div>
  <div class="stats marketing-stats">
    <div class="card stat"><span class="muted">Itens no mês</span><strong>${filtered.length}</strong></div>
    <div class="card stat"><span class="muted">Em preparação</span><strong>${planned}</strong></div>
    <div class="card stat"><span class="muted">Impulsionados</span><strong>${boosted}</strong></div>
    <div class="card stat"><span class="muted">Investimento</span><strong>${money(boostCost)}</strong><small>Impulsionamento no mês</small></div>
  </div>
  <div class="marketing-list">${filtered.map(item => `<article class="card marketing-card">
    ${item.tem_arte ? `<img class="marketing-card-art" src="/api/marketing/${item.id}/arte" alt="Arte de ${escapeHtml(item.titulo)}" loading="lazy">` : ""}
    <div class="card-head"><div><span class="badge">${escapeHtml(item.tipo)}</span><strong>${escapeHtml(item.titulo)}</strong></div><span class="badge">${escapeHtml(item.status)}</span></div>
    <p>${escapeHtml(item.descricao || "Sem descrição.")}</p>
    <div class="marketing-meta">
      <span>Publicação: ${item.data_postagem ? `${dateBr(item.data_postagem)}${item.hora_postagem ? ` às ${item.hora_postagem}` : ""}` : "não definida"}</span>
      <span>Canais: ${escapeHtml(item.plataformas || "não definidos")}</span>
      ${item.impulsionar ? `<span>Impulsionamento: ${dateBr(item.impulsionamento_inicio)} a ${dateBr(item.impulsionamento_fim)} · custo total ${money(item.orcamento)}</span>` : ""}
    </div>
    ${item.texto_postagem ? `<div class="marketing-caption">${escapeHtml(item.texto_postagem)}</div>` : ""}
    <div class="card-actions">
      ${item.texto_postagem ? `<button class="secondary copy-marketing-caption" data-id="${item.id}">Copiar legenda</button>` : ""}
      <button class="secondary" data-marketing-action="edit" data-id="${item.id}">Editar</button>
      <button class="danger delete-marketing" data-id="${item.id}">Excluir</button>
    </div>
  </article>`).join("") || `<div class="panel empty">Nenhum planejamento para este período.</div>`}</div>`;
  $("#marketingMonth").onchange = loadMarketing;
  $("#marketingStatus").onchange = loadMarketing;
}

async function openMarketingRecord(id) {
  $(`.nav-link[data-page="marketing"]`)?.click();
  await loadMarketing();
  openMarketingPlan(id);
}

async function loadNotifications() {
  notificationsData = await api("/api/notificacoes");
  const badge = $("#notificationBadge");
  badge.textContent = notificationsData.length;
  badge.hidden = notificationsData.length === 0;
}

function openNotifications() {
  const rows = notificationsData.map(item => `<button class="notification-item" type="button" data-notification-plan="${item.id_planejamento || ""}" data-notification-key="${item.chave || ""}">
    <span class="notification-icon">${item.dias < 0 ? "!" : item.tipo === "oportunidade" ? "★" : "•"}</span>
    <span><strong>${escapeHtml(item.titulo)}</strong><small>${escapeHtml(item.mensagem)} · ${dateBr(item.data)}</small></span>
  </button>`).join("") || `<div class="card muted">Nenhuma notificação de marketing.</div>`;
  $("#actionContent").innerHTML = `<header><h2>Notificações</h2><button class="close" type="button">×</button></header>
    <div class="notification-list">${rows}</div>`;
  $("#actionDialog").showModal();
}

function openMarketingPlan(itemId = "") {
  const item = marketingData.find(entry => String(entry.id) === String(itemId)) || {};
  marketingArtData = "";
  const selectedPlatforms = String(item.plataformas || "").split(",").map(value => value.trim());
  const selectedObjectives = String(item.objetivo || "").split(",").map(value => value.trim());
  const selectedAudiences = String(item.publico || "").split(",").map(value => value.trim());
  $("#actionContent").innerHTML = `<header><h2>${item.id ? "Editar" : "Novo"} planejamento</h2><button class="close" type="button">×</button></header>
    <form id="marketingForm">
      <label class="marketing-art-field">
        <span id="marketingArtPreview" class="marketing-art-preview">${item.tem_arte ? `<img src="/api/marketing/${item.id}/arte?v=${Date.now()}" alt="Arte da campanha">` : "Adicionar arte"}</span>
        <span>${item.tem_arte ? "Substituir arte" : "Escolher arte"}</span>
        <input name="arte" type="file" accept="image/jpeg,image/png,image/webp" hidden>
      </label>
      <label>Título<input name="titulo" value="${escapeHtml(item.titulo)}" required></label>
      <div class="fields"><label>Tipo<select name="tipo">${["Promoção","Evento","Postagem"].map(value => `<option ${value === item.tipo ? "selected" : ""}>${value}</option>`).join("")}</select></label>
      <label>Status<select name="status">${["Ideia","Planejado","Produção","Agendado","Publicado","Encerrado"].map(value => `<option ${value === item.status ? "selected" : ""}>${value}</option>`).join("")}</select></label></div>
      <label>Descrição da ação<textarea name="descricao">${escapeHtml(item.descricao)}</textarea></label>
      <label>Oferta ou chamada principal<input name="oferta" value="${escapeHtml(item.oferta)}"></label>
      <fieldset class="platform-field"><legend>Redes sociais</legend>
        <input name="plataformas" type="hidden" value="${escapeHtml(item.plataformas)}">
        <div class="platform-options">${["Instagram","Facebook","TikTok","WhatsApp","Threads"].map(value => `<label><input type="checkbox" data-platform value="${value}" ${selectedPlatforms.includes(value) ? "checked" : ""}><span>${value}</span></label>`).join("")}</div>
      </fieldset>
      <div class="fields"><label>Início da ação<input name="data_inicio" type="date" value="${item.data_inicio || ""}"></label><label>Fim da ação<input name="data_fim" type="date" value="${item.data_fim || ""}"></label></div>
      <div class="fields"><label>Data da postagem<input name="data_postagem" type="date" value="${item.data_postagem || ""}"></label><label>Horário<input name="hora_postagem" type="time" value="${item.hora_postagem || ""}"></label></div>
      <label>Legenda planejada<textarea name="texto_postagem" placeholder="Texto, chamada e hashtags...">${escapeHtml(item.texto_postagem)}</textarea></label>
      <fieldset class="platform-field"><legend>Objetivos</legend>
        <input name="objetivo" type="hidden" value="${escapeHtml(item.objetivo)}">
        <div class="platform-options">${["Gerar agendamentos","Aumentar alcance","Gerar engajamento","Ganhar seguidores","Divulgar evento","Vender promoção"].map(value => `<label><input type="checkbox" data-objective value="${value}" ${selectedObjectives.includes(value) ? "checked" : ""}><span>${value}</span></label>`).join("")}</div>
      </fieldset>
      <fieldset class="platform-field"><legend>Público</legend>
        <input name="publico" type="hidden" value="${escapeHtml(item.publico)}">
        <div class="platform-options">${["Novos clientes","Clientes atuais","Pessoas da região","Interessados em tatuagem","Público jovem","Pessoas que já interagiram"].map(value => `<label><input type="checkbox" data-audience value="${value}" ${selectedAudiences.includes(value) ? "checked" : ""}><span>${value}</span></label>`).join("")}</div>
      </fieldset>
      <label class="check-label"><input name="impulsionar" type="checkbox" value="1" ${item.impulsionar ? "checked" : ""}> Esta publicação será impulsionada</label>
      <div class="fields"><label>Início do impulso<input name="impulsionamento_inicio" type="date" value="${item.impulsionamento_inicio || ""}"></label><label>Fim do impulso<input name="impulsionamento_fim" type="date" value="${item.impulsionamento_fim || ""}"></label></div>
      <label>Custo total do impulsionamento<input name="orcamento" data-money inputmode="numeric" value="${item.orcamento ? moneyInput(item.orcamento) : ""}"><small class="muted">Informe quanto será gasto durante todo o período.</small></label>
      <label>Observações<textarea name="observacoes">${escapeHtml(item.observacoes)}</textarea></label>
      <button class="primary">Salvar planejamento</button>
    </form>`;
  applyInputMasks($("#actionContent"));
  $("#actionDialog").showModal();
  $("#marketingForm").elements.arte.onchange = async event => {
    try {
      const image = await loadProfilePhoto(event.target.files[0]);
      const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      marketingArtData = canvas.toDataURL("image/jpeg", .82);
      if (marketingArtData.length > 1400000) {
        throw new Error("A arte ficou muito grande. Escolha uma imagem menor.");
      }
      $("#marketingArtPreview").innerHTML = `<img src="${marketingArtData}" alt="Prévia da arte">`;
    } catch (error) {
      marketingArtData = "";
      toast(error.message);
    }
  };
  $("#marketingForm").onsubmit = async event => {
    event.preventDefault();
    const form = event.currentTarget;
    form.elements.plataformas.value = $$("[data-platform]:checked", form)
      .map(input => input.value).join(", ");
    form.elements.objetivo.value = $$("[data-objective]:checked", form)
      .map(input => input.value).join(", ");
    form.elements.publico.value = $$("[data-audience]:checked", form)
      .map(input => input.value).join(", ");
    form.elements.arte.disabled = true;
    const result = await send(item.id ? `/api/marketing/${item.id}` : "/api/marketing",
      item.id ? "PUT" : "POST", form);
    form.elements.arte.disabled = false;
    const planId = item.id || result.id;
    if (marketingArtData) {
      await post(`/api/marketing/${planId}/arte`, { imagem: marketingArtData });
    }
    $("#actionDialog").close();
    toast("Planejamento salvo.");
    await loadMarketing();
    await loadNotifications();
    calendar?.refetchEvents();
  };
}

async function loadStudios() {
  studiosData = await api("/api/admin/estudios");
  $("#studiosPanel").innerHTML = `<div class="studio-admin-grid">${studiosData.map(item => `
    <article class="card studio-admin-card">
      <div class="card-head"><div><strong>${escapeHtml(item.nome_estudio)}</strong>
        <small>${escapeHtml(item.nome_responsavel || item.nome_usuario || "")}</small></div>
        <span class="badge ${item.ativo ? "" : "badge-late"}">${item.ativo ? "Ativo" : "Inativo"}</span></div>
      <div class="studio-admin-details">
        <span>Usuário<strong>${escapeHtml(item.login || "—")}</strong></span>
        <span>Clientes<strong>${item.total_clientes || 0}</strong></span>
        <span>CNPJ<strong>${escapeHtml(item.cnpj || "Não informado")}</strong></span>
        <span>Instagram<strong>${escapeHtml(item.instagram || "Não informado")}</strong></span>
      </div>
      <p class="muted">${escapeHtml(item.endereco || "Endereço não informado")}</p>
      <button class="secondary" data-studio-action="edit" data-id="${item.id}">Editar estúdio</button>
    </article>`).join("") || `<div class="panel empty">Nenhum estúdio cadastrado.</div>`}</div>`;
}

async function loadPrivacyDashboard() {
  const data = await api("/api/lgpd");
  const requests = data.solicitacoes.map(item => `<article class="card privacy-request ${item.status === "Aberta" ? "is-open" : ""}">
    <div><strong>${escapeHtml(item.cliente)} · ${escapeHtml(item.tipo)}</strong><small>${dateBr(item.data_solicitacao)} · prazo ${dateBr(item.data_limite)} · ${escapeHtml(item.status)}</small></div>
    <button class="secondary open-client-privacy" data-id="${item.id_cliente}">Abrir cliente</button>
  </article>`).join("") || `<div class="card muted">Nenhuma solicitação registrada.</div>`;
  const audit = data.auditoria.map(item => `<div class="privacy-audit-row">
    <div><strong>${escapeHtml(item.acao)} · ${escapeHtml(item.recurso)}</strong><small>${escapeHtml(item.usuario)} · ${dateBr(item.data_evento)} · resposta ${item.resultado}</small></div>
  </div>`).join("") || `<div class="card muted">Nenhuma operação registrada.</div>`;
  $("#privacyPanel").innerHTML = `
    <div class="stats privacy-stats"><div class="card stat"><span>Abertas</span><strong>${data.resumo.abertas}</strong></div><div class="card stat"><span>Em análise</span><strong>${data.resumo.em_analise}</strong></div><div class="card stat stat-late"><span>Prazo vencido</span><strong>${data.resumo.vencidas}</strong></div></div>
    <div class="card privacy-contact"><strong>Canal dos titulares</strong><p>${escapeHtml(data.estudio.email_privacidade || "Não configurado")}</p><small>Aviso ${escapeHtml(data.estudio.versao_aviso_privacidade)} · retenção ${data.estudio.prazo_retencao_anos} anos</small></div>
    <h2>Solicitações dos titulares</h2><div class="privacy-request-list">${requests}</div>
    <h2>Registro de operações</h2><div class="privacy-audit">${audit}</div>`;
}

function openStudioEditor(studioId = "") {
  const item = studiosData.find(entry => String(entry.id) === String(studioId)) || {};
  $("#actionContent").innerHTML = `<header><h2>${item.id ? "Editar" : "Novo"} estúdio</h2><button class="close" type="button">×</button></header>
    <form id="studioAdminForm">
      <label>Nome do estúdio<input name="nome_estudio" value="${escapeHtml(item.nome_estudio)}" required></label>
      <label>Nome do responsável<input name="nome_usuario" value="${escapeHtml(item.nome_responsavel || item.nome_usuario)}" required></label>
      <label>Usuário de acesso<input name="login" value="${escapeHtml(item.login)}" autocomplete="off" autocapitalize="none" required></label>
      <label>${item.id ? "Nova senha (opcional)" : "Senha inicial"}<input name="senha" type="password" minlength="8" autocomplete="new-password" ${item.id ? "" : "required"}></label>
      <label>CNPJ<input name="cnpj" data-cnpj inputmode="numeric" maxlength="18" value="${escapeHtml(item.cnpj)}"></label>
      <label>Endereço<textarea name="endereco">${escapeHtml(item.endereco)}</textarea></label>
      <label>Instagram<input name="instagram" value="${escapeHtml(item.instagram)}"></label>
      <label>E-mail de privacidade<input name="email_privacidade" type="email" value="${escapeHtml(item.email_privacidade)}" required></label>
      ${item.id ? `<label class="check-label"><input name="ativo" type="checkbox" value="1" ${item.ativo ? "checked" : ""}> Estúdio ativo</label>` : ""}
      <button class="primary">${item.id ? "Salvar alterações" : "Criar estúdio e usuário"}</button>
      <p class="form-feedback" role="alert" aria-live="polite"></p>
    </form>`;
  applyInputMasks($("#actionContent"));
  $("#actionDialog").showModal();
  $("#studioAdminForm").onsubmit = async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type='submit'],button:not([type])");
    const feedback = $(".form-feedback", form);
    feedback.textContent = "";
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = item.id ? "Salvando..." : "Criando...";
    try {
      const values = Object.fromEntries(new FormData(form));
      if (item.id) values.ativo = form.elements.ativo.checked;
      await api(item.id ? `/api/admin/estudios/${item.id}` : "/api/admin/estudios", {
        method: item.id ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values)
      });
      $("#actionDialog").close();
      toast(item.id ? "Estúdio atualizado com sucesso." : "Estúdio e usuário criados com sucesso.");
      await loadStudios();
    } catch (error) {
      feedback.textContent = error.message;
      feedback.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
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
  if (term.length < 1) {
    $("#clientList").innerHTML = `<p class="muted client-search-hint">Digite para localizar um cliente.</p>`;
    return;
  }
  const clients = await api(`/api/clientes?busca=${encodeURIComponent(term)}`);
  if (requestId !== clientSearchRequest) return;
  $("#clientList").innerHTML = clients.map(c => `<button class="client-item select-client" data-id="${c.id}" data-name="${escapeHtml(c.nome)}"><strong>${escapeHtml(c.nome)}</strong><br><span class="muted">${escapeHtml(c.telefone)}${c.instagram ? ` · ${escapeHtml(c.instagram)}` : ""}${c.cpf ? ` · ${escapeHtml(c.cpf)}` : ""}</span></button>`).join("") || `<p class="muted client-search-hint">Nenhum cliente encontrado.</p>`;
}

async function loadClientLegacy(id) {
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
    return `<div class="card installment-card"><div><strong>OS #${item.id_os} · Parcela ${item.numero_parcela}/${item.total_parcelas}</strong>
      <div class="muted">${dateBr(item.data_vencimento)} · ${money(item.valor_parcela)}</div></div>
      <div class="installment-state"><span class="badge ${late ? "badge-late" : ""}">${item.status === "Pago" ? "Pago" : late ? "Atrasado" : "Pendente"}</span>
      ${item.status !== "Pago" ? `<button type="button" class="secondary pay-installment" data-id="${item.id}" data-appointment="${item.id_agendamento}" data-number="${item.numero_parcela}/${item.total_parcelas}" data-value="${item.valor_parcela}">Receber parcela</button>` : ""}</div></div>`;
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

async function loadClient(id) {
  selectedClientId = id;
  const [crm, privacy] = await Promise.all([
    api(`/api/clientes/${id}/crm`), api(`/api/clientes/${id}/lgpd`)
  ]);
  const client = crm.cliente;
  const metrics = crm.indicadores;
  const alerts = crm.alertas.map(message =>
    `<div class="crm-alert">${escapeHtml(message)}</div>`).join("");
  const tattooHistory = crm.ordens.map(order => {
    const status = order.faltou ? "Falta" : order.status_agendamento === "Concluido"
      ? "Concluída" : order.status_agendamento === "Cancelado"
        ? "Cancelada" : order.status_agendamento || order.status_os;
    return `<article class="card crm-tattoo-card">
      ${order.tem_foto ? `<img src="/api/crm/tatuagem/${order.id_os}/foto" alt="Foto da tatuagem" loading="lazy">` : `<div class="crm-photo-placeholder">Sem foto</div>`}
      <div class="crm-tattoo-content"><div class="card-head"><div><strong>OS #${order.id_os}</strong><small>${dateBr(order.data_hora || order.data_criacao)} · ${escapeHtml(status)}</small></div>
      ${order.id_agendamento ? `<button class="secondary open-order" data-id="${order.id_agendamento}">Abrir OS</button>` : ""}</div>
      <p>${escapeHtml(order.descricao || "Sem descrição.")}</p>
      <div class="crm-detail-grid"><span>Região<strong>${escapeHtml(order.regiao_corpo || "Não informada")}</strong></span><span>Valor<strong>${money(order.valor_final)}</strong></span><span>Duração<strong>${order.tempo_sessao_minutos ? `${order.tempo_sessao_minutos} min` : "Não informada"}</strong></span></div>
      <button class="secondary edit-crm-order" data-id="${order.id_os}">Editar informações</button></div>
    </article>`;
  }).join("") || `<div class="card muted">Nenhuma tatuagem registrada.</div>`;
  const paymentHistory = crm.pagamentos.map(item => `<div class="financial-movement">
    <div><strong>${escapeHtml(item.tipo)}</strong><span class="muted">${dateBr(item.data_evento)} · OS #${item.id_os || "-"}${item.forma_pagamento ? ` · ${escapeHtml(item.forma_pagamento)}` : ""}</span></div>
    <strong>${item.tipo === "Estorno" ? "- " : ""}${money(item.valor)}</strong></div>`).join("") || `<div class="card muted">Nenhum pagamento registrado.</div>`;
  const openInstallments = crm.crediarios.map(item => {
    const late = item.status === "Atrasado" || item.data_vencimento < todaySp();
    return `<div class="card installment-card"><div><strong>OS #${item.id_os} · Parcela ${item.numero_parcela}/${item.total_parcelas}</strong>
      <div class="muted">${dateBr(item.data_vencimento)} · ${money(item.valor_parcela)}</div></div>
      <div class="installment-state"><span class="badge ${late ? "badge-late" : ""}">${late ? "Atrasada" : "Pendente"}</span>
      <button type="button" class="secondary pay-installment" data-id="${item.id}" data-appointment="${item.id_agendamento || ""}" data-number="${item.numero_parcela}/${item.total_parcelas}" data-value="${item.valor_parcela}">Receber parcela</button></div></div>`;
  }).join("") || `<div class="card muted">Nenhuma parcela em aberto.</div>`;
  const appointments = crm.agendamentos.map(item => {
    const past = item.data_hora.slice(0, 10) < todaySp();
    const status = item.faltou ? "Falta" : item.status;
    return `<article class="card crm-appointment ${item.faltou || item.status === "Cancelado" ? "is-negative" : ""}">
      <div><strong>${dateBr(item.data_hora)} às ${item.data_hora.slice(11,16)}</strong><small>${past ? "Passado" : "Próximo"} · ${escapeHtml(status)}</small></div>
      <button class="secondary open-order" data-id="${item.id}">Abrir</button></article>`;
  }).join("") || `<div class="card muted">Nenhum agendamento.</div>`;
  const timeline = crm.timeline.map(item => `<div class="crm-timeline-item">
    <span></span><div><strong>${escapeHtml(item.tipo)}</strong><small>${dateBr(item.data_evento)} · ${escapeHtml(item.descricao)}</small></div>
  </div>`).join("");
  const privacyConfig = privacy.configuracao;
  const privacyRequests = privacy.solicitacoes.map(item => `<form class="card lgpd-request-form" data-id="${item.id}">
    <div class="card-head"><div><strong>${escapeHtml(item.tipo)}</strong><small>${dateBr(item.data_solicitacao)} · prazo ${dateBr(item.data_limite)}</small></div><span class="badge ${item.status === "Aberta" ? "badge-late" : ""}">${escapeHtml(item.status)}</span></div>
    <p>${escapeHtml(item.descricao || "Sem descrição.")}</p>
    <label>Status<select name="status">${["Aberta","Em analise","Concluida","Recusada"].map(status => `<option ${status === item.status ? "selected" : ""}>${status}</option>`).join("")}</select></label>
    <label>Resposta<textarea name="resposta">${escapeHtml(item.resposta)}</textarea></label>
    <button class="secondary">Atualizar solicitação</button>
  </form>`).join("") || `<div class="card muted">Nenhuma solicitação LGPD registrada.</div>`;
  $("#clientDetail").classList.remove("empty");
  $("#clientDetail").innerHTML = `${alerts}<div class="crm-header">
    <label class="crm-client-photo">${client.tem_foto ? `<img src="/api/crm/cliente/${id}/foto?v=${Date.now()}" alt="Foto de ${escapeHtml(client.nome)}">` : `<span>👤</span>`}<input id="crmClientPhoto" type="file" accept="image/*" hidden></label>
    <div><h2>${escapeHtml(client.nome)}</h2><p>${escapeHtml(client.telefone)}${client.instagram ? ` · ${escapeHtml(client.instagram)}` : ""}</p><span class="badge">${escapeHtml(client.status)}</span></div>
  </div>
  <div class="tabs crm-tabs"><button class="tab active" data-tab="crm-summary">Resumo</button><button class="tab" data-tab="crm-tattoos">Tatuagens</button><button class="tab" data-tab="crm-finance">Financeiro</button><button class="tab" data-tab="crm-appointments">Agendamentos</button><button class="tab" data-tab="crm-notes">Observações</button><button class="tab" data-tab="crm-timeline">Timeline</button><button class="tab" data-tab="crm-privacy">Privacidade</button></div>
  <div class="tab-pane active" id="crm-summary">
    <div class="stats crm-stats"><div class="card stat"><span>Total gasto</span><strong>${money(metrics.total_gasto)}</strong></div><div class="card stat"><span>Tatuagens</span><strong>${metrics.tatuagens}</strong></div><div class="card stat"><span>Última visita</span><strong>${dateBr(metrics.ultima_visita) || "—"}</strong></div><div class="card stat"><span>Próximo agendamento</span><strong>${dateBr(metrics.proximo_agendamento) || "—"}</strong></div><div class="card stat"><span>Ticket médio</span><strong>${money(metrics.ticket_medio)}</strong></div><div class="card stat stat-late"><span>Pendente</span><strong>${money(metrics.pendente)}</strong></div></div>
    <form id="crmClientForm">
      <div class="fields"><label>Nome<input name="nome" value="${escapeHtml(client.nome)}" required></label><label>Telefone<input name="telefone" value="${escapeHtml(client.telefone)}"></label></div>
      <div class="fields"><label>Instagram<input name="instagram" value="${escapeHtml(client.instagram)}"></label><label>Cidade<input name="cidade" value="${escapeHtml(client.cidade)}"></label></div>
      <div class="fields"><label>CPF<input name="cpf" data-cpf value="${escapeHtml(client.cpf)}"></label><label>RG<input name="rg" value="${escapeHtml(client.rg)}"></label></div>
      <div class="fields"><label>Nascimento<input name="data_nascimento" type="date" value="${client.data_nascimento || ""}"></label><label>Status<select name="status"><option ${client.status === "Ativo" ? "selected" : ""}>Ativo</option><option ${client.status === "Inativo" ? "selected" : ""}>Inativo</option></select></label></div>
      <div class="crm-profile-facts"><span>Idade<strong>${client.idade ?? "—"}</strong></span><span>Cliente desde<strong>${dateBr(client.data_cadastro)}</strong></span><span>Dias sem visita<strong>${metrics.dias_sem_visita ?? "—"}</strong></span><span>Cancelamentos / faltas<strong>${metrics.cancelamentos} / ${metrics.faltas}</strong></span></div>
      <button class="primary">Salvar cadastro</button>
    </form>
  </div>
  <div class="tab-pane" id="crm-tattoos">${tattooHistory}</div>
  <div class="tab-pane" id="crm-finance"><div class="stats crm-stats"><div class="card stat"><span>Total gasto</span><strong>${money(metrics.total_gasto)}</strong></div><div class="card stat"><span>Ticket médio</span><strong>${money(metrics.ticket_medio)}</strong></div><div class="card stat stat-late"><span>Pendente</span><strong>${money(metrics.pendente)}</strong></div><div class="card stat"><span>Último pagamento</span><strong>${dateBr(metrics.ultimo_pagamento) || "—"}</strong></div></div><h2>Parcelas em aberto</h2><div class="installment-list">${openInstallments}</div><h2>Pagamentos</h2><div class="movement-list">${paymentHistory}</div></div>
  <div class="tab-pane" id="crm-appointments">${appointments}</div>
  <div class="tab-pane" id="crm-notes"><form id="crmNotesForm"><label>Anotações do cliente<textarea name="observacoes" placeholder="Preferências, estilo favorito, cuidados especiais...">${escapeHtml(client.observacoes)}</textarea></label><button class="primary">Salvar observações</button></form></div>
  <div class="tab-pane" id="crm-timeline"><div class="crm-timeline">${timeline}</div></div>
  <div class="tab-pane" id="crm-privacy">
    <div class="card lgpd-notice"><strong>Canal de privacidade</strong><p>${escapeHtml(privacy.estudio.email_privacidade || "Não configurado")}</p><small>Retenção configurada: ${privacy.estudio.prazo_retencao_anos} anos · aviso ${escapeHtml(privacy.estudio.versao_aviso_privacidade)}</small></div>
    <form id="crmPrivacyForm">
      <label>Base legal dos dados cadastrais<select name="base_cadastro">${["Execucao de contrato","Consentimento","Obrigacao legal","Legitimo interesse"].map(value => `<option ${value === privacyConfig.base_cadastro ? "selected" : ""}>${value}</option>`).join("")}</select></label>
      <label class="check-label"><input name="aceita_marketing" type="checkbox" value="1" ${privacyConfig.aceita_marketing ? "checked" : ""}> Cliente autorizou comunicações de marketing</label>
      <input name="versao_aviso" type="hidden" value="${escapeHtml(privacy.estudio.versao_aviso_privacidade)}">
      <button class="primary">Salvar privacidade</button>
    </form>
    <button class="secondary export-client-data" type="button" data-id="${id}" data-name="${escapeHtml(client.nome)}">Exportar dados do cliente</button>
    <h2>Nova solicitação do titular</h2>
    <form id="lgpdRequestForm"><label>Direito solicitado<select name="tipo">${["Acesso","Correcao","Anonimizacao","Bloqueio","Eliminacao","Portabilidade","Revogacao"].map(value => `<option>${value}</option>`).join("")}</select></label><label>Descrição<textarea name="descricao" required></textarea></label><button class="primary">Registrar solicitação</button></form>
    <h2>Solicitações registradas</h2><div class="lgpd-request-list">${privacyRequests}</div>
  </div>`;
  applyInputMasks($("#clientDetail"));
  const updateClient = async changes => {
    await api(`/api/clientes/${id}`, {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nome: client.nome, telefone: client.telefone, cidade: client.cidade,
        instagram: client.instagram, cpf: client.cpf, rg: client.rg,
        data_nascimento: client.data_nascimento, observacoes: client.observacoes,
        status: client.status, ...changes
      })
    });
    toast("Cadastro atualizado.");
    await loadClient(id);
  };
  $("#crmClientForm").onsubmit = event => {
    event.preventDefault();
    updateClient(Object.fromEntries(new FormData(event.currentTarget)))
      .catch(error => toast(error.message));
  };
  $("#crmNotesForm").onsubmit = event => {
    event.preventDefault();
    updateClient({ observacoes: event.currentTarget.elements.observacoes.value })
      .catch(error => toast(error.message));
  };
  $("#crmClientPhoto").onchange = async event => {
    try {
      const image = await loadProfilePhoto(event.target.files[0]);
      const size = Math.min(image.width, image.height);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 480;
      canvas.getContext("2d").drawImage(image,(image.width-size)/2,(image.height-size)/2,size,size,0,0,480,480);
      await post(`/api/crm/cliente/${id}/foto`, { imagem: canvas.toDataURL("image/jpeg", .82) });
      await loadClient(id);
    } catch (error) { toast(error.message); }
  };
  $("#crmPrivacyForm").onsubmit = async event => {
    event.preventDefault();
    const form = event.currentTarget;
    await api(`/api/clientes/${id}/lgpd`, {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...Object.fromEntries(new FormData(form)),
        aceita_marketing: form.elements.aceita_marketing.checked
      })
    });
    toast("Configurações de privacidade salvas.");
    await loadClient(id);
    $("[data-tab=crm-privacy]", $("#clientDetail"))?.click();
  };
  $("#lgpdRequestForm").onsubmit = async event => {
    event.preventDefault();
    await send(`/api/clientes/${id}/lgpd/solicitacoes`, "POST", event.currentTarget);
    toast("Solicitação LGPD registrada.");
    await loadClient(id);
    $("[data-tab=crm-privacy]", $("#clientDetail"))?.click();
  };
  $$(".lgpd-request-form", $("#clientDetail")).forEach(form => {
    form.onsubmit = async event => {
      event.preventDefault();
      await send(`/api/clientes/${id}/lgpd/solicitacoes/${form.dataset.id}`,
        "PUT", form);
      toast("Solicitação atualizada.");
      await loadClient(id);
      $("[data-tab=crm-privacy]", $("#clientDetail"))?.click();
    };
  });
}

async function openCrmOrderEdit(orderId) {
  const crm = await api(`/api/clientes/${selectedClientId}/crm`);
  const order = crm.ordens.find(item => String(item.id_os) === String(orderId));
  if (!order) return toast("Ordem de serviço não encontrada.");
  $("#actionContent").innerHTML = `<header><h2>Informações da tatuagem</h2><button class="close" type="button">×</button></header>
    <form id="crmOrderForm">
      <label class="marketing-art-field"><span id="crmTattooPreview" class="marketing-art-preview">${order.tem_foto ? `<img src="/api/crm/tatuagem/${order.id_os}/foto?v=${Date.now()}" alt="Foto da tatuagem">` : "Adicionar foto da tatuagem"}</span><span>${order.tem_foto ? "Substituir foto" : "Escolher foto"}</span><input name="foto" type="file" accept="image/*" hidden></label>
      <label>Região do corpo<input name="regiao_corpo" value="${escapeHtml(order.regiao_corpo)}"></label>
      <label>Tempo de sessão em minutos<input name="tempo_sessao_minutos" type="number" min="0" step="1" value="${order.tempo_sessao_minutos || ""}"></label>
      <button class="primary">Salvar informações</button>
    </form>`;
  $("#actionDialog").showModal();
  let photo = "";
  $("#crmOrderForm").elements.foto.onchange = async event => {
    try {
      const image = await loadProfilePhoto(event.target.files[0]);
      const scale = Math.min(1, 480 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d").drawImage(image,0,0,canvas.width,canvas.height);
      photo = canvas.toDataURL("image/jpeg",.70);
      $("#crmTattooPreview").innerHTML = `<img src="${photo}" alt="Prévia">`;
    } catch (error) { toast(error.message); }
  };
  $("#crmOrderForm").onsubmit = async event => {
    event.preventDefault();
    const form = event.currentTarget;
    form.elements.foto.disabled = true;
    await send(`/api/crm/os/${order.id_os}`, "PUT", form);
    if (photo) await post(`/api/crm/tatuagem/${order.id_os}/foto`, { imagem: photo });
    $("#actionDialog").close();
    await loadClient(selectedClientId);
    $("[data-tab=crm-tattoos]", $("#clientDetail"))?.click();
    toast("Informações da tatuagem atualizadas.");
  };
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

function loadProfilePhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type.startsWith("image/")) return reject(new Error("Selecione uma imagem válida."));
    if (file.size > 5 * 1024 * 1024) return reject(new Error("A imagem deve ter no máximo 5 MB."));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Não foi possível processar a imagem."));
      image.onload = () => resolve(image);
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function renderProfileCrop() {
  if (!profileCrop) return;
  const { image, viewport, zoom } = profileCrop;
  const scale = Math.max(viewport / image.width, viewport / image.height) * zoom;
  const width = image.width * scale;
  const height = image.height * scale;
  profileCrop.offsetX = Math.max(-(width - viewport) / 2,
    Math.min((width - viewport) / 2, profileCrop.offsetX));
  profileCrop.offsetY = Math.max(-(height - viewport) / 2,
    Math.min((height - viewport) / 2, profileCrop.offsetY));
  const cropImage = $("#profileCropImage");
  cropImage.style.width = `${width}px`;
  cropImage.style.height = `${height}px`;
  cropImage.style.transform = `translate(${(viewport - width) / 2 + profileCrop.offsetX}px, ${(viewport - height) / 2 + profileCrop.offsetY}px)`;
}

function confirmProfileCrop() {
  if (!profileCrop) return;
  const { image, viewport, zoom, offsetX, offsetY } = profileCrop;
  const scale = Math.max(viewport / image.width, viewport / image.height) * zoom;
  const width = image.width * scale;
  const height = image.height * scale;
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 320;
  const ratio = 320 / viewport;
  canvas.getContext("2d").drawImage(image,
    ((viewport - width) / 2 + offsetX) * ratio,
    ((viewport - height) / 2 + offsetY) * ratio,
    width * ratio, height * ratio);
  profilePhotoData = canvas.toDataURL("image/jpeg", .82);
  $(".profile-photo-preview").innerHTML = `<img src="${profilePhotoData}" alt="Foto de perfil">`;
  $("#profileCropEditor").hidden = true;
  profileCrop = null;
}

function displayAccountPhoto(photo) {
  $("#accountButton").innerHTML = photo
    ? `<img src="${photo}" alt="Foto de perfil">`
    : `<span aria-hidden="true">👤</span>`;
}

async function openProfile() {
  const profile = await api("/api/perfil");
  profilePhotoData = profile.foto_perfil || "";
  $("#actionContent").innerHTML = `<header><h2>Perfil e estúdio</h2><button class="close" type="button">×</button></header>
    <form id="profileForm">
      <label class="profile-photo-field">
        <span class="profile-photo-preview">${profilePhotoData ? `<img src="${profilePhotoData}" alt="Foto de perfil">` : "👤"}</span>
        <span>Escolher foto</span>
        <input name="foto" type="file" accept="image/*" hidden>
      </label>
      <div id="profileCropEditor" class="profile-crop-editor" hidden>
        <p>Arraste a foto para enquadrar</p>
        <div id="profileCropViewport" class="profile-crop-viewport"><img id="profileCropImage" alt=""></div>
        <label>Zoom<input id="profileCropZoom" type="range" min="1" max="3" step=".01" value="1"></label>
        <div class="profile-crop-actions"><button class="secondary" id="cancelProfileCrop" type="button">Cancelar</button><button class="primary" id="confirmProfileCrop" type="button">Usar foto</button></div>
      </div>
      <label>Seu nome<input name="nome" value="${escapeHtml(profile.nome)}" required></label>
      <label>Nome do estúdio<input name="nome_estudio" value="${escapeHtml(profile.nome_estudio)}" required></label>
      <label>Endereço<input name="endereco" value="${escapeHtml(profile.endereco)}"></label>
      <label>CNPJ<input name="cnpj" data-cnpj inputmode="numeric" maxlength="18" value="${escapeHtml(profile.cnpj)}"></label>
      <label>Instagram<input name="instagram" placeholder="@usuario" value="${escapeHtml(profile.instagram)}"></label>
      <label>E-mail de privacidade<input name="email_privacidade" type="email" value="${escapeHtml(profile.email_privacidade)}" required><small class="muted">Canal para solicitações dos titulares de dados.</small></label>
      <button class="primary">Salvar informações</button>
    </form>
    <div class="profile-password">
      <h2>Atualizar senha</h2>
      <form id="passwordForm">
        <label>Nova senha<input name="nova_senha" type="password" minlength="8" autocomplete="new-password" required></label>
        <label>Repita a nova senha<input name="confirmar_senha" type="password" minlength="8" autocomplete="new-password" required></label>
        <button class="primary">Atualizar senha</button>
      </form>
    </div>`;
  applyInputMasks($("#actionContent"));
  $("#actionDialog").showModal();
  $("#profileForm").elements.foto.onchange = async event => {
    try {
      const image = await loadProfilePhoto(event.target.files[0]);
      profileCrop = { image, viewport: 240, zoom: 1, offsetX: 0, offsetY: 0 };
      $("#profileCropImage").src = image.src;
      $("#profileCropZoom").value = 1;
      $("#profileCropEditor").hidden = false;
      renderProfileCrop();
    } catch (error) {
      toast(error.message);
    }
  };
  $("#profileCropZoom").oninput = event => {
    profileCrop.zoom = Number(event.target.value);
    renderProfileCrop();
  };
  const cropViewport = $("#profileCropViewport");
  cropViewport.onpointerdown = event => {
    if (!profileCrop) return;
    cropViewport.setPointerCapture(event.pointerId);
    profileCrop.dragX = event.clientX;
    profileCrop.dragY = event.clientY;
  };
  cropViewport.onpointermove = event => {
    if (!profileCrop || !cropViewport.hasPointerCapture(event.pointerId)) return;
    profileCrop.offsetX += event.clientX - profileCrop.dragX;
    profileCrop.offsetY += event.clientY - profileCrop.dragY;
    profileCrop.dragX = event.clientX;
    profileCrop.dragY = event.clientY;
    renderProfileCrop();
  };
  $("#confirmProfileCrop").onclick = confirmProfileCrop;
  $("#cancelProfileCrop").onclick = () => {
    $("#profileCropEditor").hidden = true;
    profileCrop = null;
  };
  $("#profileForm").onsubmit = async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    delete values.foto;
    await api("/api/perfil", {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...values, foto_perfil: profilePhotoData })
    });
    displayAccountPhoto(profilePhotoData);
    $("#actionDialog").close();
    toast("Perfil atualizado.");
  };
  $("#passwordForm").onsubmit = async event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.elements.nova_senha.value !== form.elements.confirmar_senha.value) {
      return toast("As senhas informadas não são iguais.");
    }
    try {
      await send("/api/perfil/senha", "PUT", form);
      form.reset();
      toast("Senha atualizada.");
    } catch (error) {
      toast(error.message);
    }
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
    if (action === "credit") calendar?.refetchEvents();
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
    calendar?.refetchEvents();
    if (orderWasOpen) await refreshOrder();
    else {
      if (selectedClientId) {
        await loadClient(selectedClientId);
        $("[data-tab=crm-finance]", $("#clientDetail"))?.click();
      }
      await loadFinance();
    }
  };
}

async function openOrder(appointmentId, initialTab = "os-data") {
  const data = await api(`/api/os?id=${appointmentId}`);
  activeOrderData = data;
  const [date, time] = data.data_hora.split(" ");
  const today = todaySp();
  const appointmentStatuses = [
    ["Agendado", "Agendado"],
    ["Confirmado", "Confirmado"],
    ["Concluido", "Finalizado"],
    ["Falta", "Falta"],
    ["Cancelado", "Cancelado"],
    ["Remarcado", "Remarcado"]
  ];
  const currentAppointmentStatus = data.faltou ? "Falta" : data.status_agendamento;
  const installmentHtml = data.parcelas.length ? `<div class="installment-list">${data.parcelas.map(item => {
    const late = item.status !== "Pago" && item.data_vencimento < today;
    const status = item.status === "Pago" ? "Pago" : late ? "Atrasado" : "Pendente";
    return `<div class="card installment-card">
      <div><strong>Parcela ${item.numero_parcela}/${item.total_parcelas}</strong><div class="muted">${dateBr(item.data_vencimento)} · ${money(item.valor_parcela)}</div></div>
      <div class="installment-state"><span class="badge ${late ? "badge-late" : ""}">${status}</span>
      ${item.status !== "Pago" ? `<button type="button" class="secondary pay-installment" data-id="${item.id}" data-appointment="${data.id_agendamento}" data-number="${item.numero_parcela}/${item.total_parcelas}" data-value="${item.valor_parcela}">Receber parcela</button>` : ""}</div>
    </div>`;
  }).join("")}</div>` : "";
  const financeEvents = [
    ...data.movimentos.filter(item => !item.id_crediario).map(item => ({
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
      title: `Crediário · Parcela ${item.numero_parcela}/${item.total_parcelas}`,
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
    <div class="tab-pane active" id="os-data">
      <div class="crm-header order-client-header">
        <div class="crm-client-photo">${data.tem_foto_cliente ? `<img src="/api/crm/cliente/${data.id_cliente}/foto" alt="Foto de ${escapeHtml(data.nome)}">` : `<span>👤</span>`}</div>
        <div><h2>${escapeHtml(data.nome)}</h2><span class="badge">${escapeHtml(data.status_cliente || "Ativo")}</span></div>
      </div>
      <div class="crm-profile-facts order-client-facts">
        <span>Telefone<strong>${escapeHtml(data.telefone || "Não informado")}</strong></span>
        <span>Cidade<strong>${escapeHtml(data.cidade || "Não informada")}</strong></span>
        <span>Instagram<strong>${escapeHtml(data.instagram || "Não informado")}</strong></span>
        <span>Nascimento<strong>${data.data_nascimento ? dateBr(data.data_nascimento) : "Não informado"}</strong></span>
        <span>CPF<strong>${escapeHtml(data.cpf || "Não informado")}</strong></span>
        <span>RG<strong>${escapeHtml(data.rg || "Não informado")}</strong></span>
        <span>Cadastro<strong>${dateBr(data.data_cadastro)}</strong></span>
        <span>Status<strong>${escapeHtml(data.status_cliente || "Ativo")}</strong></span>
      </div>
      <div class="card order-client-notes"><span class="muted">Observações</span><p>${escapeHtml(data.observacoes || "Nenhuma observação cadastrada.")}</p></div>
    </div>
    <div class="tab-pane" id="os-service"><div class="card service-summary"><span class="muted">Descrição atual</span><p>${escapeHtml(data.descricao || "Nenhuma descrição registrada.")}</p></div>
      <div class="finance-actions service-actions"><button class="primary" type="button" data-service-action="description">Editar descrição</button><button class="secondary" type="button" data-service-action="ink">Mistura de tintas</button><button class="secondary" type="button" data-service-action="material">Adicionar material</button></div>
      <h2>Receitas de tintas</h2>${inkRecipeHtml}
      <h2>Outros materiais utilizados</h2>${materialHtml}
    </div>
    <div class="tab-pane" id="os-schedule"><form id="scheduleForm"><div class="fields"><label>Data<input name="data" type="date" value="${date}"></label><label>Hora<input name="hora" type="time" value="${time.slice(0,5)}"></label></div><label>Status<select name="status">${appointmentStatuses.map(([value, label]) => `<option value="${value}" ${value === currentAppointmentStatus ? "selected" : ""}>${label}</option>`).join("")}</select></label><button class="primary">Salvar</button></form></div>
    <div class="tab-pane" id="os-finance"><div class="stats"><div class="card stat">Valor final<strong>${money(data.valor_final)}</strong></div><div class="card stat">Total pago<strong>${money(data.total_pago)}</strong></div><div class="card stat">Saldo aberto<strong>${money(data.saldo_aberto)}</strong></div></div>
      <div class="finance-actions"><button class="primary" type="button" data-finance-action="payment">Registrar pagamento</button>
      ${!data.parcelas.length && data.saldo_aberto > 0 ? `<button class="secondary" type="button" data-finance-action="credit">Criar crediário</button>` : ""}
      <button class="secondary" type="button" data-finance-action="adjustment">Acréscimo ou desconto</button></div>
      ${installmentHtml ? `<h2>Parcelas</h2>${installmentHtml}` : ""}
      <h2>Histórico financeiro</h2><div class="finance-history">${financeHistory}</div></div>`;
  $("#orderDialog").showModal();
  $(`[data-tab=${initialTab}]`, $("#orderDialog"))?.click();
  $("#scheduleForm").onsubmit = async e => {
    e.preventDefault();
    const result = await send(`/api/agendamentos/${data.id_agendamento}`, "PUT", e.currentTarget);
    toast(result.estorno_sinal > 0
      ? `Agendamento cancelado. Sinal de ${money(result.estorno_sinal)} estornado.`
      : "Agendamento atualizado.");
    $("#orderDialog").close();
    loadAgenda();
  };
}

document.addEventListener("input", event => {
  if (event.target.matches("[data-money]")) maskMoney(event.target);
  if (event.target.matches("[data-cpf]")) maskCpf(event.target);
  if (event.target.matches("[data-cnpj]")) maskCnpj(event.target);
});

document.addEventListener("click", event => {
  const nav = event.target.closest(".nav-link");
  if (nav?.dataset.page) { try { sessionStorage.setItem("activePage", nav.dataset.page); } catch {} $$(".nav-link,.page").forEach(x => x.classList.remove("active")); nav.classList.add("active"); $(`#${nav.dataset.page}`).classList.add("active"); $("#sidebar").classList.remove("open"); if (nav.dataset.page === "agenda") showAgenda().catch(error => toast(error.message)); if (nav.dataset.page === "clientes") { $("#clientSearch").value = ""; loadClients(); } if (nav.dataset.page === "financeiro") { loadFinance(); loadFinancialManagement(); } if (nav.dataset.page === "estoque") loadStock(); if (nav.dataset.page === "marketing") loadMarketing().catch(error => toast(error.message)); if (nav.dataset.page === "privacidade") loadPrivacyDashboard().catch(error => toast(error.message)); if (nav.dataset.page === "estudios") loadStudios().catch(error => toast(error.message)); }
  if (event.target.closest("[data-open=appointment]")) openAppointment();
  if (event.target.closest("[data-open=client]")) openNewClient();
  if (event.target.closest(".close")) event.target.closest("dialog").close();
  const client = event.target.closest(".select-client");
  if (client) {
    $("#clientSearch").value = client.dataset.name;
    $("#clientList").innerHTML = "";
    loadClient(client.dataset.id);
  }
  const clientExport = event.target.closest(".export-client-data");
  if (clientExport) {
    exportClientData(clientExport.dataset.id, clientExport.dataset.name)
      .catch(error => toast(error.message));
  }
  const clientPrivacy = event.target.closest(".open-client-privacy");
  if (clientPrivacy) {
    $(`.nav-link[data-page="clientes"]`)?.click();
    loadClient(clientPrivacy.dataset.id).then(() =>
      $("[data-tab=crm-privacy]", $("#clientDetail"))?.click()
    ).catch(error => toast(error.message));
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
  const crmOrder = event.target.closest(".edit-crm-order");
  if (crmOrder) openCrmOrderEdit(crmOrder.dataset.id);
  const stockAction = event.target.closest("[data-stock-action]");
  if (stockAction) openStockAction(stockAction.dataset.stockAction, stockAction.dataset.id);
  const marketingAction = event.target.closest("[data-marketing-action]");
  if (marketingAction) openMarketingPlan(marketingAction.dataset.id);
  const studioAction = event.target.closest("[data-studio-action]");
  if (studioAction) openStudioEditor(studioAction.dataset.id);
  const opportunityPlan = event.target.closest(".plan-opportunity");
  if (opportunityPlan) {
    post("/api/marketing/oportunidades/planejar", { key: opportunityPlan.dataset.key })
      .then(async result => {
        await loadMarketing();
        openMarketingPlan(result.id);
      }).catch(error => toast(error.message));
  }
  const opportunityOpen = event.target.closest(".open-opportunity-plan");
  if (opportunityOpen) openMarketingPlan(opportunityOpen.dataset.id);
  const opportunityRestart = event.target.closest(".restart-opportunity-plan");
  if (opportunityRestart && confirm("Excluir esta campanha e reiniciar o planejamento?")) {
    api(`/api/marketing/${opportunityRestart.dataset.id}`, { method: "DELETE" })
      .then(() => {
        toast("Planejamento removido. A oportunidade está livre para recomeçar.");
        loadMarketing();
        loadNotifications();
        calendar?.refetchEvents();
      }).catch(error => toast(error.message));
  }
  const marketingDelete = event.target.closest(".delete-marketing");
  if (marketingDelete && confirm("Excluir este planejamento?")) {
    api(`/api/marketing/${marketingDelete.dataset.id}`, { method: "DELETE" })
      .then(() => { toast("Planejamento excluído."); loadMarketing(); loadNotifications(); calendar?.refetchEvents(); })
      .catch(error => toast(error.message));
  }
  const marketingCopy = event.target.closest(".copy-marketing-caption");
  if (marketingCopy) {
    const item = marketingData.find(entry => String(entry.id) === marketingCopy.dataset.id);
    navigator.clipboard.writeText(item?.texto_postagem || "")
      .then(() => toast("Legenda copiada."))
      .catch(() => toast("Não foi possível copiar a legenda."));
  }
  const notification = event.target.closest(".notification-item");
  if (notification) {
    $("#actionDialog").close();
    if (notification.dataset.notificationPlan) {
      openMarketingRecord(notification.dataset.notificationPlan);
    } else {
      $(`.nav-link[data-page="marketing"]`)?.click();
    }
  }
  const managementAction = event.target.closest("[data-management-action]");
  if (managementAction) openManagementAction(managementAction.dataset.managementAction);
  const managementPayment = event.target.closest(".pay-management");
  if (managementPayment) openManagementPayment(managementPayment);
  const summary = event.target.closest("[data-summary]");
  if (summary) openSummaryDetails(summary.dataset.summary);
  const homeSummary = event.target.closest("[data-home-summary]");
  if (homeSummary && dashboardFinanceData) {
    openSummaryDetails(homeSummary.dataset.homeSummary, dashboardFinanceData);
  }
  const summaryOrder = event.target.closest(".open-summary-order");
  if (summaryOrder) {
    $("#actionDialog").close();
    openOrder(summaryOrder.dataset.id, "os-finance");
  }
  const cashCancellation = event.target.closest(".cancel-cash-entry");
  if (cashCancellation && confirm("Cancelar este lançamento financeiro?")) {
    post(`/api/financeiro/caixa/${cashCancellation.dataset.id}/cancelar`)
      .then(async () => {
        $("#actionDialog").close();
        toast("Lançamento cancelado.");
        if (managementData) await loadFinancialManagement(managementData.periodo);
        await loadFinance();
      }).catch(error => toast(error.message));
  }
  const managementCancellation = event.target.closest(".cancel-management-entry");
  if (managementCancellation && confirm("Cancelar este lançamento financeiro?")) {
    post(`/api/financeiro/gestao/${managementCancellation.dataset.id}/cancelar`)
      .then(async () => {
        $("#actionDialog").close();
        toast("Lançamento cancelado.");
        if (managementData) await loadFinancialManagement(managementData.periodo);
        await loadFinance();
      }).catch(error => toast(error.message));
  }
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
$("#notificationButton").onclick = openNotifications;
$("#accountButton").onclick = () => openProfile().catch(error => toast(error.message));
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
  try { localStorage.removeItem("studio_authenticated"); } catch {}
  document.body.classList.remove("auth-loading");
  document.body.classList.remove("authenticated");
  applicationStarted = false;
  sessionUser = null;
}

async function startApplication(user) {
  sessionUser = user || sessionUser;
  if (sessionUser) {
    $("#studioName").textContent = sessionUser.nome_estudio || "Gestão do estúdio";
    document.title = sessionUser.nome_estudio || "Gestão do estúdio";
    $("#adminStudiosNav").hidden = sessionUser.papel !== "SUPERADMIN";
  }
  try { localStorage.setItem("studio_authenticated", "1"); } catch {}
  document.body.classList.remove("auth-loading");
  document.body.classList.add("authenticated");
  if (applicationStarted) return;
  applicationStarted = true;
  loadNotifications().catch(() => {});
  api("/api/perfil").then(profile => displayAccountPhoto(profile.foto_perfil))
    .catch(() => {});
  setupPullToRefresh();
  try {
    const savedPage = sessionStorage.getItem("activePage");
    const savedNav = savedPage ? $(`.nav-link[data-page="${savedPage}"]`) : null;
    if (savedNav && !savedNav.hidden && savedPage !== "agenda") savedNav.click();
  } catch {}
  if ($("#agenda").classList.contains("active")) {
    showAgenda().catch(error => toast(error.message));
  }
}

async function checkAuthentication() {
  try {
    const session = await api("/api/auth/me");
    if (session.authenticated) await startApplication(session.user);
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

    const session = await api("/api/auth/me");
    await startApplication(session.user);
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
