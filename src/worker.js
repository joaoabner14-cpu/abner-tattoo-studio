import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse
} from "@simplewebauthn/server";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });

const error = (message, status = 400) => json({ error: message }, status);
const number = value => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  let clean = String(value ?? "").trim().replace(/[^\d,.-]/g, "");
  if (clean.includes(",")) clean = clean.replace(/\./g, "").replace(",", ".");
  return Number.parseFloat(clean) || 0;
};
const integer = value => Number.parseInt(value, 10) || 0;
const required = (value, name) => {
  const clean = String(value ?? "").trim();
  if (!clean) throw new Error(`O campo ${name} é obrigatório.`);
  return clean;
};
const body = async request => {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) return request.json();
  return Object.fromEntries(await request.formData());
};

function saoPauloDate(offsetDays = 0) {
  const now = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(now);
}

function brDateTime(value) {
  if (!value) return "";
  const [date, time = ""] = value.split(" ");
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}${time ? ` ${time.slice(0, 5)}` : ""}`;
}

function nextBusinessDay(value) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  do date.setUTCDate(date.getUTCDate() + 1);
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6);
  return date.toISOString().slice(0, 10);
}

function addMonths(value, amount) {
  const [year, month, day] = value.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + amount, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

function addDays(value, amount) {
  if (!value || !amount) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + Number(amount)));
  return date.toISOString().slice(0, 10);
}

function effectiveInkExpiry(item) {
  const dates = [
    item.data_validade || null,
    addDays(item.data_abertura, item.validade_apos_aberto_dias)
  ].filter(Boolean).sort();
  return dates[0] || null;
}

const whatsappPhone = value => {
  const phone = String(value || "").replace(/\D/g, "");
  return phone.startsWith("55") ? phone : `55${phone}`;
};

async function listAppointments(db, url) {
  const { results } = await db.prepare(`
    SELECT a.id, a.data_hora, a.status, c.nome, c.telefone
    FROM agendamentos a JOIN clientes c ON c.id = a.id_cliente
    ORDER BY a.data_hora
  `).all();
  if (url.searchParams.get("tipo") !== "lista") {
    return json(results.filter(x => x.status.toLowerCase() !== "cancelado")
      .map(x => ({ id: x.id, title: x.nome, start: x.data_hora.replace(" ", "T") })));
  }
  const today = saoPauloDate();
  const tomorrow = saoPauloDate(1);
  const grouped = {};
  for (const row of results.filter(x => x.data_hora.slice(0, 10) >= today)) {
    const date = row.data_hora.slice(0, 10);
    const phone = row.telefone.replace(/\D/g, "");
    const message = encodeURIComponent(
      `Olá, ${row.nome}, tudo bem?

Você possui uma sessão de tatuagem agendada no Abner Tattoo Studio dia *${brDateTime(row.data_hora)}*.

Vou te passar um pequeno preparo para esse dia.

Confirme sua presença respondendo SIM.

Responda NÃO para cancelar ou solicite um REAGENDAMENTO.

1- hidratação é muito importante, mantenha-se hidratada bebendo água regularmente 💧

2- comece a passar hidratante na região onde será feita a tatuagem, uma pele bem hidratada pigmentará melhor e doerá bem menos 😉

3- alimente-se antes da sessão, é ideal que esteja bem para que a tatuagem fique linda 🤩`
    );
    const key = brDateTime(date);
    (grouped[key] ||= []).push({
      id_agendamento: row.id, hora: row.data_hora.slice(11, 16), nome: row.nome,
      status: row.status, cancelado: row.status.toLowerCase() === "cancelado",
      eh_amanha: date === tomorrow,
      link_whatsapp: `https://wa.me/55${phone}?text=${message}`
    });
  }
  return json(grouped);
}

async function clients(db, request, url) {
  if (request.method === "POST" && url.pathname === "/api/clientes") {
    const data = await body(request);
    const nome = required(data.nome, "nome");
    const telefone = required(data.telefone, "telefone");
    const cpf = String(data.cpf || "").replace(/\D/g, "") || null;
    const created = await db.prepare(`
      INSERT INTO clientes(nome,telefone,cidade,data_nascimento,instagram,cpf,rg,observacoes,status)
      VALUES(?,?,?,?,?,?,?,?,'Ativo')
    `).bind(nome, telefone, data.cidade || "", data.data_nascimento || null,
      data.instagram || "", cpf, data.rg || "", data.observacoes || "").run();
    return json({ ok: true, id: created.meta.last_row_id, nome }, 201);
  }
  if (request.method === "GET" && url.pathname === "/api/clientes") {
    const search = `%${url.searchParams.get("busca") || ""}%`;
    const { results } = await db.prepare(`
      SELECT id, nome, telefone FROM clientes
      WHERE nome LIKE ? COLLATE NOCASE ORDER BY nome LIMIT 100
    `).bind(search).all();
    return json(results);
  }
  if (request.method === "GET" && /^\/api\/clientes\/\d+$/.test(url.pathname)) {
    const id = integer(url.pathname.split("/").pop());
    const client = await db.prepare("SELECT * FROM clientes WHERE id = ?").bind(id).first();
    return client ? json(client) : error("Cliente não encontrado.", 404);
  }
  if (request.method === "PUT" && /^\/api\/clientes\/\d+$/.test(url.pathname)) {
    const id = integer(url.pathname.split("/").pop());
    const data = await body(request);
    await db.prepare(`
      UPDATE clientes SET nome=?, telefone=?, cidade=?, instagram=?, cpf=?, rg=?,
        data_nascimento=?, observacoes=? WHERE id=?
    `).bind(required(data.nome, "nome"), data.telefone || "", data.cidade || "",
      data.instagram || "", String(data.cpf || "").replace(/\D/g, "") || null, data.rg || "", data.data_nascimento || null,
      data.observacoes || "", id).run();
    return json({ ok: true });
  }
  return null;
}

async function createAppointment(db, request) {
  const data = await body(request);
  const nome = required(data.nome, "nome");
  const telefone = required(data.telefone, "telefone");
  const date = required(data.data, "data");
  const time = required(data.hora, "hora");
  let clientId = integer(data.id_cliente);
  if (!clientId) {
    const existing = await db.prepare("SELECT id FROM clientes WHERE telefone=? LIMIT 1").bind(telefone).first();
    if (existing) clientId = existing.id;
    else {
      const created = await db.prepare(
        "INSERT INTO clientes(nome, telefone, status) VALUES(?, ?, 'Ativo')"
      ).bind(nome, telefone).run();
      clientId = created.meta.last_row_id;
    }
  }
  const value = number(data.valor);
  const appointment = await db.prepare(`
    INSERT INTO agendamentos(id_cliente, data_hora, valor_orcado) VALUES(?, ?, ?)
  `).bind(clientId, `${date} ${time}:00`, value).run();
  const appointmentId = appointment.meta.last_row_id;
  const order = await db.prepare(`
    INSERT INTO ordem_servico(id_cliente, id_agendamento, status, valor_tatuagem)
    VALUES(?, ?, 'Agendada', ?)
  `).bind(clientId, appointmentId, value).run();
  await db.prepare(`
    INSERT INTO financeiro(id_cliente, id_os, valor_orcado, valor_sinal, valor_final, status)
    VALUES(?, ?, ?, ?, ?, 'Pendente')
  `).bind(clientId, order.meta.last_row_id, value, number(data.sinal), value).run();
  return json({ ok: true, id: appointmentId }, 201);
}

async function openOrder(db, url) {
  const id = integer(url.searchParams.get("id"));
  const row = await db.prepare(`
    SELECT a.id id_agendamento, a.data_hora, a.status status_agendamento,
      c.id id_cliente, c.nome, c.telefone, c.cidade, c.data_nascimento, c.instagram,
      c.cpf, c.rg, c.observacoes, os.id id_os, os.status, os.descricao,
      f.id id_financeiro, f.valor_orcado, f.valor_sinal, f.valor_adicional,
      f.valor_desconto, f.valor_final, f.forma_pagamento, f.sinal_pago,
      f.data_pagamento_sinal
    FROM agendamentos a JOIN clientes c ON c.id=a.id_cliente
    LEFT JOIN ordem_servico os ON os.id_agendamento=a.id
    LEFT JOIN financeiro f ON f.id_os=os.id WHERE a.id=? LIMIT 1
  `).bind(id).first();
  if (!row) return error("Agendamento não encontrado.", 404);
  const { results: installments } = await db.prepare(`
    SELECT id, numero_parcela, data_vencimento, data_pagamento, valor_parcela, status
    FROM crediario WHERE id_financeiro=? AND status<>'Cancelado' ORDER BY numero_parcela
  `).bind(row.id_financeiro).all();
  const paid = await db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN tipo IN ('Pagamento','Sinal') THEN valor
      WHEN tipo='Estorno' THEN -valor ELSE 0 END),0) total
    FROM financeiro_movimentos WHERE id_financeiro=?
  `).bind(row.id_financeiro).first();
  const { results: materials } = await db.prepare(`
    SELECT oc.id, oc.quantidade, oc.unidade, oc.observacao, oc.data_lancamento,
      e.id id_estoque, e.nome material
    FROM os_consumo oc JOIN estoque e ON e.id=oc.id_estoque
    WHERE oc.id_os=? ORDER BY oc.data_lancamento DESC, oc.id DESC
  `).bind(row.id_os).all();
  const { results: cups } = await db.prepare(`
    SELECT id,identificacao,tamanho,capacidade_ml,observacao,data_registro
    FROM os_batoques WHERE id_os=? ORDER BY id
  `).bind(row.id_os).all();
  const { results: cupInks } = await db.prepare(`
    SELECT obt.id,obt.id_batoque,obt.id_estoque,obt.nome_tinta,obt.cor,
      obt.gotas,obt.ml_por_gota,obt.volume_consumido_ml
    FROM os_batoque_tintas obt JOIN os_batoques ob ON ob.id=obt.id_batoque
    WHERE ob.id_os=? ORDER BY obt.id
  `).bind(row.id_os).all();
  const { results: movements } = await db.prepare(`
    SELECT id, tipo, valor, forma_pagamento, observacao, data_pagamento, data_movimento
    FROM financeiro_movimentos WHERE id_financeiro=?
    ORDER BY COALESCE(data_pagamento,data_movimento) DESC, id DESC
  `).bind(row.id_financeiro).all();
  const { results: adjustments } = await db.prepare(`
    SELECT id, tipo, valor, descricao, data_registro
    FROM financeiro_ajustes WHERE id_financeiro=? ORDER BY data_registro DESC, id DESC
  `).bind(row.id_financeiro).all();
  return json({ ...row, parcelas: installments, materiais: materials,
    batoques: cups.map(cup => ({
      ...cup, tintas: cupInks.filter(ink => ink.id_batoque === cup.id)
    })),
    movimentos: movements, ajustes: adjustments, total_pago: paid.total,
    saldo_aberto: Math.max(0, row.valor_final - paid.total) });
}

async function orderService(db, request, url) {
  const parts = url.pathname.split("/");
  const osId = integer(parts[3]);
  const order = await db.prepare("SELECT id FROM ordem_servico WHERE id=?").bind(osId).first();
  if (!order) return error("Ordem de serviço não encontrada.", 404);
  if (request.method === "PUT" && parts.length === 4) {
    const data = await body(request);
    await db.prepare("UPDATE ordem_servico SET descricao=? WHERE id=?")
      .bind(data.descricao || "", osId).run();
    return json({ ok: true });
  }
  if (request.method === "POST" && parts[4] === "materiais") {
    const data = await body(request);
    const material = required(data.material, "material");
    const quantity = number(data.quantidade);
    if (quantity <= 0) return error("Informe uma quantidade válida.");
    let stock = await db.prepare(
      "SELECT id,quantidade_atual FROM estoque WHERE nome=? COLLATE NOCASE LIMIT 1"
    ).bind(material).first();
    if (!stock) {
      const created = await db.prepare(`
        INSERT INTO estoque(nome,categoria,unidade,quantidade_atual,ativo)
        VALUES(?,'Material de tatuagem',?,0,1)
      `).bind(material, data.unidade || "un.").run();
      stock = { id: created.meta.last_row_id, quantidade_atual: 0 };
    }
    const previous = number(stock.quantidade_atual);
    const current = previous - quantity;
    await db.batch([
      db.prepare(`
        INSERT INTO os_consumo(id_os,id_estoque,quantidade,unidade,observacao)
        VALUES(?,?,?,?,?)
      `).bind(osId, stock.id, quantity, data.unidade || "un.", data.observacao || ""),
      db.prepare("UPDATE estoque SET quantidade_atual=? WHERE id=?").bind(current, stock.id),
      db.prepare(`
        INSERT INTO estoque_movimentos
          (id_estoque,tipo,quantidade,saldo_anterior,saldo_atual,observacao,id_os)
        VALUES(?,'Saida',?,?,?,?,?)
      `).bind(stock.id, quantity, previous, current,
        data.observacao || `Material utilizado na OS #${osId}`, osId)
    ]);
    return json({ ok: true }, 201);
  }
  if (request.method === "DELETE" && parts[4] === "materiais" && integer(parts[5])) {
    const consumption = await db.prepare(`
      SELECT oc.id,oc.id_estoque,oc.quantidade,e.quantidade_atual
      FROM os_consumo oc JOIN estoque e ON e.id=oc.id_estoque
      WHERE oc.id=? AND oc.id_os=?
    `).bind(integer(parts[5]), osId).first();
    if (!consumption) return error("Material não encontrado nesta ordem.", 404);
    const previous = number(consumption.quantidade_atual);
    const current = previous + number(consumption.quantidade);
    await db.batch([
      db.prepare("DELETE FROM os_consumo WHERE id=?").bind(consumption.id),
      db.prepare("UPDATE estoque SET quantidade_atual=? WHERE id=?")
        .bind(current, consumption.id_estoque),
      db.prepare(`
        INSERT INTO estoque_movimentos
          (id_estoque,tipo,quantidade,saldo_anterior,saldo_atual,observacao,id_os)
        VALUES(?,'Entrada',?,?,?,?,?)
      `).bind(consumption.id_estoque, consumption.quantidade, previous, current,
        `Estorno do material removido da OS #${osId}`, osId)
    ]);
    return json({ ok: true });
  }
  if (request.method === "POST" && parts[4] === "tintas") {
    const data = await body(request);
    const identification = required(data.identificacao, "identificação do batoque");
    const inks = Array.isArray(data.tintas) ? data.tintas : [];
    if (!inks.length) return error("Adicione pelo menos uma tinta ao batoque.");
    const standardCapacities = { P: 0.5, M: 1, G: 2, GG: 4 };
    const cupSize = ["P", "M", "G", "GG", "Outro"].includes(data.tamanho) ? data.tamanho : "P";
    const cupCapacity = number(data.capacidade_ml) || standardCapacities[cupSize] || null;
    const cup = await db.prepare(`
      INSERT INTO os_batoques(id_os,identificacao,tamanho,capacidade_ml,observacao)
      VALUES(?,?,?,?,?)
    `).bind(osId, identification, cupSize, cupCapacity, data.observacao || "").run();
    const statements = [];
    const balances = new Map();
    try {
      for (const entry of inks) {
        const drops = integer(entry.gotas);
        if (drops <= 0) throw new Error("Informe uma quantidade válida de gotas.");
        const ink = await db.prepare(`
          SELECT id,nome,cor,quantidade_atual,lote,data_validade,
            validade_apos_aberto_dias,data_abertura,
            COALESCE(NULLIF(ml_por_gota,0),0.05) ml_por_gota
          FROM estoque WHERE id=? AND ativo=1 AND tipo_item='Tinta'
        `).bind(integer(entry.id_estoque)).first();
        if (!ink) throw new Error("Uma das tintas selecionadas não foi encontrada no estoque.");
        const expiry = effectiveInkExpiry(ink);
        if (expiry && expiry < saoPauloDate()) {
          throw new Error(`${ink.nome}${ink.lote ? `, lote ${ink.lote}` : ""}, está vencida desde ${brDateTime(expiry)}.`);
        }
        const previous = balances.has(ink.id) ? balances.get(ink.id) : number(ink.quantidade_atual);
        const consumed = Math.round(drops * number(ink.ml_por_gota) * 10000) / 10000;
        const current = Math.round((previous - consumed) * 10000) / 10000;
        balances.set(ink.id, current);
        statements.push(
          db.prepare(`
            INSERT INTO os_batoque_tintas
              (id_batoque,id_estoque,nome_tinta,cor,gotas,ml_por_gota,volume_consumido_ml)
            VALUES(?,?,?,?,?,?,?)
          `).bind(cup.meta.last_row_id, ink.id, ink.nome, ink.cor || "",
            drops, ink.ml_por_gota, consumed),
          db.prepare("UPDATE estoque SET quantidade_atual=? WHERE id=?").bind(current, ink.id),
          db.prepare(`
            INSERT INTO estoque_movimentos
              (id_estoque,tipo,quantidade,saldo_anterior,saldo_atual,observacao,id_os)
            VALUES(?,'Saida',?,?,?,?,?)
          `).bind(ink.id, consumed, previous, current,
            `${drops} gotas em ${identification} da OS #${osId}`, osId)
        );
      }
      await db.batch(statements);
      return json({ ok: true, id: cup.meta.last_row_id }, 201);
    } catch (cause) {
      await db.prepare("DELETE FROM os_batoques WHERE id=?").bind(cup.meta.last_row_id).run();
      throw cause;
    }
  }
  if (request.method === "DELETE" && parts[4] === "tintas" && integer(parts[5])) {
    const cupId = integer(parts[5]);
    const cup = await db.prepare(
      "SELECT id,identificacao FROM os_batoques WHERE id=? AND id_os=?"
    ).bind(cupId, osId).first();
    if (!cup) return error("Batoque não encontrado nesta ordem.", 404);
    const { results: inks } = await db.prepare(`
      SELECT obt.id_estoque,obt.volume_consumido_ml,e.quantidade_atual
      FROM os_batoque_tintas obt JOIN estoque e ON e.id=obt.id_estoque
      WHERE obt.id_batoque=?
    `).bind(cupId).all();
    const restored = new Map();
    for (const ink of inks) {
      const existing = restored.get(ink.id_estoque);
      const current = existing ? existing.current : number(ink.quantidade_atual);
      restored.set(ink.id_estoque, {
        previous: existing ? existing.previous : current,
        current: Math.round((current + number(ink.volume_consumido_ml)) * 10000) / 10000,
        quantity: (existing?.quantity || 0) + number(ink.volume_consumido_ml)
      });
    }
    const statements = [db.prepare("DELETE FROM os_batoques WHERE id=?").bind(cupId)];
    for (const [stockId, values] of restored) {
      statements.push(
        db.prepare("UPDATE estoque SET quantidade_atual=? WHERE id=?")
          .bind(values.current, stockId),
        db.prepare(`
          INSERT INTO estoque_movimentos
            (id_estoque,tipo,quantidade,saldo_anterior,saldo_atual,observacao,id_os)
          VALUES(?,'Entrada',?,?,?,?,?)
        `).bind(stockId, values.quantity, values.previous, values.current,
          `Estorno da receita ${cup.identificacao} da OS #${osId}`, osId)
      );
    }
    await db.batch(statements);
    return json({ ok: true });
  }
  return null;
}

async function stock(db, request, url) {
  const match = url.pathname.match(/^\/api\/estoque(?:\/(\d+))?(?:\/movimentos)?$/);
  if (!match) return null;
  const itemId = integer(match[1]);
  if (request.method === "GET" && url.pathname === "/api/estoque") {
    const search = `%${url.searchParams.get("busca") || ""}%`;
    const summary = await db.prepare(`
      SELECT COUNT(*) itens,
        COALESCE(SUM(CASE WHEN quantidade_atual<=quantidade_minima THEN 1 ELSE 0 END),0) baixos,
        COALESCE(SUM(quantidade_atual*valor_unitario),0) valor_total
      FROM estoque WHERE ativo=1
    `).first();
    const { results: items } = await db.prepare(`
      SELECT id,nome,categoria,marca,unidade,quantidade_atual,quantidade_minima,
        valor_unitario,observacoes,tipo_item,cor,volume_embalagem_ml,ml_por_gota,
        lote,data_validade,validade_apos_aberto_dias,data_abertura,alerta_validade_dias
      FROM estoque WHERE ativo=1 AND (nome LIKE ? COLLATE NOCASE
        OR categoria LIKE ? COLLATE NOCASE OR marca LIKE ? COLLATE NOCASE
        OR cor LIKE ? COLLATE NOCASE OR lote LIKE ? COLLATE NOCASE)
      ORDER BY nome LIMIT 100
    `).bind(search, search, search, search, search).all();
    const today = saoPauloDate();
    const inventory = items.map(item => {
      const expiry = item.tipo_item === "Tinta" ? effectiveInkExpiry(item) : null;
      const days = expiry
        ? Math.ceil((Date.parse(`${expiry}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000)
        : null;
      const status = days == null ? null
        : days < 0 ? "Vencida"
        : days <= integer(item.alerta_validade_dias || 30) ? "Próxima do vencimento" : "Válida";
      return { ...item, validade_efetiva: expiry, dias_para_vencer: days, status_validade: status };
    });
    const alerts = inventory.filter(item =>
      item.status_validade === "Vencida" || item.status_validade === "Próxima do vencimento"
    ).sort((a, b) => String(a.validade_efetiva).localeCompare(String(b.validade_efetiva)));
    summary.vencendo = alerts.filter(item => item.status_validade === "Próxima do vencimento").length;
    summary.vencidos = alerts.filter(item => item.status_validade === "Vencida").length;
    const { results: history } = await db.prepare(`
      SELECT em.id,em.tipo,em.quantidade,em.saldo_anterior,em.saldo_atual,
        em.valor_unitario,em.observacao,em.id_os,em.data_movimento,e.nome,e.unidade
      FROM estoque_movimentos em JOIN estoque e ON e.id=em.id_estoque
      ORDER BY em.data_movimento DESC,em.id DESC LIMIT 100
    `).all();
    return json({ resumo: summary, itens: inventory, alertas: alerts, historico: history });
  }
  if (request.method === "POST" && url.pathname === "/api/estoque") {
    const data = await body(request);
    const name = required(data.nome, "nome");
    const isInk = data.tipo_item === "Tinta";
    const existing = await db.prepare(
      `SELECT id FROM estoque WHERE nome=? COLLATE NOCASE AND ativo=1
       AND (?='Material' OR COALESCE(lote,'')=COALESCE(?,'')) LIMIT 1`
    ).bind(name, isInk ? "Tinta" : "Material", data.lote || "").first();
    if (existing) return error(isInk
      ? "Já existe esta tinta com o mesmo número de lote."
      : "Já existe um material com este nome.");
    const quantity = number(data.quantidade_atual);
    const value = number(data.valor_unitario);
    const created = await db.prepare(`
      INSERT INTO estoque(nome,categoria,marca,unidade,quantidade_atual,
        quantidade_minima,valor_unitario,observacoes,ativo,tipo_item,cor,
        volume_embalagem_ml,ml_por_gota,lote,data_validade,
        validade_apos_aberto_dias,data_abertura,alerta_validade_dias)
      VALUES(?,?,?,?,?,?,?,?,1,?,?,?,?,?,?,?,?,?)
    `).bind(name, data.categoria || "", data.marca || "", data.unidade || "un.",
      quantity, number(data.quantidade_minima), value, data.observacoes || "",
      isInk ? "Tinta" : "Material", isInk ? data.cor || "" : "",
      isInk ? number(data.volume_embalagem_ml) || null : null,
      isInk ? number(data.ml_por_gota) || 0.05 : 0.05,
      isInk ? data.lote || "" : "", isInk ? data.data_validade || null : null,
      isInk ? integer(data.validade_apos_aberto_dias) || null : null,
      isInk ? data.data_abertura || null : null,
      isInk ? integer(data.alerta_validade_dias) || 30 : 30).run();
    if (quantity > 0) {
      await db.prepare(`
        INSERT INTO estoque_movimentos
          (id_estoque,tipo,quantidade,saldo_anterior,saldo_atual,valor_unitario,observacao)
        VALUES(?,'Entrada',?,0,?,?,?)
      `).bind(created.meta.last_row_id, quantity, quantity, value, "Estoque inicial").run();
    }
    return json({ ok: true, id: created.meta.last_row_id }, 201);
  }
  const item = await db.prepare("SELECT * FROM estoque WHERE id=? AND ativo=1")
    .bind(itemId).first();
  if (!item) return error("Material não encontrado.", 404);
  if (request.method === "PUT" && url.pathname === `/api/estoque/${itemId}`) {
    const data = await body(request);
    const isInk = data.tipo_item === "Tinta";
    await db.prepare(`
      UPDATE estoque SET nome=?,categoria=?,marca=?,unidade=?,
        quantidade_minima=?,valor_unitario=?,observacoes=?,tipo_item=?,cor=?,
        volume_embalagem_ml=?,ml_por_gota=?,lote=?,data_validade=?,
        validade_apos_aberto_dias=?,data_abertura=?,alerta_validade_dias=? WHERE id=?
    `).bind(required(data.nome, "nome"), data.categoria || "", data.marca || "",
      data.unidade || "un.", number(data.quantidade_minima),
      number(data.valor_unitario), data.observacoes || "",
      isInk ? "Tinta" : "Material", isInk ? data.cor || "" : "",
      isInk ? number(data.volume_embalagem_ml) || null : null,
      isInk ? number(data.ml_por_gota) || 0.05 : 0.05,
      isInk ? data.lote || "" : "", isInk ? data.data_validade || null : null,
      isInk ? integer(data.validade_apos_aberto_dias) || null : null,
      isInk ? data.data_abertura || null : null,
      isInk ? integer(data.alerta_validade_dias) || 30 : 30, itemId).run();
    return json({ ok: true });
  }
  if (request.method === "POST" && url.pathname === `/api/estoque/${itemId}/movimentos`) {
    const data = await body(request);
    const type = data.tipo;
    if (!["Entrada", "Saida"].includes(type)) return error("Tipo de movimentação inválido.");
    const quantity = number(data.quantidade);
    if (quantity <= 0) return error("Informe uma quantidade válida.");
    const previous = number(item.quantidade_atual);
    const current = type === "Entrada" ? previous + quantity : previous - quantity;
    if (current < 0) return error(`Estoque insuficiente. Saldo atual: ${previous} ${item.unidade}.`);
    const value = number(data.valor_unitario);
    const finalValue = type === "Entrada" && value > 0 ? value : item.valor_unitario;
    await db.batch([
      db.prepare("UPDATE estoque SET quantidade_atual=?,valor_unitario=? WHERE id=?")
        .bind(current, finalValue, itemId),
      db.prepare(`
        INSERT INTO estoque_movimentos
          (id_estoque,tipo,quantidade,saldo_anterior,saldo_atual,valor_unitario,observacao)
        VALUES(?,?,?,?,?,?,?)
      `).bind(itemId, type, quantity, previous, current, finalValue, data.observacao || "")
    ]);
    return json({ ok: true }, 201);
  }
  return null;
}

async function dashboard(db) {
  const today = saoPauloDate();
  const month = today.slice(0, 7);
  const { results: signals } = await db.prepare(`
    SELECT c.nome, f.valor_sinal valor, os.id id_os, a.id id_agendamento, a.data_hora
    FROM financeiro f JOIN clientes c ON c.id=f.id_cliente
    JOIN ordem_servico os ON os.id=f.id_os JOIN agendamentos a ON a.id=os.id_agendamento
    WHERE f.sinal_pago=0 AND f.valor_sinal>0 ORDER BY a.data_hora
  `).all();
  const { results: installments } = await db.prepare(`
    SELECT cr.id, cr.numero_parcela parcela, cr.valor_parcela valor,
      cr.data_vencimento vencimento, c.nome, c.telefone, a.id id_agendamento
    FROM crediario cr JOIN financeiro f ON f.id=cr.id_financeiro
    JOIN clientes c ON c.id=f.id_cliente
    LEFT JOIN ordem_servico os ON os.id=f.id_os
    LEFT JOIN agendamentos a ON a.id=os.id_agendamento
    WHERE cr.status IN ('Pendente','Atrasado') ORDER BY cr.data_vencimento
  `).all();
  const late = installments.filter(x => x.vencimento < today);
  const lateCurrentMonth = late.filter(x => x.vencimento.startsWith(month));
  const cash = await db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN tipo='Entrada' AND substr(data_movimento,1,10)=? THEN valor ELSE 0 END),0) hoje,
      COALESCE(SUM(CASE WHEN tipo='Entrada' AND substr(data_movimento,1,7)=? THEN valor ELSE 0 END),0) mes
    FROM caixa
  `).bind(today, month).first();
  return json({
    resumo: {
      receber_hoje: cash.hoje,
      receber_mes: cash.mes,
      atrasado: lateCurrentMonth.reduce((sum, item) => sum + item.valor, 0)
    },
    sinais_pendentes: signals.map(x => ({ ...x, data_agendamento: brDateTime(x.data_hora) })),
    parcelas_atrasadas: late.map(item => {
      const message = encodeURIComponent(
        `Olá, ${item.nome}, tudo bem?\n\nIdentificamos que a parcela ${item.parcela} do seu crediário, no valor de R$ ${Number(item.valor).toFixed(2).replace(".", ",")}, venceu em *${brDateTime(item.vencimento)}*.\n\nPor favor, entre em contato para regularizarmos o pagamento.`
      );
      return { ...item, link_whatsapp: `https://wa.me/${whatsappPhone(item.telefone)}?text=${message}` };
    })
  });
}

async function createInstallments(db, request) {
  const data = await body(request);
  const idOs = integer(data.id_os);
  const quantity = integer(data.quantidade);
  const firstDueDate = required(data.primeiro_vencimento, "primeiro vencimento");
  if (quantity < 1 || quantity > 60) return error("A quantidade deve ser entre 1 e 60 parcelas.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(firstDueDate)) return error("Informe um vencimento válido.");
  const financial = await db.prepare(`
    SELECT f.id, f.valor_final,
      COALESCE(SUM(CASE WHEN fm.tipo IN ('Pagamento','Sinal') THEN fm.valor
        WHEN fm.tipo='Estorno' THEN -fm.valor ELSE 0 END),0) pago
    FROM financeiro f LEFT JOIN financeiro_movimentos fm ON fm.id_financeiro=f.id
    WHERE f.id_os=? GROUP BY f.id
  `).bind(idOs).first();
  if (!financial) return error("Financeiro não encontrado.", 404);
  const existing = await db.prepare(`
    SELECT COUNT(*) total FROM crediario WHERE id_financeiro=? AND status<>'Cancelado'
  `).bind(financial.id).first();
  if (existing.total) return error("Já existe um crediário para esta ordem de serviço.");
  const balanceCents = Math.round((financial.valor_final - financial.pago) * 100);
  if (balanceCents <= 0) return error("Esta ordem de serviço não possui saldo em aberto.");
  const baseCents = Math.floor(balanceCents / quantity);
  let distributed = 0;
  const statements = [];
  for (let index = 0; index < quantity; index++) {
    const cents = index === quantity - 1 ? balanceCents - distributed : baseCents;
    distributed += cents;
    statements.push(db.prepare(`
      INSERT INTO crediario(id_financeiro,numero_parcela,data_vencimento,valor_parcela,status)
      VALUES(?,?,?,?, 'Pendente')
    `).bind(financial.id, index + 1, addMonths(firstDueDate, index), cents / 100));
  }
  statements.push(db.prepare(
    "UPDATE financeiro SET forma_pagamento='Crediario',status='Parcial' WHERE id=?"
  ).bind(financial.id));
  await db.batch(statements);
  return json({ ok: true }, 201);
}

async function payInstallment(db, request, url) {
  const installmentId = integer(url.pathname.split("/")[3]);
  const installment = await db.prepare(`
    SELECT cr.id, cr.id_financeiro, cr.numero_parcela, cr.valor_parcela, cr.status,
      f.id_cliente, f.id_os
    FROM crediario cr JOIN financeiro f ON f.id=cr.id_financeiro WHERE cr.id=?
  `).bind(installmentId).first();
  if (!installment) return error("Parcela não encontrada.", 404);
  if (installment.status === "Pago") return error("Esta parcela já foi paga.");
  if (installment.status === "Cancelado") return error("Esta parcela está cancelada.");
  const data = await body(request);
  const paymentDate = data.data_pagamento || saoPauloDate();
  const observation = data.observacao || `Parcela ${installment.numero_parcela} do crediário`;
  await db.batch([
    db.prepare(`
      INSERT INTO financeiro_movimentos
        (id_financeiro,id_crediario,tipo,valor,forma_pagamento,observacao,data_pagamento)
      VALUES(?,?,'Pagamento',?,'Pix',?,?)
    `).bind(installment.id_financeiro, installment.id, installment.valor_parcela,
      observation, paymentDate),
    db.prepare(`
      INSERT INTO caixa(data_movimento,tipo,categoria,descricao,valor,id_cliente,id_financeiro,id_os,forma_pagamento)
      VALUES(?,'Entrada','Crediário',?,?,?,?,?,'Pix')
    `).bind(paymentDate, observation,
      installment.valor_parcela, installment.id_cliente, installment.id_financeiro, installment.id_os),
    db.prepare("UPDATE crediario SET status='Pago',data_pagamento=? WHERE id=?")
      .bind(paymentDate, installment.id)
  ]);
  const pending = await db.prepare(`
    SELECT COUNT(*) total FROM crediario WHERE id_financeiro=? AND status IN ('Pendente','Atrasado')
  `).bind(installment.id_financeiro).first();
  if (!pending.total) {
    await db.prepare("UPDATE financeiro SET status='Pago' WHERE id=?").bind(installment.id_financeiro).run();
  }
  return json({ ok: true }, 201);
}

async function finance(db, request, url) {
  const osId = integer(url.searchParams.get("id_os"));
  if (request.method === "GET" && url.pathname === "/api/movimentos") {
    const { results } = await db.prepare(`
      SELECT fm.* FROM financeiro_movimentos fm JOIN financeiro f ON f.id=fm.id_financeiro
      WHERE f.id_os=? ORDER BY fm.data_movimento DESC
    `).bind(osId).all();
    return json(results);
  }
  if (request.method === "GET" && url.pathname === "/api/ajustes") {
    const { results } = await db.prepare(`
      SELECT fa.* FROM financeiro_ajustes fa JOIN financeiro f ON f.id=fa.id_financeiro
      WHERE f.id_os=? ORDER BY fa.data_registro DESC
    `).bind(osId).all();
    return json(results);
  }
  const data = await body(request);
  const idOs = integer(data.id_os);
  const f = await db.prepare("SELECT id, id_cliente, valor_sinal FROM financeiro WHERE id_os=?").bind(idOs).first();
  if (!f) return error("Financeiro não encontrado.", 404);
  if (url.pathname === "/api/movimentos" && request.method === "POST") {
    const value = number(data.valor);
    if (value <= 0) return error("Informe um valor válido.");
    const paymentDate = data.data_pagamento || saoPauloDate();
    await db.prepare(`
      INSERT INTO financeiro_movimentos(id_financeiro,tipo,valor,forma_pagamento,observacao,data_pagamento)
      VALUES(?,?,?,?,?,?)
    `).bind(f.id, data.tipo, value, data.forma_pagamento, data.observacao || "", paymentDate).run();
    if (["Pagamento", "Sinal"].includes(data.tipo)) {
      const availableDate = data.forma_pagamento === "Credito" ? nextBusinessDay(paymentDate) : paymentDate;
      await db.prepare(`
        INSERT INTO caixa(data_movimento,tipo,categoria,descricao,valor,id_cliente,id_financeiro,id_os,forma_pagamento)
        VALUES(?,'Entrada',?,?,?,?,?,?,?)
      `).bind(availableDate, data.tipo, data.observacao || `${data.tipo} recebido`, value,
        f.id_cliente, f.id, idOs, data.forma_pagamento).run();
      const paid = await db.prepare(`
        SELECT COALESCE(SUM(CASE WHEN tipo IN ('Pagamento','Sinal') THEN valor
          WHEN tipo='Estorno' THEN -valor ELSE 0 END),0) total
        FROM financeiro_movimentos WHERE id_financeiro=?
      `).bind(f.id).first();
      if (f.valor_sinal > 0 && paid.total >= f.valor_sinal) {
        await db.prepare("UPDATE financeiro SET sinal_pago=1,data_pagamento_sinal=? WHERE id=?")
          .bind(data.data_pagamento || saoPauloDate(), f.id).run();
      }
    }
    return json({ ok: true }, 201);
  }
  if (url.pathname === "/api/ajustes" && request.method === "POST") {
    await db.prepare(`
      INSERT INTO financeiro_ajustes(id_financeiro,tipo,valor,descricao) VALUES(?,?,?,?)
    `).bind(f.id, data.tipo, number(data.valor), data.descricao || "").run();
    const sums = await db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN tipo='Acrescimo' THEN valor ELSE 0 END),0) adicional,
      COALESCE(SUM(CASE WHEN tipo='Desconto' THEN valor ELSE 0 END),0) desconto
      FROM financeiro_ajustes WHERE id_financeiro=?
    `).bind(f.id).first();
    await db.prepare(`
      UPDATE financeiro SET valor_adicional=?,valor_desconto=?,
      valor_final=valor_orcado+?-? WHERE id=?
    `).bind(sums.adicional, sums.desconto, sums.adicional, sums.desconto, f.id).run();
    return json({ ok: true }, 201);
  }
  return null;
}

async function financialManagement(db, request, url) {
  const today = saoPauloDate();
  const month = /^\d{4}-\d{2}$/.test(url.searchParams.get("mes") || "")
    ? url.searchParams.get("mes") : today.slice(0, 7);
  if (request.method === "GET" && url.pathname === "/api/financeiro/gestao") {
    const cash = await db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN tipo='Entrada' THEN valor ELSE 0 END),0) entradas,
        COALESCE(SUM(CASE WHEN tipo='Saida' THEN valor ELSE 0 END),0) saidas
      FROM caixa WHERE substr(data_movimento,1,7)=?
    `).bind(month).first();
    const annual = await db.prepare(`
      SELECT COALESCE(SUM(valor),0) faturamento
      FROM caixa WHERE tipo='Entrada' AND substr(data_movimento,1,4)=?
    `).bind(month.slice(0, 4)).first();
    const payable = await db.prepare(`
      SELECT COALESCE(SUM(valor),0) total FROM gestao_financeira
      WHERE tipo IN ('Despesa','DAS') AND status='Pendente'
    `).first();
    const manualReceivable = await db.prepare(`
      SELECT COALESCE(SUM(valor),0) total FROM gestao_financeira
      WHERE tipo='Receita' AND status='Pendente'
    `).first();
    const clientReceivable = await db.prepare(`
      SELECT COALESCE(SUM(MAX(0,f.valor_final-COALESCE((
        SELECT SUM(CASE WHEN fm.tipo IN ('Pagamento','Sinal') THEN fm.valor
          WHEN fm.tipo='Estorno' THEN -fm.valor ELSE 0 END)
        FROM financeiro_movimentos fm WHERE fm.id_financeiro=f.id),0))),0) total
      FROM financeiro f WHERE f.status<>'Cancelado'
    `).first();
    const overdueBills = await db.prepare(`
      SELECT COALESCE(SUM(valor),0) total FROM gestao_financeira
      WHERE status='Pendente' AND data_vencimento<?
    `).bind(today).first();
    const overdueCredit = await db.prepare(`
      SELECT COALESCE(SUM(valor_parcela),0) total FROM crediario
      WHERE status IN ('Pendente','Atrasado') AND data_vencimento<?
    `).bind(today).first();
    const { results: launches } = await db.prepare(`
      SELECT * FROM gestao_financeira
      WHERE status='Pendente' OR competencia=?
      ORDER BY CASE WHEN status='Pendente' THEN 0 ELSE 1 END,
        COALESCE(data_vencimento,data_pagamento,data_criacao) DESC,id DESC LIMIT 150
    `).bind(month).all();
    const { results: cashHistory } = await db.prepare(`
      SELECT cx.id,cx.data_movimento,cx.tipo,cx.categoria,cx.descricao,cx.valor,
        cx.forma_pagamento,c.nome cliente,cx.id_os
      FROM caixa cx LEFT JOIN clientes c ON c.id=cx.id_cliente
      WHERE substr(cx.data_movimento,1,7)=?
      ORDER BY cx.data_movimento DESC,cx.id DESC LIMIT 150
    `).bind(month).all();
    const { results: expenseCategories } = await db.prepare(`
      SELECT categoria,SUM(valor) total FROM gestao_financeira
      WHERE tipo IN ('Despesa','DAS') AND status='Pago' AND competencia=?
      GROUP BY categoria ORDER BY total DESC
    `).bind(month).all();
    const { results: monthlyRevenue } = await db.prepare(`
      SELECT substr(data_movimento,1,7) mes,SUM(valor) total FROM caixa
      WHERE tipo='Entrada' AND substr(data_movimento,1,4)=?
      GROUP BY mes ORDER BY mes
    `).bind(month.slice(0, 4)).all();
    return json({
      periodo: month,
      resumo: {
        entradas: cash.entradas, saidas: cash.saidas,
        resultado: cash.entradas - cash.saidas,
        receber: manualReceivable.total + clientReceivable.total,
        pagar: payable.total,
        atrasado: overdueBills.total + overdueCredit.total,
        faturamento_anual: annual.faturamento,
        limite_mei: 81000
      },
      lancamentos: launches, caixa: cashHistory,
      despesas_categoria: expenseCategories, faturamento_mensal: monthlyRevenue
    });
  }
  if (request.method === "POST" && url.pathname === "/api/financeiro/gestao") {
    const data = await body(request);
    const type = data.tipo;
    if (!["Receita", "Despesa", "DAS"].includes(type)) return error("Tipo de lançamento inválido.");
    const value = number(data.valor);
    if (value <= 0) return error("Informe um valor válido.");
    const competence = /^\d{4}-\d{2}$/.test(data.competencia || "")
      ? data.competencia : today.slice(0, 7);
    if (type === "DAS") {
      const existing = await db.prepare(
        "SELECT id FROM gestao_financeira WHERE tipo='DAS' AND competencia=? AND status<>'Cancelado'"
      ).bind(competence).first();
      if (existing) return error("O DAS desta competência já está cadastrado.");
    }
    const paid = data.status === "Pago";
    const paymentDate = paid ? (data.data_pagamento || today) : null;
    const created = await db.prepare(`
      INSERT INTO gestao_financeira(tipo,categoria,descricao,valor,competencia,
        data_vencimento,data_pagamento,forma_pagamento,status,nota_fiscal,documento,observacoes)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(type, data.categoria || (type === "DAS" ? "Impostos" : "Outros"),
      required(data.descricao, "descrição"), value, competence,
      data.data_vencimento || null, paymentDate, data.forma_pagamento || null,
      paid ? "Pago" : "Pendente", data.nota_fiscal ? 1 : 0,
      data.documento || "", data.observacoes || "").run();
    if (paid) {
      await db.prepare(`
        INSERT INTO caixa(data_movimento,tipo,categoria,descricao,valor,
          forma_pagamento,id_lancamento)
        VALUES(?,?,?,?,?,?,?)
      `).bind(paymentDate, type === "Receita" ? "Entrada" : "Saida",
        data.categoria || (type === "DAS" ? "Impostos" : "Outros"),
        data.descricao, value, data.forma_pagamento || "Pix", created.meta.last_row_id).run();
    }
    return json({ ok: true, id: created.meta.last_row_id }, 201);
  }
  const match = url.pathname.match(/^\/api\/financeiro\/gestao\/(\d+)\/pagar$/);
  if (request.method === "POST" && match) {
    const data = await body(request);
    const launch = await db.prepare(
      "SELECT * FROM gestao_financeira WHERE id=?"
    ).bind(integer(match[1])).first();
    if (!launch) return error("Lançamento não encontrado.", 404);
    if (launch.status !== "Pendente") return error("Este lançamento não está pendente.");
    const paymentDate = data.data_pagamento || today;
    const paymentMethod = data.forma_pagamento || "Pix";
    await db.batch([
      db.prepare(`
        UPDATE gestao_financeira SET status='Pago',data_pagamento=?,forma_pagamento=? WHERE id=?
      `).bind(paymentDate, paymentMethod, launch.id),
      db.prepare(`
        INSERT INTO caixa(data_movimento,tipo,categoria,descricao,valor,
          forma_pagamento,id_lancamento)
        VALUES(?,?,?,?,?,?,?)
      `).bind(paymentDate, launch.tipo === "Receita" ? "Entrada" : "Saida",
        launch.categoria, launch.descricao, launch.valor, paymentMethod, launch.id)
    ]);
    return json({ ok: true });
  }
  return null;
}

async function clientSummary(db, url) {
  const id = integer(url.pathname.split("/")[3]);
  if (url.pathname.endsWith("/financeiro")) {
    const totals = await db.prepare(`
      SELECT COALESCE(SUM(f.valor_final),0) orcado,
      COALESCE(SUM((SELECT SUM(CASE WHEN fm.tipo IN ('Pagamento','Sinal') THEN fm.valor ELSE 0 END)
        FROM financeiro_movimentos fm WHERE fm.id_financeiro=f.id)),0) pago,
      COALESCE(SUM((SELECT SUM(CASE WHEN fm.tipo='Estorno' THEN fm.valor ELSE 0 END)
        FROM financeiro_movimentos fm WHERE fm.id_financeiro=f.id)),0) estornado
      FROM financeiro f WHERE f.id_cliente=?
    `).bind(id).first();
    const { results: orders } = await db.prepare(`
      SELECT f.id id_financeiro, f.id_os, a.id id_agendamento, a.data_hora,
        f.valor_final, f.status,
        COALESCE((SELECT SUM(CASE WHEN fm.tipo IN ('Pagamento','Sinal') THEN fm.valor
          WHEN fm.tipo='Estorno' THEN -fm.valor ELSE 0 END)
          FROM financeiro_movimentos fm WHERE fm.id_financeiro=f.id),0) pago,
        COALESCE((SELECT SUM(cr.valor_parcela) FROM crediario cr
          WHERE cr.id_financeiro=f.id AND cr.status IN ('Pendente','Atrasado')),0) parcelado
      FROM financeiro f LEFT JOIN ordem_servico os ON os.id=f.id_os
      LEFT JOIN agendamentos a ON a.id=os.id_agendamento
      WHERE f.id_cliente=? ORDER BY COALESCE(a.data_hora,f.data_criacao) DESC
    `).bind(id).all();
    const { results: movements } = await db.prepare(`
      SELECT fm.id, fm.tipo, fm.valor, fm.forma_pagamento, fm.data_pagamento,
        fm.observacao, f.id_os
      FROM financeiro_movimentos fm JOIN financeiro f ON f.id=fm.id_financeiro
      WHERE f.id_cliente=? ORDER BY COALESCE(fm.data_pagamento,fm.data_movimento) DESC
    `).bind(id).all();
    const { results: installments } = await db.prepare(`
      SELECT cr.id, cr.numero_parcela, cr.data_vencimento, cr.data_pagamento,
        cr.valor_parcela, cr.status, f.id_os, a.id id_agendamento
      FROM crediario cr JOIN financeiro f ON f.id=cr.id_financeiro
      LEFT JOIN ordem_servico os ON os.id=f.id_os
      LEFT JOIN agendamentos a ON a.id=os.id_agendamento
      WHERE f.id_cliente=? AND cr.status<>'Cancelado'
      ORDER BY cr.data_vencimento DESC
    `).bind(id).all();
    const { results: adjustments } = await db.prepare(`
      SELECT fa.id, fa.tipo, fa.valor, fa.descricao, fa.data_registro, f.id_os
      FROM financeiro_ajustes fa JOIN financeiro f ON f.id=fa.id_financeiro
      WHERE f.id_cliente=? ORDER BY fa.data_registro DESC
    `).bind(id).all();
    return json({ ...totals, ordens: orders, movimentos: movements,
      crediarios: installments, ajustes: adjustments });
  }
  const { results: orders } = await db.prepare(`
    SELECT os.id id_os, a.id id_agendamento, a.data_hora, os.status,
      os.descricao, f.valor_final
    FROM ordem_servico os
    LEFT JOIN agendamentos a ON a.id=os.id_agendamento
    LEFT JOIN financeiro f ON f.id_os=os.id
    WHERE os.id_cliente=? ORDER BY COALESCE(a.data_hora,os.data_criacao) DESC
  `).bind(id).all();
  const { results: materials } = await db.prepare(`
    SELECT oc.id_os, e.nome material, oc.quantidade, oc.unidade
    FROM os_consumo oc JOIN estoque e ON e.id=oc.id_estoque
    JOIN ordem_servico os ON os.id=oc.id_os WHERE os.id_cliente=?
    ORDER BY oc.id
  `).bind(id).all();
  return json(orders.map(order => ({
    ...order, materiais: materials.filter(item => item.id_os === order.id_os)
  })));
}

const bytesToBase64 = bytes => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};
const base64ToBytes = value => {
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
};
const randomToken = (size = 32) => {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};
const sha256 = async value => bytesToBase64(
  new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))
);
const parseCookies = request => Object.fromEntries(
  (request.headers.get("cookie") || "").split(";").map(item => item.trim()).filter(Boolean)
    .map(item => {
      const separator = item.indexOf("=");
      return [item.slice(0, separator), decodeURIComponent(item.slice(separator + 1))];
    })
);
const constantEqual = (left, right) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index];
  return difference === 0;
};

async function derivePassword(password, salt, iterations) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
  );
  return new Uint8Array(await crypto.subtle.deriveBits({
    name: "PBKDF2", hash: "SHA-256", salt, iterations
  }, key, 256));
}

async function currentUser(db, request) {
  const token = parseCookies(request).studio_session;
  if (!token) return null;
  const row = await db.prepare(`
    SELECT u.id,u.login,u.nome,s.id id_sessao
    FROM sessoes s JOIN usuarios u ON u.id=s.id_usuario
    WHERE s.token_hash=? AND s.revogada=0 AND s.data_expiracao>CURRENT_TIMESTAMP
      AND u.ativo=1 LIMIT 1
  `).bind(await sha256(token)).first();
  return row || null;
}

async function createSession(db, request, userId) {
  const token = randomToken(32);
  await db.prepare(`
    INSERT INTO sessoes(id_usuario,token_hash,data_expiracao,ip,user_agent)
    VALUES(?,?,datetime('now','+30 days'),?,?)
  `).bind(userId, await sha256(token), request.headers.get("CF-Connecting-IP") || "",
    (request.headers.get("user-agent") || "").slice(0, 500)).run();
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `studio_session=${encodeURIComponent(token)}; Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=2592000`;
}

const authResponse = (data, status = 200, cookie = null) => {
  const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
  if (cookie) headers.set("set-cookie", cookie);
  return new Response(JSON.stringify(data), { status, headers });
};

async function authApi(db, request, url) {
  const path = url.pathname;
  const user = await currentUser(db, request);
  if (path === "/api/auth/me" && request.method === "GET") {
    if (!user) return authResponse({ authenticated: false }, 401);
    const credential = await db.prepare(
      "SELECT COUNT(*) total FROM webauthn_credenciais WHERE id_usuario=?"
    ).bind(user.id).first();
    return authResponse({ authenticated: true, user: {
      id: user.id, login: user.login, nome: user.nome, passkey: credential.total > 0
    } });
  }
  if (path === "/api/auth/login" && request.method === "POST") {
    const data = await body(request);
    const login = String(data.login || "").trim().toLowerCase();
    const ip = request.headers.get("CF-Connecting-IP") || "local";
    const attempts = await db.prepare(`
      SELECT COUNT(*) total FROM tentativas_login
      WHERE login=? AND ip=? AND sucesso=0 AND data_tentativa>datetime('now','-15 minutes')
    `).bind(login, ip).first();
    if (attempts.total >= 5) return authResponse(
      { error: "Muitas tentativas. Aguarde 15 minutos." }, 429
    );
    const account = await db.prepare(
      "SELECT * FROM usuarios WHERE login=? AND ativo=1 LIMIT 1"
    ).bind(login).first();
    const salt = account ? base64ToBytes(account.senha_salt) : new Uint8Array(32);
    const expected = account ? base64ToBytes(account.senha_hash) : new Uint8Array(32);
    const derived = await derivePassword(String(data.senha || ""), salt,
      account?.senha_iteracoes || 310000);
    const valid = Boolean(account) && constantEqual(derived, expected);
    await db.prepare("INSERT INTO tentativas_login(login,ip,sucesso) VALUES(?,?,?)")
      .bind(login || "-", ip, valid ? 1 : 0).run();
    if (!valid) return authResponse({ error: "Login ou senha inválidos." }, 401);
    await db.prepare("UPDATE usuarios SET ultimo_login=CURRENT_TIMESTAMP WHERE id=?")
      .bind(account.id).run();
    return authResponse({ ok: true }, 200, await createSession(db, request, account.id));
  }
  if (path === "/api/auth/logout" && request.method === "POST") {
    if (user) await db.prepare("UPDATE sessoes SET revogada=1 WHERE id=?").bind(user.id_sessao).run();
    const secure = url.protocol === "https:" ? "; Secure" : "";
    return authResponse({ ok: true }, 200,
      `studio_session=; Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=0`);
  }
  if (path === "/api/auth/passkey/register/options" && request.method === "POST") {
    if (!user) return authResponse({ error: "Não autorizado." }, 401);
    const { results: credentials } = await db.prepare(
      "SELECT credential_id,transports FROM webauthn_credenciais WHERE id_usuario=?"
    ).bind(user.id).all();
    const options = await generateRegistrationOptions({
      rpName: "Abner Tattoo Studio", rpID: url.hostname,
      userName: user.login, userDisplayName: user.nome,
      userID: new TextEncoder().encode(String(user.id)),
      attestationType: "none",
      excludeCredentials: credentials.map(item => ({
        id: item.credential_id, transports: JSON.parse(item.transports || "[]")
      })),
      authenticatorSelection: {
        residentKey: "required", userVerification: "required",
        authenticatorAttachment: "platform"
      }
    });
    await db.prepare(`
      INSERT INTO webauthn_desafios(id_usuario,desafio,tipo,data_expiracao)
      VALUES(?,?,'registro',datetime('now','+5 minutes'))
    `).bind(user.id, options.challenge).run();
    return authResponse(options);
  }
  if (path === "/api/auth/passkey/register/verify" && request.method === "POST") {
    if (!user) return authResponse({ error: "Não autorizado." }, 401);
    const data = await body(request);
    const challenge = await db.prepare(`
      SELECT * FROM webauthn_desafios WHERE id_usuario=? AND tipo='registro'
        AND data_expiracao>CURRENT_TIMESTAMP ORDER BY id DESC LIMIT 1
    `).bind(user.id).first();
    if (!challenge) return authResponse({ error: "Desafio expirado." }, 400);
    const verification = await verifyRegistrationResponse({
      response: data, expectedChallenge: challenge.desafio,
      expectedOrigin: url.origin, expectedRPID: url.hostname,
      requireUserVerification: true
    });
    await db.prepare("DELETE FROM webauthn_desafios WHERE id=?").bind(challenge.id).run();
    if (!verification.verified || !verification.registrationInfo) {
      return authResponse({ error: "Não foi possível validar a biometria." }, 400);
    }
    const info = verification.registrationInfo;
    await db.prepare(`
      INSERT INTO webauthn_credenciais
        (id_usuario,credential_id,public_key,counter,transports,device_type,backed_up)
      VALUES(?,?,?,?,?,?,?)
    `).bind(user.id, info.credential.id, bytesToBase64(info.credential.publicKey),
      info.credential.counter, JSON.stringify(data.response?.transports || []),
      info.credentialDeviceType, info.credentialBackedUp ? 1 : 0).run();
    return authResponse({ ok: true });
  }
  if (path === "/api/auth/passkey/options" && request.method === "POST") {
    const options = await generateAuthenticationOptions({
      rpID: url.hostname, userVerification: "required", allowCredentials: []
    });
    await db.prepare(`
      INSERT INTO webauthn_desafios(desafio,tipo,data_expiracao)
      VALUES(?,'autenticacao',datetime('now','+5 minutes'))
    `).bind(options.challenge).run();
    return authResponse(options);
  }
  if (path === "/api/auth/passkey/verify" && request.method === "POST") {
    const data = await body(request);
    const challenge = await db.prepare(`
      SELECT * FROM webauthn_desafios WHERE tipo='autenticacao'
        AND data_expiracao>CURRENT_TIMESTAMP ORDER BY id DESC LIMIT 1
    `).first();
    const credential = await db.prepare(`
      SELECT wc.*,u.ativo FROM webauthn_credenciais wc
      JOIN usuarios u ON u.id=wc.id_usuario WHERE wc.credential_id=? LIMIT 1
    `).bind(data.id || "").first();
    if (!challenge || !credential || !credential.ativo) {
      return authResponse({ error: "Não foi possível autenticar." }, 401);
    }
    const verification = await verifyAuthenticationResponse({
      response: data, expectedChallenge: challenge.desafio,
      expectedOrigin: url.origin, expectedRPID: url.hostname,
      credential: {
        id: credential.credential_id,
        publicKey: base64ToBytes(credential.public_key),
        counter: credential.counter,
        transports: JSON.parse(credential.transports || "[]")
      },
      requireUserVerification: true
    });
    await db.prepare("DELETE FROM webauthn_desafios WHERE id=?").bind(challenge.id).run();
    if (!verification.verified) return authResponse({ error: "Biometria inválida." }, 401);
    await db.prepare(`
      UPDATE webauthn_credenciais SET counter=?,ultimo_uso=CURRENT_TIMESTAMP WHERE id=?
    `).bind(verification.authenticationInfo.newCounter, credential.id).run();
    return authResponse({ ok: true }, 200,
      await createSession(db, request, credential.id_usuario));
  }
  return authResponse({ error: "Rota de autenticação não encontrada." }, 404);
}

async function api(request, env, url) {
  const db = env.DB;
  const clientResponse = await clients(db, request, url);
  if (clientResponse) return clientResponse;
  const stockResponse = await stock(db, request, url);
  if (stockResponse) return stockResponse;
  if (url.pathname.startsWith("/api/financeiro/gestao")) {
    const managementResponse = await financialManagement(db, request, url);
    if (managementResponse) return managementResponse;
  }
  if (request.method === "GET" && url.pathname === "/api/agendamentos") return listAppointments(db, url);
  if (request.method === "POST" && url.pathname === "/api/agendamentos") return createAppointment(db, request);
  if (request.method === "PUT" && /^\/api\/agendamentos\/\d+$/.test(url.pathname)) {
    const data = await body(request);
    const status = data.status === "Finalizado" ? "Concluido" : data.status;
    const allowedStatuses = ["Agendado", "Confirmado", "Concluido", "Cancelado", "Remarcado"];
    if (!allowedStatuses.includes(status)) return error("Status de agendamento inválido.", 400);
    await db.prepare("UPDATE agendamentos SET data_hora=?,status=? WHERE id=?")
      .bind(`${data.data} ${data.hora}:00`, status, integer(url.pathname.split("/").pop())).run();
    return json({ ok: true });
  }
  if (request.method === "GET" && url.pathname === "/api/os") return openOrder(db, url);
  if (/^\/api\/os\/\d+(?:\/(?:materiais|tintas)(?:\/\d+)?)?$/.test(url.pathname)) {
    const response = await orderService(db, request, url);
    if (response) return response;
  }
  if (request.method === "GET" && url.pathname === "/api/dashboard") return dashboard(db);
  if (request.method === "POST" && url.pathname === "/api/crediario") return createInstallments(db, request);
  if (request.method === "POST" && /^\/api\/crediario\/\d+\/pagar$/.test(url.pathname))
    return payInstallment(db, request, url);
  if (["/api/movimentos", "/api/ajustes"].includes(url.pathname)) return finance(db, request, url);
  if (request.method === "GET" && /^\/api\/clientes\/\d+\/(historico|financeiro)$/.test(url.pathname))
    return clientSummary(db, url);
  return error("Rota não encontrada.", 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/auth/")) return await authApi(env.DB, request, url);
      if (url.pathname.startsWith("/api/")) {
        const user = await currentUser(env.DB, request);
        if (!user) return error("Sessão expirada. Entre novamente.", 401);
        const origin = request.headers.get("origin");
        if (!["GET", "HEAD"].includes(request.method) && origin && origin !== url.origin) {
          return error("Origem da solicitação não permitida.", 403);
        }
        return await api(request, env, url);
      }
      const response = await env.ASSETS.fetch(request);
      const headers = new Headers(response.headers);
      if (url.pathname === "/" || /\.(?:html|js|css)$/.test(url.pathname)) {
        headers.set("cache-control", "no-cache, must-revalidate");
      }
      headers.set("x-content-type-options", "nosniff");
      headers.set("x-frame-options", "DENY");
      headers.set("referrer-policy", "no-referrer");
      headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), publickey-credentials-get=(self), publickey-credentials-create=(self)");
      headers.set("content-security-policy",
        "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch (cause) {
      console.error(cause);
      return error(cause.message || "Erro interno.", 500);
    }
  }
};
