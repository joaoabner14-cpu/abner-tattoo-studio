const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });

const error = (message, status = 400) => json({ error: message }, status);
const number = value => Number.parseFloat(value) || 0;
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
      `Olá, tudo bem? Você possui uma sessão de tatuagem agendada no Abner Tattoo Studio dia ${brDateTime(row.data_hora)}. Confirme sua presença respondendo SIM.`
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
      data.instagram || "", data.cpf || "", data.rg || "", data.data_nascimento || null,
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
  return row ? json(row) : error("Agendamento não encontrado.", 404);
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
    SELECT cr.numero_parcela parcela, cr.valor_parcela valor, cr.data_vencimento vencimento, c.nome
    FROM crediario cr JOIN financeiro f ON f.id=cr.id_financeiro
    JOIN clientes c ON c.id=f.id_cliente WHERE cr.status='Pendente' ORDER BY cr.data_vencimento
  `).all();
  const late = installments.filter(x => x.vencimento < today);
  const current = installments.filter(x => x.vencimento.startsWith(month));
  return json({
    resumo: {
      receber_hoje: installments.filter(x => x.vencimento === today).reduce((s, x) => s + x.valor, 0),
      receber_mes: current.reduce((s, x) => s + x.valor, 0),
      atrasado: late.reduce((s, x) => s + x.valor, 0)
    },
    sinais_pendentes: signals.map(x => ({ ...x, data_agendamento: brDateTime(x.data_hora) })),
    parcelas_atrasadas: late, parcelas_mes: current
  });
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
    await db.prepare(`
      INSERT INTO financeiro_movimentos(id_financeiro,tipo,valor,forma_pagamento,observacao,data_pagamento)
      VALUES(?,?,?,?,?,?)
    `).bind(f.id, data.tipo, value, data.forma_pagamento, data.observacao || "", data.data_pagamento || saoPauloDate()).run();
    if (data.tipo === "Pagamento") {
      await db.prepare(`
        INSERT INTO caixa(tipo,categoria,descricao,valor,id_cliente,id_financeiro,id_os,forma_pagamento)
        VALUES('Entrada','Pagamento',?,?,?,?,?,?)
      `).bind(data.observacao || "Pagamento recebido", value, f.id_cliente, f.id, idOs, data.forma_pagamento).run();
      const paid = await db.prepare(`
        SELECT COALESCE(SUM(CASE WHEN tipo='Pagamento' THEN valor ELSE -valor END),0) total
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

async function clientSummary(db, url) {
  const id = integer(url.pathname.split("/")[3]);
  if (url.pathname.endsWith("/financeiro")) {
    const totals = await db.prepare(`
      SELECT COALESCE(SUM(f.valor_final),0) orcado,
      COALESCE(SUM((SELECT SUM(CASE WHEN fm.tipo='Pagamento' THEN fm.valor ELSE 0 END)
        FROM financeiro_movimentos fm WHERE fm.id_financeiro=f.id)),0) pago,
      COALESCE(SUM((SELECT SUM(CASE WHEN fm.tipo='Estorno' THEN fm.valor ELSE 0 END)
        FROM financeiro_movimentos fm WHERE fm.id_financeiro=f.id)),0) estornado
      FROM financeiro f WHERE f.id_cliente=?
    `).bind(id).first();
    return json(totals);
  }
  const { results } = await db.prepare(`
    SELECT data_hora data, 'Agendamento' tipo, status descricao FROM agendamentos WHERE id_cliente=?
    UNION ALL
    SELECT fm.data_pagamento, fm.tipo, 'R$ '||printf('%.2f',fm.valor)||' - '||COALESCE(fm.observacao,'')
      FROM financeiro_movimentos fm JOIN financeiro f ON f.id=fm.id_financeiro WHERE f.id_cliente=?
    UNION ALL
    SELECT fa.data_registro, fa.tipo, 'R$ '||printf('%.2f',fa.valor)||' - '||COALESCE(fa.descricao,'')
      FROM financeiro_ajustes fa JOIN financeiro f ON f.id=fa.id_financeiro WHERE f.id_cliente=?
    ORDER BY data DESC
  `).bind(id, id, id).all();
  return json(results);
}

async function api(request, env, url) {
  const db = env.DB;
  const clientResponse = await clients(db, request, url);
  if (clientResponse) return clientResponse;
  if (request.method === "GET" && url.pathname === "/api/agendamentos") return listAppointments(db, url);
  if (request.method === "POST" && url.pathname === "/api/agendamentos") return createAppointment(db, request);
  if (request.method === "PUT" && /^\/api\/agendamentos\/\d+$/.test(url.pathname)) {
    const data = await body(request);
    await db.prepare("UPDATE agendamentos SET data_hora=?,status=? WHERE id=?")
      .bind(`${data.data} ${data.hora}:00`, data.status, integer(url.pathname.split("/").pop())).run();
    return json({ ok: true });
  }
  if (request.method === "GET" && url.pathname === "/api/os") return openOrder(db, url);
  if (request.method === "GET" && url.pathname === "/api/dashboard") return dashboard(db);
  if (["/api/movimentos", "/api/ajustes"].includes(url.pathname)) return finance(db, request, url);
  if (request.method === "GET" && /^\/api\/clientes\/\d+\/(historico|financeiro)$/.test(url.pathname))
    return clientSummary(db, url);
  return error("Rota não encontrada.", 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/")) return await api(request, env, url);
      return env.ASSETS.fetch(request);
    } catch (cause) {
      console.error(cause);
      return error(cause.message || "Erro interno.", 500);
    }
  }
};
