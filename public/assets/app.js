const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const api = async (path, options = {}) => {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir.");
  return data;
};
const money = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const toast = message => {
  $("#toast").textContent = message; $("#toast").classList.add("show");
  setTimeout(() => $("#toast").classList.remove("show"), 2500);
};
const send = (path, method, form) => api(path, {
  method, headers: { "content-type": "application/json" },
  body: JSON.stringify(Object.fromEntries(new FormData(form)))
});

let calendar;
let selectedClientId = null;
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
    <article class="card"><div class="card-head"><strong>${date}</strong><span class="badge">${items.length}</span></div>
    ${items.map(item => `<p><button class="client-item open-order" data-id="${item.id_agendamento}">
      <strong>${item.hora}</strong> · ${escapeHtml(item.nome)} <span class="badge">${escapeHtml(item.status)}</span></button>
      ${item.eh_amanha && !item.cancelado ? `<a class="primary" target="_blank" href="${item.link_whatsapp}">Confirmar presença</a>` : ""}</p>`).join("")}</article>
  `).join("") || `<div class="panel empty">Nenhum agendamento futuro.</div>`;
  await loadFinance();
}

async function loadFinance() {
  const data = await api("/api/dashboard");
  const html = `<div class="stats">
    <div class="card stat"><span class="muted">Hoje</span><strong>${money(data.resumo.receber_hoje)}</strong></div>
    <div class="card stat"><span class="muted">No mês</span><strong>${money(data.resumo.receber_mes)}</strong></div>
    <div class="card stat"><span class="muted">Atrasado</span><strong>${money(data.resumo.atrasado)}</strong></div>
  </div><h2>Sinais pendentes</h2>${data.sinais_pendentes.map(x => `<div class="card card-head"><div><strong>${escapeHtml(x.nome)}</strong><div class="muted">${x.data_agendamento} · ${money(x.valor)}</div></div><button class="primary open-order" data-id="${x.id_agendamento}">Abrir</button></div>`).join("") || `<div class="card muted">Nenhum sinal pendente.</div>`}
  <h2>Parcelas atrasadas</h2>${data.parcelas_atrasadas.map(x => `<div class="card">${escapeHtml(x.nome)} · ${money(x.valor)} · ${x.vencimento}</div>`).join("") || `<div class="card muted">Nenhuma parcela atrasada.</div>`}`;
  $("#financePanel").innerHTML = html;
  $("#fullFinancePanel").innerHTML = html;
}

function openAppointment(date = "") {
  const form = $("#appointmentForm"); form.reset();
  form.elements.data.value = date;
  $("#appointmentDialog").showModal();
}

async function loadClients(search = "") {
  const clients = await api(`/api/clientes?busca=${encodeURIComponent(search)}`);
  $("#clientList").innerHTML = clients.map(c => `<button class="client-item select-client" data-id="${c.id}"><strong>${escapeHtml(c.nome)}</strong><br><span class="muted">${escapeHtml(c.telefone)}</span></button>`).join("") || `<p class="muted">Nenhum cliente.</p>`;
}

async function loadClient(id) {
  selectedClientId = id;
  const [client, history, finance] = await Promise.all([
    api(`/api/clientes/${id}`), api(`/api/clientes/${id}/historico`), api(`/api/clientes/${id}/financeiro`)
  ]);
  const balance = finance.orcado - finance.pago + finance.estornado;
  $("#clientDetail").classList.remove("empty");
  $("#clientDetail").innerHTML = `<div class="tabs"><button class="tab active" data-tab="data">Dados</button><button class="tab" data-tab="history">Histórico</button><button class="tab" data-tab="client-finance">Financeiro</button></div>
    <div class="tab-pane active" id="data"><form id="clientForm">
      <div class="fields"><label>Nome<input name="nome" value="${escapeHtml(client.nome)}" required></label><label>Telefone<input name="telefone" value="${escapeHtml(client.telefone)}"></label></div>
      <div class="fields"><label>Cidade<input name="cidade" value="${escapeHtml(client.cidade)}"></label><label>Instagram<input name="instagram" value="${escapeHtml(client.instagram)}"></label></div>
      <div class="fields"><label>CPF<input name="cpf" value="${escapeHtml(client.cpf)}"></label><label>RG<input name="rg" value="${escapeHtml(client.rg)}"></label></div>
      <label>Data de nascimento<input type="date" name="data_nascimento" value="${client.data_nascimento || ""}"></label>
      <label>Observações<textarea name="observacoes">${escapeHtml(client.observacoes)}</textarea></label><button class="primary">Salvar cadastro</button>
    </form></div>
    <div class="tab-pane" id="history">${history.map(x => `<div class="card"><strong>${escapeHtml(x.tipo)}</strong><div class="muted">${escapeHtml(x.data)}</div>${escapeHtml(x.descricao)}</div>`).join("") || `<p class="muted">Sem histórico.</p>`}</div>
    <div class="tab-pane" id="client-finance"><div class="stats"><div class="card stat">Orçado<strong>${money(finance.orcado)}</strong></div><div class="card stat">Pago<strong>${money(finance.pago)}</strong></div><div class="card stat">Em aberto<strong>${money(balance)}</strong></div></div></div>`;
  $("#clientForm").addEventListener("submit", async event => {
    event.preventDefault(); await send(`/api/clientes/${id}`, "PUT", event.currentTarget); toast("Cadastro atualizado."); loadClients();
  });
}

async function openOrder(appointmentId) {
  const data = await api(`/api/os?id=${appointmentId}`);
  const [date, time] = data.data_hora.split(" ");
  $("#orderContent").innerHTML = `<header><h2>Ordem de serviço #${data.id_os}</h2><button class="close" type="button">×</button></header>
    <div class="tabs"><button class="tab active" data-tab="os-data">Cliente</button><button class="tab" data-tab="os-schedule">Agendamento</button><button class="tab" data-tab="os-finance">Financeiro</button></div>
    <div class="tab-pane active" id="os-data"><h2>${escapeHtml(data.nome)}</h2><p>${escapeHtml(data.telefone)} · ${escapeHtml(data.cidade)}</p><p class="muted">${escapeHtml(data.observacoes)}</p></div>
    <div class="tab-pane" id="os-schedule"><form id="scheduleForm"><div class="fields"><label>Data<input name="data" type="date" value="${date}"></label><label>Hora<input name="hora" type="time" value="${time.slice(0,5)}"></label></div><label>Status<select name="status">${["Agendado","Confirmado","Em Atendimento","Finalizado","Cancelado","Remarcado"].map(x => `<option ${x === data.status_agendamento ? "selected" : ""}>${x}</option>`).join("")}</select></label><button class="primary">Salvar</button></form></div>
    <div class="tab-pane" id="os-finance"><div class="stats"><div class="card stat">Valor final<strong>${money(data.valor_final)}</strong></div><div class="card stat">Sinal<strong>${money(data.valor_sinal)}</strong></div><div class="card stat">Status<strong>${data.sinal_pago ? "Recebido" : "Pendente"}</strong></div></div>
      <h2>Registrar pagamento</h2><form id="paymentForm"><input type="hidden" name="id_os" value="${data.id_os}"><input type="hidden" name="tipo" value="Pagamento"><div class="fields"><label>Valor<input name="valor" type="number" step=".01" required></label><label>Forma<select name="forma_pagamento"><option>Pix</option><option>Dinheiro</option><option>Debito</option><option>Credito</option></select></label></div><label>Data<input type="date" name="data_pagamento" value="${new Date().toISOString().slice(0,10)}"></label><label>Observação<input name="observacao"></label><button class="primary">Registrar</button></form>
      <h2>Acréscimo ou desconto</h2><form id="adjustmentForm"><input type="hidden" name="id_os" value="${data.id_os}"><div class="fields"><label>Tipo<select name="tipo"><option>Acrescimo</option><option>Desconto</option></select></label><label>Valor<input name="valor" type="number" step=".01" required></label></div><label>Descrição<input name="descricao"></label><button class="secondary">Registrar ajuste</button></form></div>`;
  $("#orderDialog").showModal();
  $("#scheduleForm").onsubmit = async e => { e.preventDefault(); await send(`/api/agendamentos/${data.id_agendamento}`, "PUT", e.currentTarget); toast("Agendamento atualizado."); $("#orderDialog").close(); loadAgenda(); };
  $("#paymentForm").onsubmit = async e => { e.preventDefault(); await send("/api/movimentos", "POST", e.currentTarget); toast("Pagamento registrado."); $("#orderDialog").close(); loadAgenda(); };
  $("#adjustmentForm").onsubmit = async e => { e.preventDefault(); await send("/api/ajustes", "POST", e.currentTarget); toast("Ajuste registrado."); $("#orderDialog").close(); loadAgenda(); };
}

document.addEventListener("click", event => {
  const nav = event.target.closest(".nav-link");
  if (nav) { $$(".nav-link,.page").forEach(x => x.classList.remove("active")); nav.classList.add("active"); $(`#${nav.dataset.page}`).classList.add("active"); $("#sidebar").classList.remove("open"); if (nav.dataset.page === "clientes") loadClients(); if (nav.dataset.page === "financeiro") loadFinance(); }
  if (event.target.closest("[data-open=appointment]")) openAppointment();
  if (event.target.closest(".close")) event.target.closest("dialog").close();
  const client = event.target.closest(".select-client"); if (client) loadClient(client.dataset.id);
  const order = event.target.closest(".open-order"); if (order && !order.dataset.os) openOrder(order.dataset.id);
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
  if (!window.matchMedia("(max-width: 800px)").matches || !("ontouchstart" in window)) return;

  const indicator = $("#pullRefresh");
  const icon = $(".pull-refresh-icon", indicator);
  const label = $(".pull-refresh-text", indicator);
  const threshold = 72;
  const maxPull = 112;
  let startY = 0;
  let distance = 0;
  let tracking = false;
  let refreshing = false;

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

  const refreshCurrentPage = async () => {
    const activePage = $(".page.active")?.id;
    if (activePage === "clientes") {
      await loadClients($("#clientSearch").value);
      if (selectedClientId) await loadClient(selectedClientId);
    } else if (activePage === "financeiro") {
      await loadFinance();
    } else {
      await loadAgenda();
    }
  };

  window.addEventListener("touchstart", event => {
    if (refreshing || window.scrollY > 0 || $("dialog[open]")) return;
    startY = event.touches[0].clientY;
    tracking = true;
  }, { passive: true });

  window.addEventListener("touchmove", event => {
    if (!tracking || refreshing) return;
    const delta = event.touches[0].clientY - startY;
    if (delta <= 0 || window.scrollY > 0) return reset();

    event.preventDefault();
    distance = Math.min(maxPull, delta * 0.55);
    indicator.setAttribute("aria-hidden", "false");
    indicator.style.setProperty("--pull-distance", `${distance}px`);
    indicator.classList.add("visible");
    indicator.classList.toggle("ready", distance >= threshold);
    icon.textContent = distance >= threshold ? "↑" : "↓";
    label.textContent = distance >= threshold ? "Solte para atualizar" : "Puxe para atualizar";
  }, { passive: false });

  window.addEventListener("touchend", async () => {
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
      await refreshCurrentPage();
      toast("Página atualizada.");
    } catch (error) {
      toast(error.message);
    } finally {
      refreshing = false;
      indicator.classList.remove("refreshing");
      reset();
    }
  }, { passive: true });

  window.addEventListener("touchcancel", reset, { passive: true });
}

setupPullToRefresh();
loadAgenda().catch(error => toast(error.message));
