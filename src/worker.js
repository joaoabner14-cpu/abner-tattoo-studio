const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store, max-age=0",
      "pragma": "no-cache",
      "vary": "Cookie"
    }
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
const emailAddress = value => {
  const email = required(value, "e-mail de privacidade").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("Informe um e-mail de privacidade válido.");
  return email;
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

function saoPauloHour() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23"
  }).format(new Date());
}

function nthWeekday(year, month, weekday, occurrence) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const day = 1 + (7 + weekday - first.getUTCDay()) % 7 + (occurrence - 1) * 7;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function blackFriday(year) {
  const thanksgiving = nthWeekday(year, 11, 4, 4);
  const date = new Date(`${thanksgiving}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function marketingOpportunities() {
  const currentYear = Number(saoPauloDate().slice(0, 4));
  return [currentYear, currentYear + 1].flatMap(year => [
    { key: `${year}-mulher`, name: "Dia da Mulher", date: `${year}-03-08` },
    { key: `${year}-maes`, name: "Dia das Mães", date: nthWeekday(year, 5, 0, 2) },
    { key: `${year}-namorados`, name: "Dia dos Namorados", date: `${year}-06-12` },
    { key: `${year}-pais`, name: "Dia dos Pais", date: nthWeekday(year, 8, 0, 2) },
    { key: `${year}-cliente`, name: "Dia do Cliente", date: `${year}-09-15` },
    { key: `${year}-halloween`, name: "Halloween", date: `${year}-10-31` },
    { key: `${year}-black-friday`, name: "Black Friday", date: blackFriday(year) },
    { key: `${year}-natal`, name: "Natal", date: `${year}-12-25` },
    { key: `${year + 1}-ano-novo`, name: "Ano-Novo", date: `${year + 1}-01-01` }
  ]).filter((item, index, items) =>
    items.findIndex(candidate => candidate.key === item.key) === index);
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

async function dailyWhatsAppSummary(db, studioId, date = saoPauloDate()) {
  const tomorrow = addDays(date, 1);
  const { results: overdue } = await db.prepare(`
    SELECT c.nome,cr.numero_parcela,cr.valor_parcela,cr.data_vencimento
    FROM crediario cr
    JOIN financeiro f ON f.id=cr.id_financeiro
    JOIN clientes c ON c.id=f.id_cliente
    LEFT JOIN ordem_servico os ON os.id=f.id_os
    LEFT JOIN agendamentos a ON a.id=os.id_agendamento
    WHERE f.id_estudio=? AND cr.status IN ('Pendente','Atrasado')
      AND cr.data_vencimento<? AND (a.id IS NULL OR a.status<>'Cancelado')
    ORDER BY cr.data_vencimento,cr.numero_parcela
  `).bind(studioId, date).all();
  const { results: appointments } = await db.prepare(`
    SELECT a.id,a.data_hora,a.status,c.nome,c.telefone
    FROM agendamentos a JOIN clientes c ON c.id=a.id_cliente
    WHERE a.id_estudio=? AND substr(a.data_hora,1,10) IN (?,?)
      AND lower(a.status)<>'cancelado'
    ORDER BY a.data_hora
  `).bind(studioId, date, tomorrow).all();
  const todayAppointments = appointments.filter(item => item.data_hora.slice(0, 10) === date);
  const tomorrowAppointments = appointments.filter(item => item.data_hora.slice(0, 10) === tomorrow);
  const totalOverdue = overdue.reduce((sum, item) => sum + Number(item.valor_parcela || 0), 0);
  const lines = [
    `Resumo do estúdio · ${brDateTime(date)}`,
    "",
    `Parcelas atrasadas: ${overdue.length} · ${new Intl.NumberFormat("pt-BR", {
      style: "currency", currency: "BRL"
    }).format(totalOverdue)}`,
    `Agendamentos de hoje: ${todayAppointments.length}`,
    ...todayAppointments.map(item =>
      `• ${item.data_hora.slice(11, 16)} · ${item.nome}`),
    `Agendamentos de amanhã: ${tomorrowAppointments.length}`,
    ...tomorrowAppointments.map(item =>
      `• ${item.data_hora.slice(11, 16)} · ${item.nome}`)
  ];
  return {
    data: date, amanha: tomorrow, parcelas_atrasadas: overdue,
    agendamentos_hoje: todayAppointments, agendamentos_amanha: tomorrowAppointments,
    total_atrasado: totalOverdue, texto: lines.join("\n")
  };
}

async function sendDailyWhatsAppSummaries(env) {
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID ||
    !env.WHATSAPP_TEMPLATE_NAME) return;
  const date = saoPauloDate();
  const hour = saoPauloHour();
  const { results: studios } = await env.DB.prepare(`
    SELECT id,whatsapp_alertas FROM estudios
    WHERE ativo=1 AND alertas_whatsapp_ativos=1 AND whatsapp_alertas<>''
      AND substr(horario_resumo_whatsapp,1,2)=?
  `).bind(hour).all();
  for (const studio of studios) {
    const existing = await env.DB.prepare(`
      SELECT id FROM whatsapp_resumos WHERE id_estudio=? AND data_referencia=?
    `).bind(studio.id, date).first();
    if (existing) continue;
    const summary = await dailyWhatsAppSummary(env.DB, studio.id, date);
    const inserted = await env.DB.prepare(`
      INSERT INTO whatsapp_resumos
        (id_estudio,data_referencia,telefone,conteudo,status)
      VALUES(?,?,?,?,'Pendente')
    `).bind(studio.id, date, whatsappPhone(studio.whatsapp_alertas),
      summary.texto).run();
    try {
      const response = await fetch(
        `https://graph.facebook.com/v23.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: whatsappPhone(studio.whatsapp_alertas),
            type: "template",
            template: {
              name: env.WHATSAPP_TEMPLATE_NAME,
              language: { code: "pt_BR" },
              components: [{
                type: "body",
                parameters: [{ type: "text", text: summary.texto }]
              }]
            }
          })
        });
      const result = await response.text();
      await env.DB.prepare(`
        UPDATE whatsapp_resumos SET status=?,resposta=?,data_envio=CURRENT_TIMESTAMP
        WHERE id=?
      `).bind(response.ok ? "Enviado" : "Erro", result.slice(0, 2000),
        inserted.meta.last_row_id).run();
    } catch (cause) {
      await env.DB.prepare(`
        UPDATE whatsapp_resumos SET status='Erro',resposta=? WHERE id=?
      `).bind(String(cause.message || cause).slice(0, 2000),
        inserted.meta.last_row_id).run();
    }
  }
}

async function listAppointments(db, url, studioId, studioName, enabledModules) {
  const { results } = await db.prepare(`
    SELECT a.id, a.data_hora, a.status, c.nome, c.telefone,
      a.id_tatuador,u.nome tatuador,u.cor_agenda
    FROM agendamentos a JOIN clientes c ON c.id = a.id_cliente
    LEFT JOIN usuarios u ON u.id=a.id_tatuador AND u.id_estudio=a.id_estudio
    WHERE a.id_estudio=?
    ORDER BY a.data_hora
  `).bind(studioId).all();
  if (url.searchParams.get("tipo") !== "lista") {
    const { results: installments } = await db.prepare(`
      SELECT cr.id, cr.numero_parcela, cr.data_vencimento, cr.valor_parcela,
        (SELECT COUNT(*) FROM crediario total
          WHERE total.id_financeiro=cr.id_financeiro AND total.status<>'Cancelado') total_parcelas,
        c.nome, a.id id_agendamento
      FROM crediario cr
      JOIN financeiro f ON f.id=cr.id_financeiro
      JOIN clientes c ON c.id=f.id_cliente
      LEFT JOIN ordem_servico os ON os.id=f.id_os
      LEFT JOIN agendamentos a ON a.id=os.id_agendamento
      WHERE f.id_estudio=? AND cr.status IN ('Pendente','Atrasado')
        AND (a.id IS NULL OR a.status<>'Cancelado')
      ORDER BY cr.data_vencimento, cr.numero_parcela
    `).bind(studioId).all();
    const { results: marketing } = await db.prepare(`
      SELECT id,titulo,tipo,status,COALESCE(data_inicio,data_postagem) data_evento,
        data_fim
      FROM planejamento_marketing
      WHERE id_estudio=? AND COALESCE(data_inicio,data_postagem) IS NOT NULL
        AND status NOT IN ('Encerrado')
    `).bind(studioId).all();
    if (!enabledModules.has("financeiro")) installments.length = 0;
    if (!enabledModules.has("marketing")) marketing.length = 0;
    const appointments = results.filter(x => x.status.toLowerCase() !== "cancelado")
      .map(x => ({
        id: `agendamento-${x.id}`,
        title: `${x.nome}${x.tatuador ? ` · ${x.tatuador}` : ""}`,
        start: x.data_hora.replace(" ", "T"),
        backgroundColor: x.cor_agenda || "#735f3c",
        borderColor: x.cor_agenda || "#735f3c",
        extendedProps: {
          tipo: "agendamento", id_agendamento: x.id,
          id_tatuador: x.id_tatuador, tatuador: x.tatuador
        }
      }));
    const today = saoPauloDate();
    const payments = installments.map(x => {
      const overdue = x.data_vencimento < today;
      const color = overdue ? "#ef6262" : "#36b37e";
      return {
        id: `crediario-${x.id}`,
        title: `Crediário · ${x.nome} · Parcela ${x.numero_parcela}/${x.total_parcelas}`,
        start: x.data_vencimento,
        allDay: true,
        backgroundColor: color,
        borderColor: color,
        textColor: "#111214",
        extendedProps: {
          tipo: "crediario",
          id_agendamento: x.id_agendamento,
          valor: x.valor_parcela,
          parcela: x.numero_parcela,
          total_parcelas: x.total_parcelas,
          vencida: overdue
        }
      };
    });
    const marketingEvents = marketing.map(item => {
      const validEnd = item.data_fim && item.data_fim >= item.data_evento;
      return {
        id: `marketing-${item.id}`,
        title: `${item.tipo} · ${item.titulo}`,
        start: item.data_evento,
        // O FullCalendar usa uma data final exclusiva. O acréscimo mantém
        // visível também o último dia informado no planejamento.
        ...(validEnd ? { end: addDays(item.data_fim, 1) } : {}),
        allDay: true,
        backgroundColor: "#e6cf8a",
        borderColor: "#e6cf8a",
        textColor: "#282114",
        extendedProps: { tipo: "marketing", id_marketing: item.id }
      };
    });
    return json([...appointments, ...payments, ...marketingEvents]);
  }
  const today = saoPauloDate();
  const tomorrow = saoPauloDate(1);
  const grouped = {};
  for (const row of results.filter(x =>
    x.data_hora.slice(0, 10) >= today && x.status.toLowerCase() !== "cancelado"
  )) {
    const date = row.data_hora.slice(0, 10);
    const phone = row.telefone.replace(/\D/g, "");
    const message = encodeURIComponent(
      `Olá, ${row.nome}, tudo bem?

Você possui uma sessão de tatuagem agendada no ${studioName} dia *${brDateTime(row.data_hora)}*.

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
      tatuador: row.tatuador || "",
      status: row.status, cancelado: row.status.toLowerCase() === "cancelado",
      eh_amanha: date === tomorrow,
      link_whatsapp: `https://wa.me/55${phone}?text=${message}`
    });
  }
  return json(grouped);
}

async function clients(db, request, url, studioId) {
  if (request.method === "POST" && url.pathname === "/api/clientes") {
    const data = await body(request);
    const nome = required(data.nome, "nome");
    const telefone = required(data.telefone, "telefone");
    const cpf = String(data.cpf || "").replace(/\D/g, "") || null;
    const created = await db.prepare(`
      INSERT INTO clientes(id_estudio,nome,telefone,cidade,data_nascimento,instagram,cpf,rg,observacoes,status)
      VALUES(?,?,?,?,?,?,?,?,?,'Ativo')
    `).bind(studioId, nome, telefone, data.cidade || "", data.data_nascimento || null,
      data.instagram || "", cpf, data.rg || "", data.observacoes || "").run();
    return json({ ok: true, id: created.meta.last_row_id, nome }, 201);
  }
  if (request.method === "GET" && url.pathname === "/api/clientes") {
    const search = `%${url.searchParams.get("busca") || ""}%`;
    const listAll = url.searchParams.get("todos") === "1";
    const sql = `
      SELECT id,nome,telefone,instagram,cpf FROM clientes
      WHERE id_estudio=? AND (nome LIKE ? COLLATE NOCASE OR telefone LIKE ?
        OR instagram LIKE ? COLLATE NOCASE OR cpf LIKE ?)
      ORDER BY nome COLLATE NOCASE${listAll ? "" : " LIMIT 100"}
    `;
    const { results } = await db.prepare(sql)
      .bind(studioId, search, search, search, search).all();
    return json(results);
  }
  if (request.method === "GET" && /^\/api\/clientes\/\d+$/.test(url.pathname)) {
    const id = integer(url.pathname.split("/").pop());
    const client = await db.prepare("SELECT * FROM clientes WHERE id=? AND id_estudio=?")
      .bind(id, studioId).first();
    return client ? json(client) : error("Cliente não encontrado.", 404);
  }
  if (request.method === "PUT" && /^\/api\/clientes\/\d+$/.test(url.pathname)) {
    const id = integer(url.pathname.split("/").pop());
    const data = await body(request);
    const existing = await db.prepare(
      "SELECT observacoes FROM clientes WHERE id=? AND id_estudio=?"
    ).bind(id, studioId).first();
    if (!existing) return error("Cliente não encontrado.", 404);
    const statements = [db.prepare(`
      UPDATE clientes SET nome=?, telefone=?, cidade=?, instagram=?, cpf=?, rg=?,
        data_nascimento=?, observacoes=?,status=?,data_atualizacao=CURRENT_TIMESTAMP
        WHERE id=? AND id_estudio=?
    `).bind(required(data.nome, "nome"), data.telefone || "", data.cidade || "",
      data.instagram || "", String(data.cpf || "").replace(/\D/g, "") || null, data.rg || "", data.data_nascimento || null,
      data.observacoes || "", data.status || "Ativo", id, studioId)];
    if ((existing?.observacoes || "") !== (data.observacoes || "")) {
      statements.push(db.prepare(`
        INSERT INTO crm_eventos(id_estudio,id_cliente,tipo,descricao)
        VALUES(?,?,'Observação',?)
      `).bind(studioId, id, data.observacoes || "Observações removidas."));
    }
    await db.batch(statements);
    return json({ ok: true });
  }
  return null;
}

async function createAppointment(db, request, studioId, user) {
  const data = await body(request);
  const nome = required(data.nome, "nome");
  const telefone = required(data.telefone, "telefone");
  const date = required(data.data, "data");
  const time = required(data.hora, "hora");
  let tattooerId = integer(data.id_tatuador);
  if (!tattooerId && user.perfil_acesso === "TATUADOR") tattooerId = Number(user.id);
  if (tattooerId) {
    const tattooer = await db.prepare(`
      SELECT id FROM usuarios WHERE id=? AND id_estudio=? AND ativo=1
    `).bind(tattooerId, studioId).first();
    if (!tattooer) return error("Tatuador não encontrado neste estúdio.", 404);
    const conflict = await db.prepare(`
      SELECT id FROM agendamentos
      WHERE id_estudio=? AND id_tatuador=? AND data_hora=?
        AND status NOT IN ('Cancelado','Concluido')
      LIMIT 1
    `).bind(studioId, tattooerId, `${date} ${time}:00`).first();
    if (conflict) return error("Este profissional já possui um agendamento neste horário.");
  }
  let clientId = integer(data.id_cliente);
  if (clientId) {
    const selected = await db.prepare(
      "SELECT id FROM clientes WHERE id=? AND id_estudio=?"
    ).bind(clientId, studioId).first();
    if (!selected) return error("Cliente não encontrado.", 404);
  }
  if (!clientId) {
    const existing = await db.prepare(
      "SELECT id FROM clientes WHERE telefone=? AND id_estudio=? LIMIT 1"
    ).bind(telefone, studioId).first();
    if (existing) clientId = existing.id;
    else {
      const created = await db.prepare(
        "INSERT INTO clientes(id_estudio,nome,telefone,status) VALUES(?,?,?,'Ativo')"
      ).bind(studioId, nome, telefone).run();
      clientId = created.meta.last_row_id;
    }
  }
  const value = number(data.valor);
  const appointment = await db.prepare(`
    INSERT INTO agendamentos
      (id_estudio,id_cliente,id_tatuador,data_hora,valor_orcado)
    VALUES(?,?,?,?,?)
  `).bind(studioId, clientId, tattooerId || null, `${date} ${time}:00`, value).run();
  const appointmentId = appointment.meta.last_row_id;
  const order = await db.prepare(`
    INSERT INTO ordem_servico(id_estudio,id_cliente,id_agendamento,status,valor_tatuagem)
    VALUES(?,?,?,'Agendada',?)
  `).bind(studioId, clientId, appointmentId, value).run();
  await db.prepare(`
    INSERT INTO financeiro(id_estudio,id_cliente,id_os,valor_orcado,valor_sinal,valor_final,status)
    VALUES(?,?,?,?,?,?,'Pendente')
  `).bind(studioId, clientId, order.meta.last_row_id, value, number(data.sinal), value).run();
  return json({ ok: true, id: appointmentId }, 201);
}

async function openOrder(db, url, studioId, enabledModules) {
  const id = integer(url.searchParams.get("id"));
  const row = await db.prepare(`
    SELECT a.id id_agendamento, a.data_hora, a.status status_agendamento,a.faltou,
      a.id_tatuador,
      c.id id_cliente, c.nome, c.telefone, c.cidade, c.data_nascimento, c.instagram,
      c.cpf, c.rg, c.observacoes, c.status status_cliente, c.data_cadastro,
      EXISTS(SELECT 1 FROM crm_fotos_clientes fc
        WHERE fc.id_cliente=c.id) tem_foto_cliente,
      os.id id_os, os.status, os.descricao,
      f.id id_financeiro, f.valor_orcado, f.valor_sinal, f.valor_adicional,
      f.valor_desconto, f.valor_final, f.forma_pagamento, f.sinal_pago,
      f.data_pagamento_sinal
    FROM agendamentos a JOIN clientes c ON c.id=a.id_cliente
    LEFT JOIN ordem_servico os ON os.id_agendamento=a.id
    LEFT JOIN financeiro f ON f.id_os=os.id
    WHERE a.id=? AND a.id_estudio=? LIMIT 1
  `).bind(id, studioId).first();
  if (!row) return error("Agendamento não encontrado.", 404);
  const { results: installments } = await db.prepare(`
    SELECT cr.id, cr.numero_parcela, cr.data_vencimento, cr.data_pagamento,
      cr.valor_parcela, cr.status,
      (SELECT COUNT(*) FROM crediario total
        WHERE total.id_financeiro=cr.id_financeiro AND total.status<>'Cancelado') total_parcelas
    FROM crediario cr
    WHERE cr.id_financeiro=? AND cr.status<>'Cancelado' ORDER BY cr.numero_parcela
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
    SELECT id, id_crediario, tipo, valor, forma_pagamento, observacao,
      data_pagamento, data_movimento
    FROM financeiro_movimentos WHERE id_financeiro=?
    ORDER BY COALESCE(data_pagamento,data_movimento) DESC, id DESC
  `).bind(row.id_financeiro).all();
  const { results: adjustments } = await db.prepare(`
    SELECT id, tipo, valor, descricao, data_registro
    FROM financeiro_ajustes WHERE id_financeiro=? ORDER BY data_registro DESC, id DESC
  `).bind(row.id_financeiro).all();
  const response = { ...row, parcelas: installments, materiais: materials,
    batoques: cups.map(cup => ({
      ...cup, tintas: cupInks.filter(ink => ink.id_batoque === cup.id)
    })),
    movimentos: movements, ajustes: adjustments, total_pago: paid.total,
    saldo_aberto: Math.max(0, row.valor_final - paid.total) };
  if (!enabledModules.has("financeiro")) {
    for (const field of ["id_financeiro", "valor_orcado", "valor_sinal",
      "valor_adicional", "valor_desconto", "valor_final", "forma_pagamento",
      "sinal_pago", "data_pagamento_sinal"]) response[field] = null;
    response.parcelas = [];
    response.movimentos = [];
    response.ajustes = [];
    response.total_pago = null;
    response.saldo_aberto = null;
  }
  if (!enabledModules.has("estoque")) {
    response.materiais = [];
    response.batoques = [];
  }
  return json(response);
}

async function orderService(db, request, url, studioId) {
  const parts = url.pathname.split("/");
  const osId = integer(parts[3]);
  const order = await db.prepare(
    "SELECT id FROM ordem_servico WHERE id=? AND id_estudio=?"
  ).bind(osId, studioId).first();
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
      `SELECT id,quantidade_atual FROM estoque
       WHERE nome=? COLLATE NOCASE AND id_estudio=? LIMIT 1`
    ).bind(material, studioId).first();
    if (!stock) {
      const created = await db.prepare(`
        INSERT INTO estoque(id_estudio,nome,categoria,unidade,quantidade_atual,ativo)
        VALUES(?,?,'Material de tatuagem',?,0,1)
      `).bind(studioId, material, data.unidade || "un.").run();
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
          FROM estoque WHERE id=? AND id_estudio=? AND ativo=1 AND tipo_item='Tinta'
        `).bind(integer(entry.id_estoque), studioId).first();
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

async function stock(db, request, url, studioId) {
  const match = url.pathname.match(/^\/api\/estoque(?:\/(\d+))?(?:\/movimentos)?$/);
  if (!match) return null;
  const itemId = integer(match[1]);
  if (request.method === "GET" && url.pathname === "/api/estoque") {
    const search = `%${url.searchParams.get("busca") || ""}%`;
    const summary = await db.prepare(`
      SELECT COUNT(*) itens,
        COALESCE(SUM(CASE WHEN quantidade_atual<=quantidade_minima THEN 1 ELSE 0 END),0) baixos,
        COALESCE(SUM(quantidade_atual*valor_unitario),0) valor_total
      FROM estoque WHERE ativo=1 AND id_estudio=?
    `).bind(studioId).first();
    const { results: items } = await db.prepare(`
      SELECT id,nome,categoria,marca,unidade,quantidade_atual,quantidade_minima,
        valor_unitario,observacoes,tipo_item,cor,volume_embalagem_ml,ml_por_gota,
        lote,data_validade,validade_apos_aberto_dias,data_abertura,alerta_validade_dias
      FROM estoque WHERE ativo=1 AND id_estudio=? AND (nome LIKE ? COLLATE NOCASE
        OR categoria LIKE ? COLLATE NOCASE OR marca LIKE ? COLLATE NOCASE
        OR cor LIKE ? COLLATE NOCASE OR lote LIKE ? COLLATE NOCASE)
      ORDER BY nome LIMIT 100
    `).bind(studioId, search, search, search, search, search).all();
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
      WHERE e.id_estudio=?
      ORDER BY em.data_movimento DESC,em.id DESC LIMIT 100
    `).bind(studioId).all();
    return json({ resumo: summary, itens: inventory, alertas: alerts, historico: history });
  }
  if (request.method === "POST" && url.pathname === "/api/estoque") {
    const data = await body(request);
    const name = required(data.nome, "nome");
    const isInk = data.tipo_item === "Tinta";
    const existing = await db.prepare(
      `SELECT id FROM estoque WHERE nome=? COLLATE NOCASE AND ativo=1
       AND id_estudio=?
       AND (?='Material' OR COALESCE(lote,'')=COALESCE(?,'')) LIMIT 1`
    ).bind(name, studioId, isInk ? "Tinta" : "Material", data.lote || "").first();
    if (existing) return error(isInk
      ? "Já existe esta tinta com o mesmo número de lote."
      : "Já existe um material com este nome.");
    const quantity = number(data.quantidade_atual);
    const value = number(data.valor_unitario);
    const created = await db.prepare(`
      INSERT INTO estoque(id_estudio,nome,categoria,marca,unidade,quantidade_atual,
        quantidade_minima,valor_unitario,observacoes,ativo,tipo_item,cor,
        volume_embalagem_ml,ml_por_gota,lote,data_validade,
        validade_apos_aberto_dias,data_abertura,alerta_validade_dias)
      VALUES(?,?,?,?,?,?,?,?,?,1,?,?,?,?,?,?,?,?,?)
    `).bind(studioId, name, data.categoria || "", data.marca || "", data.unidade || "un.",
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
  const item = await db.prepare(
    "SELECT * FROM estoque WHERE id=? AND ativo=1 AND id_estudio=?"
  ).bind(itemId, studioId).first();
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

async function dashboard(db, studioId) {
  const today = saoPauloDate();
  const month = today.slice(0, 7);
  const { results: signals } = await db.prepare(`
    SELECT c.nome, f.valor_sinal valor, os.id id_os, a.id id_agendamento, a.data_hora
    FROM financeiro f JOIN clientes c ON c.id=f.id_cliente
    JOIN ordem_servico os ON os.id=f.id_os JOIN agendamentos a ON a.id=os.id_agendamento
    WHERE f.id_estudio=? AND f.sinal_pago=0 AND f.valor_sinal>0 AND a.status<>'Cancelado'
    ORDER BY a.data_hora
  `).bind(studioId).all();
  const { results: installments } = await db.prepare(`
    SELECT cr.id, cr.numero_parcela parcela, cr.valor_parcela valor,
      cr.data_vencimento vencimento,
      (SELECT COUNT(*) FROM crediario total
        WHERE total.id_financeiro=cr.id_financeiro AND total.status<>'Cancelado') total_parcelas,
      c.nome, c.telefone, a.id id_agendamento
    FROM crediario cr JOIN financeiro f ON f.id=cr.id_financeiro
    JOIN clientes c ON c.id=f.id_cliente
    LEFT JOIN ordem_servico os ON os.id=f.id_os
    LEFT JOIN agendamentos a ON a.id=os.id_agendamento
    WHERE f.id_estudio=? AND cr.status IN ('Pendente','Atrasado')
      AND (a.id IS NULL OR a.status<>'Cancelado')
    ORDER BY cr.data_vencimento
  `).bind(studioId).all();
  const late = installments.filter(x => x.vencimento < today);
    const cash = await db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN tipo='Entrada' AND substr(data_movimento,1,10)=? THEN valor ELSE 0 END),0) hoje,
        COALESCE(SUM(CASE WHEN tipo='Entrada' AND substr(data_movimento,1,7)=? THEN valor ELSE 0 END),0) mes
      FROM caixa WHERE status='Ativo' AND id_estudio=?
  `).bind(today, month, studioId).first();
  return json({
    resumo: {
      receber_hoje: cash.hoje,
      receber_mes: cash.mes,
      atrasado: late.reduce((sum, item) => sum + item.valor, 0)
    },
    sinais_pendentes: signals.map(x => ({ ...x, data_agendamento: brDateTime(x.data_hora) })),
    parcelas_atrasadas: late.map(item => {
      const message = encodeURIComponent(
        `Olá, ${item.nome}, tudo bem?\n\nIdentificamos que a parcela ${item.parcela}/${item.total_parcelas} do seu crediário, no valor de R$ ${Number(item.valor).toFixed(2).replace(".", ",")}, venceu em *${brDateTime(item.vencimento)}*.\n\nPor favor, entre em contato para regularizarmos o pagamento.`
      );
      return { ...item, link_whatsapp: `https://wa.me/${whatsappPhone(item.telefone)}?text=${message}` };
    })
  });
}

async function createInstallments(db, request, studioId) {
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
    WHERE f.id_os=? AND f.id_estudio=? GROUP BY f.id
  `).bind(idOs, studioId).first();
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

async function payInstallment(db, request, url, studioId) {
  const installmentId = integer(url.pathname.split("/")[3]);
  const installment = await db.prepare(`
    SELECT cr.id, cr.id_financeiro, cr.numero_parcela, cr.valor_parcela, cr.status,
      (SELECT COUNT(*) FROM crediario total
        WHERE total.id_financeiro=cr.id_financeiro AND total.status<>'Cancelado') total_parcelas,
      f.id_cliente, f.id_os
    FROM crediario cr JOIN financeiro f ON f.id=cr.id_financeiro
    WHERE cr.id=? AND f.id_estudio=?
  `).bind(installmentId, studioId).first();
  if (!installment) return error("Parcela não encontrada.", 404);
  if (installment.status === "Pago") return error("Esta parcela já foi paga.");
  if (installment.status === "Cancelado") return error("Esta parcela está cancelada.");
  const data = await body(request);
  const paymentDate = data.data_pagamento || saoPauloDate();
  const observation = data.observacao ||
    `Parcela ${installment.numero_parcela}/${installment.total_parcelas} do crediário`;
  await db.batch([
    db.prepare(`
      INSERT INTO financeiro_movimentos
        (id_financeiro,id_crediario,tipo,valor,forma_pagamento,observacao,data_pagamento)
      VALUES(?,?,'Pagamento',?,'Pix',?,?)
    `).bind(installment.id_financeiro, installment.id, installment.valor_parcela,
      observation, paymentDate),
    db.prepare(`
      INSERT INTO caixa(id_estudio,data_movimento,tipo,categoria,descricao,valor,id_cliente,id_financeiro,id_os,forma_pagamento)
      VALUES(?,?,'Entrada','Crediário',?,?,?,?,?,'Pix')
    `).bind(studioId, paymentDate, observation,
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

async function finance(db, request, url, studioId) {
  const osId = integer(url.searchParams.get("id_os"));
  if (request.method === "GET" && url.pathname === "/api/movimentos") {
    const { results } = await db.prepare(`
      SELECT fm.* FROM financeiro_movimentos fm JOIN financeiro f ON f.id=fm.id_financeiro
      WHERE f.id_os=? AND f.id_estudio=? ORDER BY fm.data_movimento DESC
    `).bind(osId, studioId).all();
    return json(results);
  }
  if (request.method === "GET" && url.pathname === "/api/ajustes") {
    const { results } = await db.prepare(`
      SELECT fa.* FROM financeiro_ajustes fa JOIN financeiro f ON f.id=fa.id_financeiro
      WHERE f.id_os=? AND f.id_estudio=? ORDER BY fa.data_registro DESC
    `).bind(osId, studioId).all();
    return json(results);
  }
  const data = await body(request);
  const idOs = integer(data.id_os);
  const f = await db.prepare(
    "SELECT id,id_cliente,valor_sinal FROM financeiro WHERE id_os=? AND id_estudio=?"
  ).bind(idOs, studioId).first();
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
        INSERT INTO caixa(id_estudio,data_movimento,tipo,categoria,descricao,valor,id_cliente,id_financeiro,id_os,forma_pagamento)
        VALUES(?,?,'Entrada',?,?,?,?,?,?,?)
      `).bind(studioId, availableDate, data.tipo, data.observacao || `${data.tipo} recebido`, value,
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

async function financialManagement(db, request, url, studioId) {
  const today = saoPauloDate();
  const month = /^\d{4}-\d{2}$/.test(url.searchParams.get("mes") || "")
    ? url.searchParams.get("mes") : today.slice(0, 7);
  const generalView = url.searchParams.get("visao") === "geral";
  const cashCancellation = url.pathname.match(/^\/api\/financeiro\/caixa\/(\d+)\/cancelar$/);
  if (request.method === "POST" && cashCancellation) {
    const cashId = integer(cashCancellation[1]);
    const entry = await db.prepare("SELECT * FROM caixa WHERE id=? AND id_estudio=?")
      .bind(cashId, studioId).first();
    if (!entry) return error("Lançamento não encontrado.", 404);
    if (entry.status === "Cancelado") return error("Este lançamento já foi cancelado.");
    const statements = [
      db.prepare("UPDATE caixa SET status='Cancelado' WHERE id=?").bind(cashId)
    ];
    if (entry.id_lancamento) {
      statements.push(db.prepare(
        "UPDATE gestao_financeira SET status='Cancelado' WHERE id=?"
      ).bind(entry.id_lancamento));
    }
    if (entry.tipo === "Entrada" && entry.id_financeiro) {
      const movement = await db.prepare(`
        SELECT id,id_crediario FROM financeiro_movimentos
        WHERE id_financeiro=? AND tipo IN ('Sinal','Pagamento')
          AND valor=? AND COALESCE(data_pagamento,substr(data_movimento,1,10))=?
        ORDER BY id DESC LIMIT 1
      `).bind(entry.id_financeiro, entry.valor, entry.data_movimento.slice(0, 10)).first();
      statements.push(
        db.prepare(`
          INSERT INTO financeiro_movimentos
            (id_financeiro,tipo,valor,forma_pagamento,observacao,data_pagamento)
          VALUES(?,'Estorno',?,?,?,?)
        `).bind(entry.id_financeiro, entry.valor, entry.forma_pagamento,
          `Cancelamento do lançamento #${cashId}`, today),
        db.prepare("UPDATE financeiro SET status='Pendente' WHERE id=?")
          .bind(entry.id_financeiro)
      );
      if (entry.categoria === "Sinal") {
        statements.push(db.prepare(`
          UPDATE financeiro SET sinal_pago=0,data_pagamento_sinal=NULL WHERE id=?
        `).bind(entry.id_financeiro));
      }
      if (movement?.id_crediario) {
        statements.push(db.prepare(`
          UPDATE crediario SET status='Pendente',data_pagamento=NULL WHERE id=?
        `).bind(movement.id_crediario));
      }
    }
    await db.batch(statements);
    return json({ ok: true });
  }
  const launchCancellation = url.pathname.match(/^\/api\/financeiro\/gestao\/(\d+)\/cancelar$/);
  if (request.method === "POST" && launchCancellation) {
    const launchId = integer(launchCancellation[1]);
    const launch = await db.prepare(
      "SELECT status FROM gestao_financeira WHERE id=? AND id_estudio=?"
    ).bind(launchId, studioId).first();
    if (!launch) return error("Lançamento não encontrado.", 404);
    if (launch.status === "Cancelado") return error("Este lançamento já foi cancelado.");
    await db.prepare("UPDATE gestao_financeira SET status='Cancelado' WHERE id=?")
      .bind(launchId).run();
    return json({ ok: true });
  }
  if (request.method === "GET" && url.pathname === "/api/financeiro/gestao") {
    const cash = await db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN tipo='Entrada' THEN valor ELSE 0 END),0) entradas,
        COALESCE(SUM(CASE WHEN tipo='Saida' THEN valor ELSE 0 END),0) saidas
      FROM caixa
      WHERE id_estudio=? AND status='Ativo' AND (?=1 OR substr(data_movimento,1,7)=?)
    `).bind(studioId, generalView ? 1 : 0, month).first();
    const annual = await db.prepare(`
      SELECT COALESCE(SUM(valor),0) faturamento
      FROM caixa WHERE id_estudio=? AND tipo='Entrada' AND substr(data_movimento,1,4)=?
        AND status='Ativo'
    `).bind(studioId, month.slice(0, 4)).first();
    const payable = await db.prepare(`
      SELECT COALESCE(SUM(valor),0) total FROM gestao_financeira
      WHERE id_estudio=? AND tipo IN ('Despesa','DAS') AND status='Pendente'
        AND (?=1 OR competencia=?)
    `).bind(studioId, generalView ? 1 : 0, month).first();
    const manualReceivable = await db.prepare(`
      SELECT COALESCE(SUM(valor),0) total FROM gestao_financeira
      WHERE id_estudio=? AND tipo='Receita' AND status='Pendente'
        AND (?=1 OR competencia=?)
    `).bind(studioId, generalView ? 1 : 0, month).first();
    const { results: clientReceivables } = await db.prepare(`
      SELECT f.id id_financeiro,f.id_os,a.id id_agendamento,c.nome,
        f.valor_final,a.data_hora,
        COALESCE((SELECT SUM(CASE WHEN fm.tipo IN ('Pagamento','Sinal') THEN fm.valor
          WHEN fm.tipo='Estorno' THEN -fm.valor ELSE 0 END)
          FROM financeiro_movimentos fm WHERE fm.id_financeiro=f.id),0) pago,
        EXISTS(SELECT 1 FROM crediario cr
          WHERE cr.id_financeiro=f.id AND cr.status<>'Cancelado') tem_crediario,
        COALESCE((SELECT SUM(cr.valor_parcela) FROM crediario cr
          WHERE cr.id_financeiro=f.id AND cr.status IN ('Pendente','Atrasado')
            AND (?=1 OR substr(cr.data_vencimento,1,7)=?)),0) parcelas_periodo
      FROM financeiro f
      JOIN clientes c ON c.id=f.id_cliente
      LEFT JOIN ordem_servico os ON os.id=f.id_os
      LEFT JOIN agendamentos a ON a.id=os.id_agendamento
      WHERE f.id_estudio=? AND f.status<>'Cancelado'
        AND (a.id IS NULL OR a.status<>'Cancelado')
      ORDER BY COALESCE(a.data_hora,f.data_criacao)
    `).bind(generalView ? 1 : 0, month, studioId).all();
    const monthlyClientReceivables = clientReceivables
      .map(item => ({
        ...item,
        saldo: item.tem_crediario
          ? Number(item.parcelas_periodo)
          : generalView || item.data_hora?.slice(0, 7) === month
            ? Math.max(0, item.valor_final - item.pago)
            : 0
      }))
      .filter(item => item.saldo > 0);
    const overdueBills = await db.prepare(`
      SELECT COALESCE(SUM(valor),0) total FROM gestao_financeira
      WHERE id_estudio=? AND status='Pendente' AND data_vencimento<?
    `).bind(studioId, today).first();
    const overdueCredit = await db.prepare(`
      SELECT COALESCE(SUM(cr.valor_parcela),0) total
      FROM crediario cr
      JOIN financeiro f ON f.id=cr.id_financeiro
      LEFT JOIN ordem_servico os ON os.id=f.id_os
      LEFT JOIN agendamentos a ON a.id=os.id_agendamento
      WHERE f.id_estudio=? AND cr.status IN ('Pendente','Atrasado') AND cr.data_vencimento<?
        AND (a.id IS NULL OR a.status<>'Cancelado')
    `).bind(studioId, today).first();
    const { results: overdueCredits } = await db.prepare(`
      SELECT cr.id,cr.numero_parcela,cr.valor_parcela valor,cr.data_vencimento,
        c.nome,f.id_os,a.id id_agendamento
      FROM crediario cr
      JOIN financeiro f ON f.id=cr.id_financeiro
      JOIN clientes c ON c.id=f.id_cliente
      LEFT JOIN ordem_servico os ON os.id=f.id_os
      LEFT JOIN agendamentos a ON a.id=os.id_agendamento
      WHERE f.id_estudio=? AND cr.status IN ('Pendente','Atrasado') AND cr.data_vencimento<?
        AND (a.id IS NULL OR a.status<>'Cancelado')
      ORDER BY cr.data_vencimento
    `).bind(studioId, today).all();
    const { results: launches } = await db.prepare(`
      SELECT * FROM gestao_financeira
      WHERE id_estudio=? AND (status='Pendente' OR competencia=?)
      ORDER BY CASE WHEN status='Pendente' THEN 0 ELSE 1 END,
        COALESCE(data_vencimento,data_pagamento,data_criacao) DESC,id DESC LIMIT 150
    `).bind(studioId, month).all();
    const { results: cashHistory } = await db.prepare(`
      SELECT cx.id,cx.data_movimento,cx.tipo,cx.categoria,cx.descricao,cx.valor,
        cx.forma_pagamento,c.nome cliente,cx.id_os,os.id_agendamento
      FROM caixa cx LEFT JOIN clientes c ON c.id=cx.id_cliente
      LEFT JOIN ordem_servico os ON os.id=cx.id_os
      WHERE cx.id_estudio=? AND cx.status='Ativo'
        AND (?=1 OR substr(cx.data_movimento,1,7)=?)
      ORDER BY cx.data_movimento DESC,cx.id DESC LIMIT 150
    `).bind(studioId, generalView ? 1 : 0, month).all();
    const { results: expenseCategories } = await db.prepare(`
      SELECT categoria,SUM(valor) total FROM gestao_financeira
      WHERE id_estudio=? AND tipo IN ('Despesa','DAS') AND status='Pago' AND competencia=?
      GROUP BY categoria ORDER BY total DESC
    `).bind(studioId, month).all();
    const { results: monthlyRevenue } = await db.prepare(`
      SELECT substr(data_movimento,1,7) mes,SUM(valor) total FROM caixa
      WHERE id_estudio=? AND tipo='Entrada' AND substr(data_movimento,1,4)=?
        AND status='Ativo'
      GROUP BY mes ORDER BY mes
    `).bind(studioId, month.slice(0, 4)).all();
    return json({
      periodo: month,
      visao: generalView ? "geral" : "mensal",
      resumo: {
        entradas: cash.entradas, saidas: cash.saidas,
        resultado: cash.entradas - cash.saidas,
        receber: manualReceivable.total +
          monthlyClientReceivables.reduce((sum, item) => sum + item.saldo, 0),
        pagar: payable.total,
        atrasado: overdueBills.total + overdueCredit.total,
        faturamento_anual: annual.faturamento,
        limite_mei: 81000
      },
      lancamentos: launches, caixa: cashHistory,
      recebiveis_clientes: monthlyClientReceivables,
      crediarios_atrasados: overdueCredits,
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
        `SELECT id FROM gestao_financeira
         WHERE id_estudio=? AND tipo='DAS' AND competencia=? AND status<>'Cancelado'`
      ).bind(studioId, competence).first();
      if (existing) return error("O DAS desta competência já está cadastrado.");
    }
    const paid = data.status === "Pago";
    const paymentDate = paid ? (data.data_pagamento || today) : null;
    const created = await db.prepare(`
      INSERT INTO gestao_financeira(id_estudio,tipo,categoria,descricao,valor,competencia,
        data_vencimento,data_pagamento,forma_pagamento,status,nota_fiscal,documento,observacoes)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(studioId, type, data.categoria || (type === "DAS" ? "Impostos" : "Outros"),
      required(data.descricao, "descrição"), value, competence,
      data.data_vencimento || null, paymentDate, data.forma_pagamento || null,
      paid ? "Pago" : "Pendente", data.nota_fiscal ? 1 : 0,
      data.documento || "", data.observacoes || "").run();
    if (paid) {
      await db.prepare(`
        INSERT INTO caixa(id_estudio,data_movimento,tipo,categoria,descricao,valor,
          forma_pagamento,id_lancamento)
        VALUES(?,?,?,?,?,?,?,?)
      `).bind(studioId, paymentDate, type === "Receita" ? "Entrada" : "Saida",
        data.categoria || (type === "DAS" ? "Impostos" : "Outros"),
        data.descricao, value, data.forma_pagamento || "Pix", created.meta.last_row_id).run();
    }
    return json({ ok: true, id: created.meta.last_row_id }, 201);
  }
  const match = url.pathname.match(/^\/api\/financeiro\/gestao\/(\d+)\/pagar$/);
  if (request.method === "POST" && match) {
    const data = await body(request);
    const launch = await db.prepare(
      "SELECT * FROM gestao_financeira WHERE id=? AND id_estudio=?"
    ).bind(integer(match[1]), studioId).first();
    if (!launch) return error("Lançamento não encontrado.", 404);
    if (launch.status !== "Pendente") return error("Este lançamento não está pendente.");
    const paymentDate = data.data_pagamento || today;
    const paymentMethod = data.forma_pagamento || "Pix";
    await db.batch([
      db.prepare(`
        UPDATE gestao_financeira SET status='Pago',data_pagamento=?,forma_pagamento=? WHERE id=?
      `).bind(paymentDate, paymentMethod, launch.id),
      db.prepare(`
        INSERT INTO caixa(id_estudio,data_movimento,tipo,categoria,descricao,valor,
          forma_pagamento,id_lancamento)
        VALUES(?,?,?,?,?,?,?,?)
      `).bind(studioId, paymentDate, launch.tipo === "Receita" ? "Entrada" : "Saida",
        launch.categoria, launch.descricao, launch.valor, paymentMethod, launch.id)
    ]);
    return json({ ok: true });
  }
  return null;
}

async function clientSummary(db, url, studioId) {
  const id = integer(url.pathname.split("/")[3]);
  if (url.pathname.endsWith("/financeiro")) {
    const totals = await db.prepare(`
      SELECT COALESCE(SUM(f.valor_final),0) orcado,
      COALESCE(SUM((SELECT SUM(CASE WHEN fm.tipo IN ('Pagamento','Sinal') THEN fm.valor ELSE 0 END)
        FROM financeiro_movimentos fm WHERE fm.id_financeiro=f.id)),0) pago,
      COALESCE(SUM((SELECT SUM(CASE WHEN fm.tipo='Estorno' THEN fm.valor ELSE 0 END)
        FROM financeiro_movimentos fm WHERE fm.id_financeiro=f.id)),0) estornado
      FROM financeiro f
      LEFT JOIN ordem_servico os ON os.id=f.id_os
      LEFT JOIN agendamentos a ON a.id=os.id_agendamento
      WHERE f.id_cliente=? AND f.id_estudio=?
        AND (a.id IS NULL OR a.status<>'Cancelado')
    `).bind(id, studioId).first();
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
      WHERE f.id_cliente=? AND f.id_estudio=?
        AND (a.id IS NULL OR a.status<>'Cancelado')
      ORDER BY COALESCE(a.data_hora,f.data_criacao) DESC
    `).bind(id, studioId).all();
    const { results: movements } = await db.prepare(`
      SELECT fm.id, fm.tipo, fm.valor, fm.forma_pagamento, fm.data_pagamento,
        fm.observacao, f.id_os
      FROM financeiro_movimentos fm JOIN financeiro f ON f.id=fm.id_financeiro
      WHERE f.id_cliente=? AND f.id_estudio=?
      ORDER BY COALESCE(fm.data_pagamento,fm.data_movimento) DESC
    `).bind(id, studioId).all();
    const { results: installments } = await db.prepare(`
      SELECT cr.id, cr.numero_parcela, cr.data_vencimento, cr.data_pagamento,
        cr.valor_parcela, cr.status,
        (SELECT COUNT(*) FROM crediario total
          WHERE total.id_financeiro=cr.id_financeiro AND total.status<>'Cancelado') total_parcelas,
        f.id_os, a.id id_agendamento
      FROM crediario cr JOIN financeiro f ON f.id=cr.id_financeiro
      LEFT JOIN ordem_servico os ON os.id=f.id_os
      LEFT JOIN agendamentos a ON a.id=os.id_agendamento
      WHERE f.id_cliente=? AND f.id_estudio=? AND cr.status<>'Cancelado'
        AND (a.id IS NULL OR a.status<>'Cancelado')
      ORDER BY cr.data_vencimento DESC
    `).bind(id, studioId).all();
    const { results: adjustments } = await db.prepare(`
      SELECT fa.id, fa.tipo, fa.valor, fa.descricao, fa.data_registro, f.id_os
      FROM financeiro_ajustes fa JOIN financeiro f ON f.id=fa.id_financeiro
      WHERE f.id_cliente=? AND f.id_estudio=? ORDER BY fa.data_registro DESC
    `).bind(id, studioId).all();
    return json({ ...totals, ordens: orders, movimentos: movements,
      crediarios: installments, ajustes: adjustments });
  }
  const { results: orders } = await db.prepare(`
    SELECT os.id id_os, a.id id_agendamento, a.data_hora,
      CASE a.status
        WHEN 'Agendado' THEN 'Agendada'
        WHEN 'Confirmado' THEN 'Confirmada'
        WHEN 'Concluido' THEN 'Finalizada'
        WHEN 'Cancelado' THEN 'Cancelada'
        WHEN 'Remarcado' THEN 'Remarcada'
        ELSE os.status
      END status,
      os.descricao, f.valor_final
    FROM ordem_servico os
    LEFT JOIN agendamentos a ON a.id=os.id_agendamento
    LEFT JOIN financeiro f ON f.id_os=os.id
    WHERE os.id_cliente=? AND os.id_estudio=?
    ORDER BY COALESCE(a.data_hora,os.data_criacao) DESC
  `).bind(id, studioId).all();
  const { results: materials } = await db.prepare(`
    SELECT oc.id_os, e.nome material, oc.quantidade, oc.unidade
    FROM os_consumo oc JOIN estoque e ON e.id=oc.id_estoque
    JOIN ordem_servico os ON os.id=oc.id_os
    WHERE os.id_cliente=? AND os.id_estudio=?
    ORDER BY oc.id
  `).bind(id, studioId).all();
  return json(orders.map(order => ({
    ...order, materiais: materials.filter(item => item.id_os === order.id_os)
  })));
}

async function clientCrm(db, id, studioId, enabledModules) {
  const client = await db.prepare(`
    SELECT c.*,EXISTS(SELECT 1 FROM crm_fotos_clientes fc
      WHERE fc.id_cliente=c.id) tem_foto
    FROM clientes c WHERE c.id=? AND c.id_estudio=?
  `).bind(id, studioId).first();
  if (!client) return error("Cliente não encontrado.", 404);
  const { results: appointments } = await db.prepare(`
    SELECT id,data_hora,valor_orcado,status,faltou,observacoes,data_criacao
    FROM agendamentos WHERE id_cliente=? AND id_estudio=? ORDER BY data_hora DESC
  `).bind(id, studioId).all();
  const { results: orders } = await db.prepare(`
    SELECT os.id id_os,os.id_agendamento,os.descricao,os.regiao_corpo,
      os.tempo_sessao_minutos,os.status status_os,os.data_execucao,os.data_criacao,
      a.data_hora,a.status status_agendamento,a.faltou,
      f.valor_final,COALESCE((SELECT SUM(CASE
        WHEN fm.tipo IN ('Pagamento','Sinal') THEN fm.valor
        WHEN fm.tipo='Estorno' THEN -fm.valor ELSE 0 END)
        FROM financeiro_movimentos fm WHERE fm.id_financeiro=f.id),0) pago,
      EXISTS(SELECT 1 FROM crm_fotos_tatuagens ft WHERE ft.id_os=os.id) tem_foto
    FROM ordem_servico os
    LEFT JOIN agendamentos a ON a.id=os.id_agendamento
    LEFT JOIN financeiro f ON f.id_os=os.id
    WHERE os.id_cliente=? AND os.id_estudio=?
    ORDER BY COALESCE(a.data_hora,os.data_criacao) DESC
  `).bind(id, studioId).all();
  const { results: payments } = await db.prepare(`
    SELECT fm.id,fm.tipo,fm.valor,fm.forma_pagamento,fm.observacao,
      COALESCE(fm.data_pagamento,fm.data_movimento) data_evento,f.id_os
    FROM financeiro_movimentos fm
    JOIN financeiro f ON f.id=fm.id_financeiro
    WHERE f.id_cliente=? AND f.id_estudio=?
    ORDER BY COALESCE(fm.data_pagamento,fm.data_movimento) DESC
  `).bind(id, studioId).all();
  const { results: installments } = await db.prepare(`
    SELECT cr.id,cr.numero_parcela,cr.data_vencimento,cr.valor_parcela,cr.status,
      (SELECT COUNT(*) FROM crediario total
        WHERE total.id_financeiro=cr.id_financeiro
          AND total.status<>'Cancelado') total_parcelas,
      f.id_os,a.id id_agendamento
    FROM crediario cr
    JOIN financeiro f ON f.id=cr.id_financeiro
    LEFT JOIN ordem_servico os ON os.id=f.id_os
    LEFT JOIN agendamentos a ON a.id=os.id_agendamento
    WHERE f.id_cliente=? AND f.id_estudio=?
      AND cr.status IN ('Pendente','Atrasado')
      AND (a.id IS NULL OR a.status<>'Cancelado')
    ORDER BY cr.data_vencimento,cr.numero_parcela
  `).bind(id, studioId).all();
  const { results: customEvents } = await db.prepare(`
    SELECT id,tipo,descricao,data_evento,id_os,id_agendamento
    FROM crm_eventos WHERE id_cliente=? AND id_estudio=? ORDER BY data_evento DESC
  `).bind(id, studioId).all();
  if (!enabledModules.has("agenda")) {
    appointments.length = 0;
    for (const order of orders) {
      order.data_hora = null;
      order.status_agendamento = null;
      order.faltou = 0;
    }
  }
  if (!enabledModules.has("financeiro")) {
    payments.length = 0;
    installments.length = 0;
    for (const order of orders) {
      order.valor_final = null;
      order.pago = 0;
    }
  }
  const spent = payments.reduce((sum, item) =>
    sum + (["Pagamento", "Sinal"].includes(item.tipo) ? Number(item.valor)
      : item.tipo === "Estorno" ? -Number(item.valor) : 0), 0);
  const completedOrders = orders.filter(item => item.status_agendamento === "Concluido");
  const pending = orders.reduce((sum, item) =>
    sum + (item.status_agendamento === "Cancelado" ? 0
      : Math.max(0, Number(item.valor_final || 0) - Number(item.pago || 0))), 0);
  const today = saoPauloDate();
  const future = appointments.filter(item =>
    item.data_hora.slice(0, 10) >= today &&
    !["Cancelado", "Concluido"].includes(item.status) && !item.faltou)
    .sort((a, b) => a.data_hora.localeCompare(b.data_hora));
  const visits = appointments.filter(item => item.status === "Concluido")
    .sort((a, b) => b.data_hora.localeCompare(a.data_hora));
  const lastVisit = visits[0]?.data_hora || null;
  const daysSinceVisit = lastVisit
    ? Math.floor((Date.parse(`${today}T12:00:00Z`) -
      Date.parse(`${lastVisit.slice(0, 10)}T12:00:00Z`)) / 86400000) : null;
  const age = client.data_nascimento
    ? Math.floor((Date.parse(`${today}T12:00:00Z`) -
      Date.parse(`${client.data_nascimento}T12:00:00Z`)) / 31557600000) : null;
  const timeline = [
    { tipo: "Cadastro", descricao: "Cliente cadastrado.", data_evento: client.data_cadastro },
    ...appointments.map(item => ({
      tipo: item.faltou ? "Falta" : item.status === "Cancelado" ? "Cancelamento" : "Agendamento",
      descricao: `${item.status}: ${brDateTime(item.data_hora)}`,
      data_evento: item.data_hora, id_agendamento: item.id
    })),
    ...orders.map(item => ({
      tipo: item.status_agendamento === "Concluido" ? "Sessão concluída" : "Ordem de serviço",
      descricao: `OS #${item.id_os}${item.descricao ? ` · ${item.descricao}` : ""}`,
      data_evento: item.data_hora || item.data_criacao,
      id_os: item.id_os, id_agendamento: item.id_agendamento
    })),
    ...payments.map(item => ({
      tipo: item.tipo, descricao: `${moneyText(item.valor)}${item.observacao ? ` · ${item.observacao}` : ""}`,
      data_evento: item.data_evento, id_os: item.id_os
    })),
    ...customEvents
  ].sort((a, b) => String(b.data_evento).localeCompare(String(a.data_evento)));
  const alerts = [];
  if (daysSinceVisit !== null && daysSinceVisit > 180)
    alerts.push(`Cliente está há ${daysSinceVisit} dias sem tatuar.`);
  if (client.data_nascimento?.slice(5, 7) === today.slice(5, 7))
    alerts.push("Cliente faz aniversário neste mês.");
  if (pending > 0) alerts.push(`Cliente possui ${moneyText(pending)} pendente.`);
  if (future[0]?.data_hora.slice(0, 10) === saoPauloDate(1))
    alerts.push("Cliente possui agendamento para amanhã.");
  if (visits.some((visit, index) => {
    const previousVisit = visits[index + 1];
    return previousVisit && (Date.parse(visit.data_hora) -
      Date.parse(previousVisit.data_hora)) / 86400000 > 180;
  })) alerts.push("Cliente retornou após um longo período sem visitar o estúdio.");
  const unanswered = orders.some(item => !item.pago && item.status_agendamento === "Agendado");
  if (unanswered) alerts.push("Cliente possui orçamento sem pagamento ou resposta registrada.");
  if (spent > 0) {
    const ranking = await db.prepare(`
      SELECT COUNT(*) melhores FROM (
        SELECT f.id_cliente,SUM(CASE WHEN fm.tipo IN ('Pagamento','Sinal') THEN fm.valor
          WHEN fm.tipo='Estorno' THEN -fm.valor ELSE 0 END) total
        FROM financeiro_movimentos fm JOIN financeiro f ON f.id=fm.id_financeiro
        WHERE f.id_estudio=?
        GROUP BY f.id_cliente HAVING total>?
      )
    `).bind(studioId, spent).first();
    if (Number(ranking.melhores) < 3) alerts.push("Cliente está entre os melhores clientes do estúdio.");
  }
  return json({
    cliente: { ...client, idade: age },
    indicadores: {
      total_gasto: spent, tatuagens: completedOrders.length,
      ticket_medio: completedOrders.length ? spent / completedOrders.length : 0,
      pendente: pending, ultima_visita: lastVisit,
      proximo_agendamento: future[0]?.data_hora || null,
      dias_sem_visita: daysSinceVisit,
      cancelamentos: appointments.filter(item => item.status === "Cancelado" && !item.faltou).length,
      faltas: appointments.filter(item => item.faltou).length,
      ultimo_pagamento: payments.find(item => ["Pagamento", "Sinal"].includes(item.tipo))?.data_evento || null
    },
    ordens: orders, agendamentos: appointments, pagamentos: payments,
    crediarios: installments,
    alertas: alerts, timeline
  });
}

async function clientPrivacy(db, request, url, studioId, userId) {
  const match = url.pathname.match(
    /^\/api\/clientes\/(\d+)\/lgpd(?:\/(exportar|solicitacoes)(?:\/(\d+))?)?$/
  );
  if (!match) return null;
  const clientId = integer(match[1]);
  const action = match[2] || "";
  const requestId = integer(match[3]);
  const client = await db.prepare(
    "SELECT * FROM clientes WHERE id=? AND id_estudio=?"
  ).bind(clientId, studioId).first();
  if (!client) return error("Cliente não encontrado.", 404);

  if (request.method === "GET" && action === "exportar") {
    const { results: appointments } = await db.prepare(`
      SELECT data_hora,valor_orcado,status,faltou,observacoes,data_criacao
      FROM agendamentos WHERE id_cliente=? AND id_estudio=? ORDER BY data_hora
    `).bind(clientId, studioId).all();
    const { results: orders } = await db.prepare(`
      SELECT os.id,os.descricao,os.regiao_corpo,os.tempo_sessao_minutos,
        os.status,os.valor_tatuagem,os.data_execucao,os.data_criacao
      FROM ordem_servico os WHERE os.id_cliente=? AND os.id_estudio=?
      ORDER BY os.data_criacao
    `).bind(clientId, studioId).all();
    const { results: financial } = await db.prepare(`
      SELECT f.id_os,f.valor_orcado,f.valor_sinal,f.valor_adicional,
        f.valor_desconto,f.valor_final,f.forma_pagamento,f.status,f.data_criacao
      FROM financeiro f WHERE f.id_cliente=? AND f.id_estudio=?
      ORDER BY f.data_criacao
    `).bind(clientId, studioId).all();
    const { results: payments } = await db.prepare(`
      SELECT fm.tipo,fm.valor,fm.forma_pagamento,fm.observacao,
        fm.data_pagamento,fm.data_movimento,f.id_os
      FROM financeiro_movimentos fm
      JOIN financeiro f ON f.id=fm.id_financeiro
      WHERE f.id_cliente=? AND f.id_estudio=?
      ORDER BY COALESCE(fm.data_pagamento,fm.data_movimento)
    `).bind(clientId, studioId).all();
    const { results: installments } = await db.prepare(`
      SELECT cr.numero_parcela,cr.data_vencimento,cr.data_pagamento,
        cr.valor_parcela,cr.status,f.id_os
      FROM crediario cr JOIN financeiro f ON f.id=cr.id_financeiro
      WHERE f.id_cliente=? AND f.id_estudio=? ORDER BY cr.data_vencimento
    `).bind(clientId, studioId).all();
    const privacy = await db.prepare(
      "SELECT * FROM lgpd_clientes WHERE id_cliente=? AND id_estudio=?"
    ).bind(clientId, studioId).first();
    const { results: requests } = await db.prepare(`
      SELECT tipo,descricao,status,observacao_interna,data_solicitacao,data_conclusao
      FROM lgpd_solicitacoes WHERE id_cliente=? AND id_estudio=?
      ORDER BY data_solicitacao
    `).bind(clientId, studioId).all();
    await db.prepare(`
      INSERT INTO lgpd_historico(id_estudio,id_cliente,id_usuario,tipo,descricao)
      VALUES(?,?,?,'Exportacao','Dados do cliente exportados em formato JSON.')
    `).bind(studioId, clientId, userId).run();
    const { results: privacyHistory } = await db.prepare(`
      SELECT lh.tipo,lh.descricao,lh.data_evento,u.nome usuario
      FROM lgpd_historico lh LEFT JOIN usuarios u ON u.id=lh.id_usuario
      WHERE lh.id_cliente=? AND lh.id_estudio=? ORDER BY lh.data_evento,lh.id
    `).bind(clientId, studioId).all();
    const studio = await db.prepare(`
      SELECT nome_estudio,cnpj,email_privacidade,versao_aviso_privacidade,
        prazo_retencao_anos
      FROM estudios WHERE id=?
    `).bind(studioId).first();
    const { id_estudio, historico_tatuagens, historico_financeiro, ...personalData } = client;
    return json({
      exportado_em: new Date().toISOString(), controlador: studio,
      titular: personalData, privacidade: privacy || {
        base_cadastro: "Execucao de contrato", aceita_marketing: 0,
        autoriza_fotos_divulgacao: 0,
        versao_aviso: studio?.versao_aviso_privacidade || "1.0"
      },
      agendamentos: appointments, ordens_servico: orders,
      financeiro: financial, pagamentos: payments, crediario: installments,
      solicitacoes_privacidade: requests, registros_privacidade: privacyHistory
    });
  }

  if (request.method === "GET" && !action) {
    const privacy = await db.prepare(`
      SELECT lc.*,um.nome usuario_marketing,uf.nome usuario_fotos
      FROM lgpd_clientes lc
      LEFT JOIN usuarios um ON um.id=lc.id_usuario_marketing
      LEFT JOIN usuarios uf ON uf.id=lc.id_usuario_fotos
      WHERE lc.id_cliente=? AND lc.id_estudio=?
    `).bind(clientId, studioId).first();
    const { results: requests } = await db.prepare(`
      SELECT * FROM lgpd_solicitacoes
      WHERE id_cliente=? AND id_estudio=? ORDER BY data_solicitacao DESC
    `).bind(clientId, studioId).all();
    const { results: history } = await db.prepare(`
      SELECT lh.*,u.nome usuario
      FROM lgpd_historico lh LEFT JOIN usuarios u ON u.id=lh.id_usuario
      WHERE lh.id_cliente=? AND lh.id_estudio=?
      ORDER BY lh.data_evento DESC,lh.id DESC
    `).bind(clientId, studioId).all();
    const studio = await db.prepare(`
      SELECT versao_aviso_privacidade,prazo_retencao_anos
      FROM estudios WHERE id=?
    `).bind(studioId).first();
    return json({
      configuracao: privacy || {
        base_cadastro: "Execucao de contrato", aceita_marketing: 0,
        autoriza_fotos_divulgacao: 0,
        versao_aviso: studio?.versao_aviso_privacidade || "1.0"
      },
      solicitacoes: requests, historico: history, estudio: studio
    });
  }

  if (request.method === "PUT" && !action) {
    const data = await body(request);
    const marketing = data.aceita_marketing === true || data.aceita_marketing === 1 ||
      data.aceita_marketing === "1";
    const photos = data.autoriza_fotos_divulgacao === true ||
      data.autoriza_fotos_divulgacao === 1 ||
      data.autoriza_fotos_divulgacao === "1";
    const previous = await db.prepare(
      "SELECT * FROM lgpd_clientes WHERE id_cliente=? AND id_estudio=?"
    ).bind(clientId, studioId).first();
    const now = new Date().toISOString();
    const marketingChanged = Boolean(previous?.aceita_marketing) !== marketing;
    const photosChanged = Boolean(previous?.autoriza_fotos_divulgacao) !== photos;
    const statements = [db.prepare(`
      INSERT INTO lgpd_clientes
        (id_cliente,id_estudio,base_cadastro,aceita_marketing,
          data_consentimento_marketing,data_revogacao_marketing,id_usuario_marketing,
          autoriza_fotos_divulgacao,data_consentimento_fotos,data_revogacao_fotos,
          id_usuario_fotos,versao_aviso)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id_cliente) DO UPDATE SET
        base_cadastro=excluded.base_cadastro,
        aceita_marketing=excluded.aceita_marketing,
        data_consentimento_marketing=excluded.data_consentimento_marketing,
        data_revogacao_marketing=excluded.data_revogacao_marketing,
        id_usuario_marketing=excluded.id_usuario_marketing,
        autoriza_fotos_divulgacao=excluded.autoriza_fotos_divulgacao,
        data_consentimento_fotos=excluded.data_consentimento_fotos,
        data_revogacao_fotos=excluded.data_revogacao_fotos,
        id_usuario_fotos=excluded.id_usuario_fotos,
        versao_aviso=excluded.versao_aviso,data_atualizacao=CURRENT_TIMESTAMP
    `).bind(clientId, studioId, data.base_cadastro || "Execucao de contrato",
      marketing ? 1 : 0,
      marketing ? (marketingChanged ? now : previous?.data_consentimento_marketing || now) : null,
      marketing ? null : (marketingChanged ? now : previous?.data_revogacao_marketing || null),
      marketingChanged ? userId : previous?.id_usuario_marketing || null,
      photos ? 1 : 0,
      photos ? (photosChanged ? now : previous?.data_consentimento_fotos || now) : null,
      photos ? null : (photosChanged ? now : previous?.data_revogacao_fotos || null),
      photosChanged ? userId : previous?.id_usuario_fotos || null,
      data.versao_aviso || "1.0")];
    if (marketingChanged) statements.push(db.prepare(`
      INSERT INTO lgpd_historico(id_estudio,id_cliente,id_usuario,tipo,descricao)
      VALUES(?,?,?,'Consentimento marketing',?)
    `).bind(studioId, clientId, userId,
      marketing ? "Recebimento de mensagens promocionais autorizado."
        : "Recebimento de mensagens promocionais revogado."));
    if (photosChanged) statements.push(db.prepare(`
      INSERT INTO lgpd_historico(id_estudio,id_cliente,id_usuario,tipo,descricao)
      VALUES(?,?,?,'Consentimento fotos',?)
    `).bind(studioId, clientId, userId,
      photos ? "Uso de fotos da tatuagem para divulgação autorizado."
        : "Uso de fotos da tatuagem para divulgação revogado."));
    await db.batch(statements);
    return json({ ok: true });
  }

  if (request.method === "POST" && action === "solicitacoes") {
    const data = await body(request);
    const allowed = [
      "Acesso", "Correcao", "Exclusao",
      "Revogacao de consentimento", "Portabilidade", "Outro"
    ];
    if (!allowed.includes(data.tipo)) return error("Tipo de solicitação inválido.");
    const created = await db.prepare(`
      INSERT INTO lgpd_solicitacoes(id_estudio,id_cliente,tipo,descricao)
      VALUES(?,?,?,?)
    `).bind(studioId, clientId, data.tipo, data.descricao || "").run();
    await db.prepare(`
      INSERT INTO lgpd_historico(id_estudio,id_cliente,id_usuario,tipo,descricao)
      VALUES(?,?,?,'Solicitacao criada',?)
    `).bind(studioId, clientId, userId,
      `${data.tipo}: ${data.descricao || "Sem descrição."}`).run();
    return json({ ok: true, id: created.meta.last_row_id }, 201);
  }

  if (request.method === "PUT" && action === "solicitacoes" && requestId) {
    const data = await body(request);
    const allowed = ["Pendente", "Em andamento", "Concluida", "Recusada"];
    if (!allowed.includes(data.status)) return error("Status inválido.");
    const result = await db.prepare(`
      UPDATE lgpd_solicitacoes SET status=?,observacao_interna=?,
        data_conclusao=CASE WHEN ? IN ('Concluida','Recusada')
          THEN COALESCE(data_conclusao,CURRENT_TIMESTAMP) ELSE NULL END
      WHERE id=? AND id_cliente=? AND id_estudio=?
    `).bind(data.status, data.observacao_interna || "", data.status,
      requestId, clientId, studioId).run();
    if (!result.meta.changes) return error("Solicitação não encontrada.", 404);
    await db.prepare(`
      INSERT INTO lgpd_historico(id_estudio,id_cliente,id_usuario,tipo,descricao)
      VALUES(?,?,?,'Solicitacao atualizada',?)
    `).bind(studioId, clientId, userId, `Status alterado para ${data.status}.`).run();
    return json({ ok: true });
  }
  return error("Operação LGPD não encontrada.", 404);
}

const moneyText = value => Number(value || 0).toLocaleString("pt-BR", {
  style: "currency", currency: "BRL"
});

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

async function passwordCredentials(password) {
  if (String(password || "").length < 8)
    throw new Error("A senha deve ter pelo menos 8 caracteres.");
  const iterations = 100000;
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const hash = await derivePassword(String(password), salt, iterations);
  return {
    salt: bytesToBase64(salt), hash: bytesToBase64(hash), iterations
  };
}

async function studioDataExport(db, studioId) {
  const studio = await db.prepare("SELECT * FROM estudios WHERE id=?").bind(studioId).first();
  if (!studio) return null;
  const queries = {
    usuarios: `SELECT id,login,nome,ativo,data_criacao,ultimo_login,foto_perfil,papel,
        perfil_acesso,cor_agenda
      FROM usuarios WHERE id_estudio=?`,
    modulos: "SELECT * FROM estudio_modulos WHERE id_estudio=? ORDER BY modulo",
    assinatura: "SELECT * FROM assinaturas_estudios WHERE id_estudio=?",
    parcelas_acesso: `SELECT * FROM assinatura_parcelas
      WHERE id_estudio=? ORDER BY competencia`,
    clientes: "SELECT * FROM clientes WHERE id_estudio=? ORDER BY id",
    agendamentos: "SELECT * FROM agendamentos WHERE id_estudio=? ORDER BY id",
    ordens_servico: "SELECT * FROM ordem_servico WHERE id_estudio=? ORDER BY id",
    financeiro: "SELECT * FROM financeiro WHERE id_estudio=? ORDER BY id",
    financeiro_movimentos: `SELECT fm.* FROM financeiro_movimentos fm
      JOIN financeiro f ON f.id=fm.id_financeiro WHERE f.id_estudio=? ORDER BY fm.id`,
    financeiro_ajustes: `SELECT fa.* FROM financeiro_ajustes fa
      JOIN financeiro f ON f.id=fa.id_financeiro WHERE f.id_estudio=? ORDER BY fa.id`,
    crediario: `SELECT cr.* FROM crediario cr JOIN financeiro f ON f.id=cr.id_financeiro
      WHERE f.id_estudio=? ORDER BY cr.id`,
    caixa: "SELECT * FROM caixa WHERE id_estudio=? ORDER BY id",
    gestao_financeira: "SELECT * FROM gestao_financeira WHERE id_estudio=? ORDER BY id",
    estoque: "SELECT * FROM estoque WHERE id_estudio=? ORDER BY id",
    estoque_movimentos: `SELECT em.* FROM estoque_movimentos em
      JOIN estoque e ON e.id=em.id_estoque WHERE e.id_estudio=? ORDER BY em.id`,
    materiais_os: `SELECT oc.* FROM os_consumo oc JOIN ordem_servico os ON os.id=oc.id_os
      WHERE os.id_estudio=? ORDER BY oc.id`,
    batoques: `SELECT ob.* FROM os_batoques ob JOIN ordem_servico os ON os.id=ob.id_os
      WHERE os.id_estudio=? ORDER BY ob.id`,
    tintas_batoques: `SELECT obt.* FROM os_batoque_tintas obt
      JOIN os_batoques ob ON ob.id=obt.id_batoque
      JOIN ordem_servico os ON os.id=ob.id_os WHERE os.id_estudio=? ORDER BY obt.id`,
    planejamento_marketing: `SELECT * FROM planejamento_marketing
      WHERE id_estudio=? ORDER BY id`,
    artes_marketing: `SELECT ma.* FROM marketing_artes ma
      JOIN planejamento_marketing pm ON pm.id=ma.id_planejamento
      WHERE pm.id_estudio=? ORDER BY ma.id_planejamento`,
    eventos_crm: "SELECT * FROM crm_eventos WHERE id_estudio=? ORDER BY id",
    fotos_clientes: `SELECT fc.* FROM crm_fotos_clientes fc
      JOIN clientes c ON c.id=fc.id_cliente WHERE c.id_estudio=?`,
    fotos_tatuagens: `SELECT ft.* FROM crm_fotos_tatuagens ft
      JOIN ordem_servico os ON os.id=ft.id_os WHERE os.id_estudio=?`,
    lgpd_clientes: "SELECT * FROM lgpd_clientes WHERE id_estudio=?",
    lgpd_solicitacoes: "SELECT * FROM lgpd_solicitacoes WHERE id_estudio=? ORDER BY id",
    lgpd_historico: "SELECT * FROM lgpd_historico WHERE id_estudio=? ORDER BY id"
  };
  const exported = {};
  for (const [key, sql] of Object.entries(queries)) {
    const { results } = await db.prepare(sql).bind(studioId).all();
    exported[key] = results;
  }
  return {
    formato: "abner-tattoo-studio-export",
    versao: 1,
    exportado_em: new Date().toISOString(),
    estudio: studio,
    dados: exported
  };
}

async function studioAdministration(db, request, url, user) {
  if (user.papel !== "SUPERADMIN") return error("Acesso restrito ao administrador geral.", 403);
  const usersMatch = url.pathname.match(
    /^\/api\/admin\/estudios\/(\d+)\/usuarios(?:\/(\d+))?$/
  );
  if (usersMatch) {
    const studioId = integer(usersMatch[1]);
    const userId = integer(usersMatch[2]);
    const studio = await db.prepare("SELECT id,nome_estudio FROM estudios WHERE id=?")
      .bind(studioId).first();
    if (!studio) return error("Estúdio não encontrado.", 404);
    if (request.method === "GET" && !userId) {
      const { results } = await db.prepare(`
        SELECT id,login,nome,ativo,perfil_acesso,cor_agenda,ultimo_login,data_criacao
        FROM usuarios WHERE id_estudio=?
        ORDER BY CASE perfil_acesso WHEN 'ADMINISTRADOR' THEN 0
          WHEN 'TATUADOR' THEN 1 ELSE 2 END,nome COLLATE NOCASE
      `).bind(studioId).all();
      return json({ estudio: studio, usuarios: results });
    }
    if (request.method === "POST" && !userId) {
      const data = await body(request);
      const login = required(data.login, "usuário").toLowerCase();
      const duplicate = await db.prepare(
        "SELECT id FROM usuarios WHERE login=? COLLATE NOCASE"
      ).bind(login).first();
      if (duplicate) return error("Este usuário de acesso já está em uso.");
      const credentials = await passwordCredentials(data.senha);
      const profile = ["ADMINISTRADOR", "TATUADOR", "RECEPCAO"]
        .includes(data.perfil_acesso) ? data.perfil_acesso : "TATUADOR";
      const color = /^#[0-9a-f]{6}$/i.test(data.cor_agenda || "")
        ? data.cor_agenda : "#d5a75b";
      const created = await db.prepare(`
        INSERT INTO usuarios
          (id_estudio,login,nome,senha_salt,senha_hash,senha_iteracoes,papel,
            perfil_acesso,cor_agenda)
        VALUES(?,?,?,?,?,?,'ADMIN_ESTUDIO',?,?)
      `).bind(studioId, login, required(data.nome, "nome"), credentials.salt,
        credentials.hash, credentials.iterations, profile, color).run();
      return json({ ok: true, id: created.meta.last_row_id }, 201);
    }
    if (request.method === "PUT" && userId) {
      const data = await body(request);
      const existing = await db.prepare(
        "SELECT id,papel FROM usuarios WHERE id=? AND id_estudio=?"
      ).bind(userId, studioId).first();
      if (!existing) return error("Usuário não encontrado.", 404);
      const login = required(data.login, "usuário").toLowerCase();
      const duplicate = await db.prepare(
        "SELECT id FROM usuarios WHERE login=? COLLATE NOCASE AND id<>?"
      ).bind(login, userId).first();
      if (duplicate) return error("Este usuário de acesso já está em uso.");
      const profile = ["ADMINISTRADOR", "TATUADOR", "RECEPCAO"]
        .includes(data.perfil_acesso) ? data.perfil_acesso : "TATUADOR";
      const color = /^#[0-9a-f]{6}$/i.test(data.cor_agenda || "")
        ? data.cor_agenda : "#d5a75b";
      const active = data.ativo === true || data.ativo === 1 || data.ativo === "1";
      const statements = [db.prepare(`
        UPDATE usuarios SET login=?,nome=?,perfil_acesso=?,cor_agenda=?,ativo=?
        WHERE id=? AND id_estudio=?
      `).bind(login, required(data.nome, "nome"), profile, color,
        active ? 1 : 0, userId, studioId)];
      if (data.senha) {
        const credentials = await passwordCredentials(data.senha);
        statements.push(db.prepare(`
          UPDATE usuarios SET senha_salt=?,senha_hash=?,senha_iteracoes=? WHERE id=?
        `).bind(credentials.salt, credentials.hash, credentials.iterations, userId));
      }
      if (!active) statements.push(
        db.prepare("UPDATE sessoes SET revogada=1 WHERE id_usuario=?").bind(userId));
      await db.batch(statements);
      return json({ ok: true });
    }
  }
  const exportMatch = url.pathname.match(/^\/api\/admin\/estudios\/(\d+)\/exportar$/);
  if (exportMatch && request.method === "GET") {
    return error(
      "A exportação só pode ser realizada pelo administrador do próprio estúdio.",
      403
    );
  }
  const subscriptionMatch = url.pathname.match(
    /^\/api\/admin\/estudios\/(\d+)\/assinatura$/
  );
  if (subscriptionMatch && request.method === "GET") {
    const studioId = integer(subscriptionMatch[1]);
    const studio = await db.prepare(
      "SELECT id,nome_estudio FROM estudios WHERE id=?"
    ).bind(studioId).first();
    if (!studio) return error("Estúdio não encontrado.", 404);
    const subscription = await db.prepare(
      "SELECT * FROM assinaturas_estudios WHERE id_estudio=?"
    ).bind(studioId).first();
    const { results: installments } = await db.prepare(`
      SELECT * FROM assinatura_parcelas WHERE id_estudio=?
      ORDER BY competencia DESC,id DESC
    `).bind(studioId).all();
    return json({ estudio: studio, assinatura: subscription, parcelas: installments });
  }
  const installmentCreateMatch = url.pathname.match(
    /^\/api\/admin\/estudios\/(\d+)\/parcelas$/
  );
  if (installmentCreateMatch && request.method === "POST") {
    const studioId = integer(installmentCreateMatch[1]);
    const data = await body(request);
    const subscription = await db.prepare(
      "SELECT * FROM assinaturas_estudios WHERE id_estudio=?"
    ).bind(studioId).first();
    if (!subscription) return error("Assinatura não encontrada.", 404);
    const competence = /^\d{4}-\d{2}$/.test(data.competencia || "")
      ? data.competencia : saoPauloDate().slice(0, 7);
    const dueDay = Math.min(28, Math.max(1,
      integer(data.dia_vencimento) || Number(subscription.dia_vencimento) || 10));
    const dueDate = data.data_vencimento || `${competence}-${String(dueDay).padStart(2, "0")}`;
    const value = data.valor === "" || data.valor == null
      ? Number(subscription.valor_mensal) : number(data.valor);
    if (value < 0) return error("Informe um valor válido.");
    try {
      const created = await db.prepare(`
        INSERT INTO assinatura_parcelas
          (id_estudio,competencia,data_vencimento,valor,observacoes)
        VALUES(?,?,?,?,?)
      `).bind(studioId, competence, dueDate, value, data.observacoes || "").run();
      return json({ ok: true, id: created.meta.last_row_id }, 201);
    } catch (cause) {
      if (String(cause.message || "").includes("UNIQUE"))
        return error("Já existe uma parcela para esta competência.");
      throw cause;
    }
  }
  const installmentActionMatch = url.pathname.match(
    /^\/api\/admin\/estudios\/(\d+)\/parcelas\/(\d+)\/(pagar|cancelar)$/
  );
  if (installmentActionMatch && request.method === "POST") {
    const studioId = integer(installmentActionMatch[1]);
    const installmentId = integer(installmentActionMatch[2]);
    const action = installmentActionMatch[3];
    const data = await body(request);
    const installment = await db.prepare(`
      SELECT * FROM assinatura_parcelas WHERE id=? AND id_estudio=?
    `).bind(installmentId, studioId).first();
    if (!installment) return error("Parcela não encontrada.", 404);
    if (action === "pagar") {
      await db.prepare(`
        UPDATE assinatura_parcelas SET status='Pago',data_pagamento=?,
          forma_pagamento=?,observacoes=? WHERE id=? AND id_estudio=?
      `).bind(data.data_pagamento || saoPauloDate(), data.forma_pagamento || "Pix",
        data.observacoes || installment.observacoes || "", installmentId, studioId).run();
    } else {
      await db.prepare(`
        UPDATE assinatura_parcelas SET status='Cancelado',data_pagamento=NULL
        WHERE id=? AND id_estudio=?
      `).bind(installmentId, studioId).run();
    }
    return json({ ok: true });
  }
  if (request.method === "GET" && url.pathname === "/api/admin/estudios") {
    const { results } = await db.prepare(`
      SELECT e.*,u.id id_usuario,u.nome nome_usuario,u.login,u.ativo usuario_ativo,
        (SELECT COUNT(*) FROM clientes c WHERE c.id_estudio=e.id) total_clientes,
        (SELECT COUNT(*) FROM usuarios ux
          WHERE ux.id_estudio=e.id AND ux.ativo=1) total_usuarios,
        COALESCE((SELECT GROUP_CONCAT(em.modulo) FROM estudio_modulos em
          WHERE em.id_estudio=e.id AND em.habilitado=1),'') modulos_habilitados,
        ae.valor_mensal,ae.dia_vencimento,ae.status status_assinatura,
        ae.data_inicio,ae.data_cancelamento,ae.observacoes observacoes_assinatura,
        (SELECT COUNT(*) FROM assinatura_parcelas ap
          WHERE ap.id_estudio=e.id AND ap.status='Pendente') parcelas_pendentes,
        COALESCE((SELECT SUM(ap.valor) FROM assinatura_parcelas ap
          WHERE ap.id_estudio=e.id AND ap.status='Pendente'),0) valor_pendente
      FROM estudios e
      LEFT JOIN assinaturas_estudios ae ON ae.id_estudio=e.id
      LEFT JOIN usuarios u ON u.id=(
        SELECT ux.id FROM usuarios ux WHERE ux.id_estudio=e.id
        ORDER BY CASE WHEN ux.papel='SUPERADMIN' THEN 0 ELSE 1 END,ux.id LIMIT 1
      )
      ORDER BY e.id
    `).all();
    return json(results);
  }
  if (request.method === "POST" && url.pathname === "/api/admin/estudios") {
    const data = await body(request);
    const moduleNames = ["agenda", "clientes", "financeiro", "estoque", "marketing"];
    const selectedModules = new Set(Array.isArray(data.modulos)
      ? data.modulos.filter(module => moduleNames.includes(module))
      : ["agenda", "clientes", "financeiro", "estoque"]);
    const login = required(data.login, "usuário").toLowerCase();
    const duplicate = await db.prepare("SELECT id FROM usuarios WHERE login=? COLLATE NOCASE")
      .bind(login).first();
    if (duplicate) return error("Este usuário de acesso já está em uso.");
    const credentials = await passwordCredentials(data.senha);
    const studio = await db.prepare(`
      INSERT INTO estudios
        (nome_estudio,nome_responsavel,cnpj,endereco,instagram,email_privacidade,
          prazo_retencao_anos)
      VALUES(?,?,?,?,?,?,?)
    `).bind(required(data.nome_estudio, "nome do estúdio"),
      required(data.nome_usuario, "nome do responsável"),
      String(data.cnpj || "").replace(/\D/g, ""), data.endereco || "",
      data.instagram || "", emailAddress(data.email_privacidade),
      Math.max(0, integer(data.prazo_retencao_anos))).run();
    try {
      const account = await db.prepare(`
        INSERT INTO usuarios
          (id_estudio,login,nome,senha_salt,senha_hash,senha_iteracoes,papel)
        VALUES(?,?,?,?,?,?,'ADMIN_ESTUDIO')
      `).bind(studio.meta.last_row_id, login,
        required(data.nome_usuario, "nome do responsável"),
        credentials.salt, credentials.hash, credentials.iterations).run();
      await db.batch([
        ...moduleNames.map(module => db.prepare(`
          INSERT INTO estudio_modulos(id_estudio,modulo,habilitado) VALUES(?,?,?)
        `).bind(studio.meta.last_row_id, module,
          selectedModules.has(module) ? 1 : 0)),
        db.prepare(`
          INSERT INTO assinaturas_estudios
            (id_estudio,valor_mensal,dia_vencimento,status,data_inicio,observacoes)
          VALUES(?,?,?,'Ativa',?,?)
        `).bind(studio.meta.last_row_id, number(data.valor_mensal),
          Math.min(28, Math.max(1, integer(data.dia_vencimento) || 10)),
          data.data_inicio || saoPauloDate(), data.observacoes_assinatura || "")
      ]);
      return json({
        ok: true, id: studio.meta.last_row_id, id_usuario: account.meta.last_row_id
      }, 201);
    } catch (cause) {
      await db.prepare("DELETE FROM usuarios WHERE id_estudio=?")
        .bind(studio.meta.last_row_id).run();
      await db.prepare("DELETE FROM estudio_modulos WHERE id_estudio=?")
        .bind(studio.meta.last_row_id).run();
      await db.prepare("DELETE FROM assinaturas_estudios WHERE id_estudio=?")
        .bind(studio.meta.last_row_id).run();
      await db.prepare("DELETE FROM estudios WHERE id=?").bind(studio.meta.last_row_id).run();
      throw cause;
    }
  }
  const match = url.pathname.match(/^\/api\/admin\/estudios\/(\d+)$/);
  if (match && request.method === "PUT") {
    const studioId = integer(match[1]);
    const data = await body(request);
    const moduleNames = ["agenda", "clientes", "financeiro", "estoque", "marketing"];
    const selectedModules = new Set(Array.isArray(data.modulos)
      ? data.modulos.filter(module => moduleNames.includes(module))
      : ["agenda", "clientes", "financeiro", "estoque"]);
    const subscriptionStatus = ["Ativa", "Pausada", "Cancelada"]
      .includes(data.status_assinatura) ? data.status_assinatura : "Ativa";
    const active = data.ativo === true || data.ativo === 1 || data.ativo === "1";
    const accessActive = active && subscriptionStatus === "Ativa";
    const studio = await db.prepare("SELECT id FROM estudios WHERE id=?").bind(studioId).first();
    if (!studio) return error("Estúdio não encontrado.", 404);
    if (studioId === Number(user.id_estudio) && !accessActive)
      return error("O estúdio do administrador geral não pode ser desativado.");
    const account = await db.prepare(
      "SELECT id FROM usuarios WHERE id_estudio=? ORDER BY id LIMIT 1"
    ).bind(studioId).first();
    if (!account) return error("Usuário do estúdio não encontrado.", 404);
    const login = required(data.login, "usuário").toLowerCase();
    const duplicate = await db.prepare(
      "SELECT id FROM usuarios WHERE login=? COLLATE NOCASE AND id<>?"
    ).bind(login, account.id).first();
    if (duplicate) return error("Este usuário de acesso já está em uso.");
    const statements = [
      db.prepare(`
        UPDATE estudios SET nome_estudio=?,nome_responsavel=?,cnpj=?,endereco=?,
          instagram=?,email_privacidade=?,prazo_retencao_anos=?,ativo=?,
          data_atualizacao=CURRENT_TIMESTAMP WHERE id=?
      `).bind(required(data.nome_estudio, "nome do estúdio"),
        required(data.nome_usuario, "nome do responsável"),
        String(data.cnpj || "").replace(/\D/g, ""), data.endereco || "",
        data.instagram || "", emailAddress(data.email_privacidade),
        Math.max(0, integer(data.prazo_retencao_anos)), accessActive ? 1 : 0, studioId),
      db.prepare("UPDATE usuarios SET login=?,nome=?,ativo=? WHERE id=?")
        .bind(login, required(data.nome_usuario, "nome do responsável"),
          accessActive ? 1 : 0, account.id)
    ];
    statements.push(
      ...moduleNames.map(module => db.prepare(`
        INSERT INTO estudio_modulos(id_estudio,modulo,habilitado,data_atualizacao)
        VALUES(?,?,?,CURRENT_TIMESTAMP)
        ON CONFLICT(id_estudio,modulo) DO UPDATE SET
          habilitado=excluded.habilitado,data_atualizacao=CURRENT_TIMESTAMP
      `).bind(studioId, module, selectedModules.has(module) ? 1 : 0)),
      db.prepare(`
        INSERT INTO assinaturas_estudios
          (id_estudio,valor_mensal,dia_vencimento,status,data_inicio,
            data_cancelamento,observacoes,data_atualizacao)
        VALUES(?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
        ON CONFLICT(id_estudio) DO UPDATE SET
          valor_mensal=excluded.valor_mensal,
          dia_vencimento=excluded.dia_vencimento,
          status=excluded.status,
          data_inicio=excluded.data_inicio,
          data_cancelamento=excluded.data_cancelamento,
          observacoes=excluded.observacoes,
          data_atualizacao=CURRENT_TIMESTAMP
      `).bind(studioId, number(data.valor_mensal),
        Math.min(28, Math.max(1, integer(data.dia_vencimento) || 10)),
        subscriptionStatus, data.data_inicio || null,
        subscriptionStatus === "Cancelada" ? (data.data_cancelamento || saoPauloDate()) : null,
        data.observacoes_assinatura || "")
    );
    if (data.senha) {
      const credentials = await passwordCredentials(data.senha);
      statements.push(db.prepare(`
        UPDATE usuarios SET senha_salt=?,senha_hash=?,senha_iteracoes=? WHERE id=?
      `).bind(credentials.salt, credentials.hash, credentials.iterations, account.id));
    }
    await db.batch(statements);
    if (!accessActive) {
      await db.prepare("UPDATE sessoes SET revogada=1 WHERE id_usuario=?")
        .bind(account.id).run();
    }
    return json({ ok: true });
  }
  return null;
}

async function currentUser(db, request) {
  const token = parseCookies(request).studio_session;
  if (!token) return null;
  const row = await db.prepare(`
    SELECT u.id,u.login,u.nome,u.foto_perfil,u.id_estudio,u.papel,
      u.perfil_acesso,u.cor_agenda,
      e.nome_estudio,e.ativo estudio_ativo,s.id id_sessao,
      COALESCE((SELECT GROUP_CONCAT(em.modulo) FROM estudio_modulos em
        WHERE em.id_estudio=u.id_estudio AND em.habilitado=1),'') modulos
    FROM sessoes s
    JOIN usuarios u ON u.id=s.id_usuario
    JOIN estudios e ON e.id=u.id_estudio
    WHERE s.token_hash=? AND s.revogada=0 AND s.data_expiracao>CURRENT_TIMESTAMP
      AND u.ativo=1 AND e.ativo=1 LIMIT 1
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
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "private, no-store, max-age=0",
    "pragma": "no-cache",
    "vary": "Cookie"
  });
  if (cookie) headers.set("set-cookie", cookie);
  return new Response(JSON.stringify(data), { status, headers });
};

async function authApi(db, request, url) {
  const path = url.pathname;
  const user = await currentUser(db, request);
  if (path === "/api/auth/me" && request.method === "GET") {
    if (!user) return authResponse({ authenticated: false }, 401);
    return authResponse({ authenticated: true, user: {
      id: user.id, login: user.login, nome: user.nome, papel: user.papel,
      perfil_acesso: user.perfil_acesso, cor_agenda: user.cor_agenda,
      id_estudio: user.id_estudio, nome_estudio: user.nome_estudio,
      modulos: String(user.modulos || "").split(",").filter(Boolean)
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
    const account = await db.prepare(`
      SELECT u.* FROM usuarios u JOIN estudios e ON e.id=u.id_estudio
      WHERE u.login=? AND u.ativo=1 AND e.ativo=1 LIMIT 1
    `).bind(login).first();
    const salt = account ? base64ToBytes(account.senha_salt) : new Uint8Array(32);
    const expected = account ? base64ToBytes(account.senha_hash) : new Uint8Array(32);
    const derived = await derivePassword(String(data.senha || ""), salt,
      account?.senha_iteracoes || 100000);
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
    const response = authResponse({ ok: true }, 200,
      `studio_session=; Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=0`);
    response.headers.set("clear-site-data", "\"cache\"");
    return response;
  }
  if (path.startsWith("/api/auth/passkey")) {
    return authResponse({ error: "Rota de autenticação não encontrada." }, 404);
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

function requiredModules(pathname) {
  if (pathname === "/api/lgpd") return ["clientes"];
  if (pathname === "/api/notificacoes" || pathname.startsWith("/api/marketing"))
    return ["marketing"];
  if (pathname.startsWith("/api/estoque")) return ["estoque"];
  if (/^\/api\/os\/\d+\/(materiais|tintas)/.test(pathname))
    return ["agenda", "estoque"];
  if (pathname === "/api/dashboard" || pathname.startsWith("/api/financeiro") ||
    pathname === "/api/movimentos" || pathname === "/api/ajustes" ||
    pathname.startsWith("/api/crediario")) return ["financeiro"];
  if (pathname.startsWith("/api/clientes") || pathname.startsWith("/api/crm"))
    return ["clientes"];
  if (pathname === "/api/tatuadores" || pathname.startsWith("/api/agendamentos") ||
    pathname === "/api/os" ||
    /^\/api\/os\//.test(pathname)) return ["agenda"];
  return [];
}

async function api(request, env, url, user) {
  const db = env.DB;
  const studioId = Number(user.id_estudio);
  if (url.pathname.startsWith("/api/admin/")) {
    const administration = await studioAdministration(db, request, url, user);
    if (administration) return administration;
    return error("Rota administrativa não encontrada.", 404);
  }
  const enabledModules = new Set(String(user.modulos || "").split(",").filter(Boolean));
  const missingModule = requiredModules(url.pathname)
    .find(module => !enabledModules.has(module));
  if (missingModule) return error("Este módulo não está habilitado para o estúdio.", 403);
  if (url.pathname === "/api/estudio/exportar" && request.method === "GET") {
    if (user.papel !== "SUPERADMIN" && user.perfil_acesso !== "ADMINISTRADOR") {
      return error("Somente o administrador do estúdio pode exportar os dados.", 403);
    }
    const exported = await studioDataExport(db, studioId);
    return exported ? json(exported) : error("Estúdio não encontrado.", 404);
  }
  if (url.pathname === "/api/lgpd" && request.method === "GET") {
    const { results: requests } = await db.prepare(`
      SELECT ls.*,c.nome cliente
      FROM lgpd_solicitacoes ls JOIN clientes c ON c.id=ls.id_cliente
      WHERE ls.id_estudio=?
      ORDER BY CASE WHEN ls.status IN ('Pendente','Em andamento') THEN 0 ELSE 1 END,
        ls.data_limite,ls.data_solicitacao DESC LIMIT 150
    `).bind(studioId).all();
    const { results: audit } = await db.prepare(`
      SELECT la.acao,la.recurso,la.resultado,la.ip,la.data_evento,u.nome usuario
      FROM lgpd_auditoria la JOIN usuarios u ON u.id=la.id_usuario
      WHERE la.id_estudio=? ORDER BY la.data_evento DESC,la.id DESC LIMIT 100
    `).bind(studioId).all();
    const studio = await db.prepare(`
      SELECT email_privacidade,versao_aviso_privacidade,prazo_retencao_anos
      FROM estudios WHERE id=?
    `).bind(studioId).first();
    return json({
      estudio: studio, solicitacoes: requests, auditoria: audit,
      resumo: {
        abertas: requests.filter(item => item.status === "Pendente").length,
        em_analise: requests.filter(item => item.status === "Em andamento").length,
        vencidas: requests.filter(item =>
          ["Pendente", "Em andamento"].includes(item.status) && item.data_limite &&
          item.data_limite.slice(0, 10) < saoPauloDate()).length
      }
    });
  }
  if (/^\/api\/clientes\/\d+\/lgpd(?:\/|$)/.test(url.pathname)) {
    const privacyResponse = await clientPrivacy(db, request, url, studioId, user.id);
    if (privacyResponse) return privacyResponse;
  }
  const crmMatch = url.pathname.match(/^\/api\/clientes\/(\d+)\/crm$/);
  if (crmMatch && request.method === "GET")
    return clientCrm(db, integer(crmMatch[1]), studioId, enabledModules);
  const crmPhotoMatch = url.pathname.match(/^\/api\/crm\/(cliente|tatuagem)\/(\d+)\/foto$/);
  if (crmPhotoMatch) {
    const table = crmPhotoMatch[1] === "cliente" ? "crm_fotos_clientes" : "crm_fotos_tatuagens";
    const column = crmPhotoMatch[1] === "cliente" ? "id_cliente" : "id_os";
    const id = integer(crmPhotoMatch[2]);
    const ownerTable = crmPhotoMatch[1] === "cliente" ? "clientes" : "ordem_servico";
    const owner = await db.prepare(
      `SELECT id FROM ${ownerTable} WHERE id=? AND id_estudio=?`
    ).bind(id, studioId).first();
    if (!owner) return error("Registro não encontrado.", 404);
    if (request.method === "GET") {
      const photo = await db.prepare(
        `SELECT mime_type,dados_base64 FROM ${table} WHERE ${column}=?`
      ).bind(id).first();
      if (!photo) return error("Foto não encontrada.", 404);
      return new Response(base64ToBytes(photo.dados_base64), {
        headers: {
          "content-type": photo.mime_type,
          "cache-control": "private, no-store, max-age=0",
          "pragma": "no-cache",
          "vary": "Cookie"
        }
      });
    }
    if (request.method === "POST") {
      const data = await body(request);
      const match = String(data.imagem || "").match(
        /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/
      );
      const maximumLength = crmPhotoMatch[1] === "tatuagem" ? 300000 : 1400000;
      if (!match || match[2].length > maximumLength)
        return error("A foto é inválida ou muito grande.");
      await db.prepare(`
        INSERT INTO ${table}(${column},mime_type,dados_base64,data_atualizacao)
        VALUES(?,?,?,CURRENT_TIMESTAMP)
        ON CONFLICT(${column}) DO UPDATE SET mime_type=excluded.mime_type,
          dados_base64=excluded.dados_base64,data_atualizacao=CURRENT_TIMESTAMP
      `).bind(id, match[1], match[2]).run();
      return json({ ok: true });
    }
  }
  const crmOrderMatch = url.pathname.match(/^\/api\/crm\/os\/(\d+)$/);
  if (crmOrderMatch && request.method === "PUT") {
    const data = await body(request);
    const result = await db.prepare(`
      UPDATE ordem_servico SET regiao_corpo=?,tempo_sessao_minutos=?
      WHERE id=? AND id_estudio=?
    `).bind(data.regiao_corpo || "", integer(data.tempo_sessao_minutos),
      integer(crmOrderMatch[1]), studioId).run();
    if (!result.meta.changes) return error("Ordem de serviço não encontrada.", 404);
    return json({ ok: true });
  }
  if (url.pathname === "/api/notificacoes" && request.method === "GET") {
    const today = saoPauloDate();
    const todayTime = Date.parse(`${today}T12:00:00Z`);
    const { results: links } = await db.prepare(`
      SELECT mop.chave,mop.id_planejamento,pm.status
      FROM marketing_oportunidade_planos mop
      LEFT JOIN planejamento_marketing pm ON pm.id=mop.id_planejamento
      WHERE mop.id_estudio=?
    `).bind(studioId).all();
    const opportunities = marketingOpportunities().map(item => {
      const days = Math.round(
        (Date.parse(`${item.date}T12:00:00Z`) - todayTime) / 86400000);
      const link = links.find(entry => entry.chave === item.key);
      return {
        id: `oportunidade-${item.key}`, tipo: "oportunidade",
        titulo: item.name,
        mensagem: link
          ? `Faltam ${days} dias. Verifique o andamento da campanha.`
          : `Faltam ${days} dias e a campanha ainda não foi planejada.`,
        data: item.date, dias: days, chave: item.key,
        id_planejamento: link?.id_planejamento || null
      };
    }).filter(item => item.dias >= 0 && item.dias <= 30);
    const { results: actions } = await db.prepare(`
      SELECT id,titulo,tipo,status,COALESCE(data_postagem,data_inicio) data_acao
      FROM planejamento_marketing
      WHERE id_estudio=? AND COALESCE(data_postagem,data_inicio) IS NOT NULL
        AND status NOT IN ('Publicado','Encerrado')
    `).bind(studioId).all();
    const actionNotifications = actions.map(item => {
      const days = Math.round(
        (Date.parse(`${item.data_acao}T12:00:00Z`) - todayTime) / 86400000);
      return {
        id: `marketing-${item.id}`, tipo: "marketing", titulo: item.titulo,
        mensagem: days < 0 ? `Publicação atrasada há ${Math.abs(days)} dias.`
          : days === 0 ? "A ação está programada para hoje."
            : `A ação está programada para daqui a ${days} dias.`,
        data: item.data_acao, dias: days, id_planejamento: item.id
      };
    }).filter(item => item.dias >= -30 && item.dias <= 7);
    return json([...actionNotifications, ...opportunities]
      .sort((a, b) => a.dias - b.dias));
  }
  if (url.pathname === "/api/marketing" && request.method === "GET") {
    const { results } = await db.prepare(`
      SELECT pm.*,EXISTS(SELECT 1 FROM marketing_artes ma
        WHERE ma.id_planejamento=pm.id) tem_arte
      FROM planejamento_marketing pm
      WHERE pm.id_estudio=?
      ORDER BY COALESCE(data_postagem,data_inicio,data_criacao) DESC,id DESC
    `).bind(studioId).all();
    return json(results);
  }
  if (url.pathname === "/api/marketing/oportunidades" && request.method === "GET") {
    const { results: links } = await db.prepare(`
      SELECT mop.chave,mop.id_planejamento,pm.status
      FROM marketing_oportunidade_planos mop
      LEFT JOIN planejamento_marketing pm ON pm.id=mop.id_planejamento
      WHERE mop.id_estudio=?
    `).bind(studioId).all();
    const today = saoPauloDate();
    const todayTime = Date.parse(`${today}T12:00:00Z`);
    return json(marketingOpportunities().map(item => {
      const link = links.find(entry => entry.chave === item.key);
      return {
        ...item,
        days: Math.round((Date.parse(`${item.date}T12:00:00Z`) - todayTime) / 86400000),
        id_planejamento: link?.id_planejamento || null,
        status: link?.status || "Não planejada"
      };
    }).filter(item => item.days >= -7).sort((a, b) => a.date.localeCompare(b.date)));
  }
  if (url.pathname === "/api/marketing/oportunidades/planejar" && request.method === "POST") {
    const data = await body(request);
    const opportunity = marketingOpportunities().find(item => item.key === data.key);
    if (!opportunity) return error("Oportunidade inválida.");
    const existing = await db.prepare(
      `SELECT id_planejamento FROM marketing_oportunidade_planos
       WHERE id_estudio=? AND chave=?`
    ).bind(studioId, opportunity.key).first();
    if (existing) return json({ ok: true, id: existing.id_planejamento });
    const publishDate = new Date(`${opportunity.date}T12:00:00Z`);
    publishDate.setUTCDate(publishDate.getUTCDate() - 7);
    const created = await db.prepare(`
      INSERT INTO planejamento_marketing
        (id_estudio,titulo,tipo,descricao,status,data_inicio,data_fim,data_postagem)
      VALUES(?,?,'Promoção',?,'Ideia',?,?,?)
    `).bind(studioId, `Campanha de ${opportunity.name}`,
      `Planejamento para aproveitar ${opportunity.name}.`,
      publishDate.toISOString().slice(0, 10), opportunity.date,
      publishDate.toISOString().slice(0, 10)).run();
    await db.prepare(`
      INSERT INTO marketing_oportunidade_planos(id_estudio,chave,id_planejamento)
      VALUES(?,?,?)
    `).bind(studioId, opportunity.key, created.meta.last_row_id).run();
    return json({ ok: true, id: created.meta.last_row_id }, 201);
  }
  if (url.pathname === "/api/marketing" && request.method === "POST") {
    const data = await body(request);
    const created = await db.prepare(`
      INSERT INTO planejamento_marketing
        (id_estudio,titulo,tipo,descricao,oferta,plataformas,status,data_inicio,data_fim,
          data_postagem,hora_postagem,texto_postagem,objetivo,publico,
          impulsionar,impulsionamento_inicio,impulsionamento_fim,orcamento,observacoes)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(studioId, required(data.titulo, "título"), data.tipo || "Postagem",
      data.descricao || "", data.oferta || "", data.plataformas || "",
      data.status || "Ideia", data.data_inicio || null, data.data_fim || null,
      data.data_postagem || null, data.hora_postagem || null,
      data.texto_postagem || "", data.objetivo || "", data.publico || "",
      data.impulsionar ? 1 : 0, data.impulsionamento_inicio || null,
      data.impulsionamento_fim || null, number(data.orcamento), data.observacoes || "").run();
    return json({ ok: true, id: created.meta.last_row_id }, 201);
  }
  const marketingArtMatch = url.pathname.match(/^\/api\/marketing\/(\d+)\/arte$/);
  if (marketingArtMatch) {
    const plan = await db.prepare(
      "SELECT id FROM planejamento_marketing WHERE id=? AND id_estudio=?"
    ).bind(integer(marketingArtMatch[1]), studioId).first();
    if (!plan) return error("Planejamento não encontrado.", 404);
  }
  if (marketingArtMatch && request.method === "GET") {
    const art = await db.prepare(
      "SELECT mime_type,dados_base64 FROM marketing_artes WHERE id_planejamento=?"
    ).bind(integer(marketingArtMatch[1])).first();
    if (!art) return error("Arte não encontrada.", 404);
    return new Response(base64ToBytes(art.dados_base64), {
      headers: { "content-type": art.mime_type, "cache-control": "no-store" }
    });
  }
  if (marketingArtMatch && request.method === "POST") {
    const data = await body(request);
    const match = String(data.imagem || "").match(
      /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/
    );
    if (!match || match[2].length > 1400000) return error("A arte é inválida ou muito grande.");
    await db.prepare(`
      INSERT INTO marketing_artes(id_planejamento,mime_type,dados_base64,data_atualizacao)
      VALUES(?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(id_planejamento) DO UPDATE SET mime_type=excluded.mime_type,
        dados_base64=excluded.dados_base64,data_atualizacao=CURRENT_TIMESTAMP
    `).bind(integer(marketingArtMatch[1]), match[1], match[2]).run();
    return json({ ok: true });
  }
  const marketingMatch = url.pathname.match(/^\/api\/marketing\/(\d+)$/);
  if (marketingMatch && request.method === "PUT") {
    const data = await body(request);
    const result = await db.prepare(`
      UPDATE planejamento_marketing SET titulo=?,tipo=?,descricao=?,oferta=?,
        plataformas=?,status=?,data_inicio=?,data_fim=?,data_postagem=?,
        hora_postagem=?,texto_postagem=?,objetivo=?,publico=?,impulsionar=?,
        impulsionamento_inicio=?,impulsionamento_fim=?,orcamento=?,observacoes=?,
        data_atualizacao=CURRENT_TIMESTAMP WHERE id=? AND id_estudio=?
    `).bind(required(data.titulo, "título"), data.tipo || "Postagem",
      data.descricao || "", data.oferta || "", data.plataformas || "",
      data.status || "Ideia", data.data_inicio || null, data.data_fim || null,
      data.data_postagem || null, data.hora_postagem || null,
      data.texto_postagem || "", data.objetivo || "", data.publico || "",
      data.impulsionar ? 1 : 0, data.impulsionamento_inicio || null,
      data.impulsionamento_fim || null, number(data.orcamento),
      data.observacoes || "", integer(marketingMatch[1]), studioId).run();
    if (!result.meta.changes) return error("Planejamento não encontrado.", 404);
    return json({ ok: true });
  }
  if (marketingMatch && request.method === "DELETE") {
    const plan = await db.prepare(
      "SELECT id FROM planejamento_marketing WHERE id=? AND id_estudio=?"
    ).bind(integer(marketingMatch[1]), studioId).first();
    if (!plan) return error("Planejamento não encontrado.", 404);
    await db.prepare("DELETE FROM marketing_oportunidade_planos WHERE id_planejamento=?")
      .bind(integer(marketingMatch[1])).run();
    await db.prepare("DELETE FROM marketing_artes WHERE id_planejamento=?")
      .bind(integer(marketingMatch[1])).run();
    await db.prepare("DELETE FROM planejamento_marketing WHERE id=? AND id_estudio=?")
      .bind(integer(marketingMatch[1]), studioId).run();
    return json({ ok: true });
  }
  if (url.pathname === "/api/perfil") {
    if (request.method === "GET") {
      const studio = await db.prepare("SELECT * FROM estudios WHERE id=?")
        .bind(studioId).first();
      return json({ nome: user.nome, foto_perfil: user.foto_perfil, ...(studio || {}) });
    }
    if (request.method === "PUT") {
      const data = await body(request);
      const photo = String(data.foto_perfil || "");
      if (photo && (!/^data:image\/(?:jpeg|png|webp);base64,/.test(photo) ||
        photo.length > 300000)) {
        return error("A foto de perfil é inválida ou muito grande.");
      }
      const statements = [
        db.prepare("UPDATE usuarios SET nome=?,foto_perfil=? WHERE id=?")
          .bind(required(data.nome, "nome"), photo || null, user.id)
      ];
      if (user.papel === "SUPERADMIN" || user.perfil_acesso === "ADMINISTRADOR") {
        statements.push(db.prepare(`
          UPDATE estudios SET nome_estudio=?,nome_responsavel=?,endereco=?,cnpj=?,
            instagram=?,email_privacidade=?,prazo_retencao_anos=?,
            whatsapp_alertas=?,alertas_whatsapp_ativos=?,horario_resumo_whatsapp=?,
            data_atualizacao=CURRENT_TIMESTAMP
          WHERE id=?
        `).bind(required(data.nome_estudio, "nome do estúdio"),
          required(data.nome, "nome"), data.endereco || "",
          String(data.cnpj || "").replace(/\D/g, ""), data.instagram || "",
          emailAddress(data.email_privacidade),
          Math.max(0, integer(data.prazo_retencao_anos)),
          String(data.whatsapp_alertas || "").replace(/\D/g, ""),
          data.alertas_whatsapp_ativos === true ||
            data.alertas_whatsapp_ativos === "1" ? 1 : 0,
          /^\d{2}:\d{2}$/.test(String(data.horario_resumo_whatsapp || ""))
            ? data.horario_resumo_whatsapp : "08:00",
          studioId));
      }
      await db.batch(statements);
      return json({ ok: true });
    }
  }
  if (url.pathname === "/api/perfil/resumo-whatsapp" && request.method === "GET") {
    const resumo = await dailyWhatsAppSummary(db, studioId);
    const { results: historico } = await db.prepare(`
      SELECT data_referencia,telefone,status,data_criacao,data_envio
      FROM whatsapp_resumos WHERE id_estudio=?
      ORDER BY data_referencia DESC,id DESC LIMIT 30
    `).bind(studioId).all();
    return json({
      ...resumo, historico,
      integracao_configurada: Boolean(env.WHATSAPP_ACCESS_TOKEN &&
        env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_TEMPLATE_NAME)
    });
  }
  if (url.pathname === "/api/perfil/senha" && request.method === "PUT") {
    const data = await body(request);
    const password = String(data.nova_senha || "");
    if (password.length < 8) return error("A nova senha deve ter pelo menos 8 caracteres.");
    if (password !== String(data.confirmar_senha || "")) {
      return error("As senhas informadas não são iguais.");
    }
    const iterations = 100000;
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const hash = await derivePassword(password, salt, iterations);
    await db.batch([
      db.prepare(`
        UPDATE usuarios SET senha_salt=?,senha_hash=?,senha_iteracoes=? WHERE id=?
      `).bind(bytesToBase64(salt), bytesToBase64(hash), iterations, user.id),
      db.prepare("UPDATE sessoes SET revogada=1 WHERE id_usuario=? AND id<>?")
        .bind(user.id, user.id_sessao)
    ]);
    return json({ ok: true });
  }
  const clientResponse = await clients(db, request, url, studioId);
  if (clientResponse) return clientResponse;
  const stockResponse = await stock(db, request, url, studioId);
  if (stockResponse) return stockResponse;
  if (url.pathname.startsWith("/api/financeiro/")) {
    const managementResponse = await financialManagement(db, request, url, studioId);
    if (managementResponse) return managementResponse;
  }
  if (request.method === "GET" && url.pathname === "/api/agendamentos")
    return listAppointments(db, url, studioId, user.nome_estudio, enabledModules);
  if (request.method === "GET" && url.pathname === "/api/tatuadores") {
    const { results } = await db.prepare(`
      SELECT id,nome,cor_agenda,perfil_acesso FROM usuarios
      WHERE id_estudio=? AND ativo=1 AND perfil_acesso IN ('ADMINISTRADOR','TATUADOR')
      ORDER BY nome COLLATE NOCASE
    `).bind(studioId).all();
    return json(results);
  }
  if (request.method === "POST" && url.pathname === "/api/agendamentos")
    return createAppointment(db, request, studioId, user);
  if (request.method === "PUT" && /^\/api\/agendamentos\/\d+$/.test(url.pathname)) {
    const data = await body(request);
    const tattooerId = integer(data.id_tatuador);
    const tattooer = await db.prepare(`
      SELECT id FROM usuarios WHERE id=? AND id_estudio=? AND ativo=1
        AND perfil_acesso IN ('ADMINISTRADOR','TATUADOR')
    `).bind(tattooerId, studioId).first();
    if (!tattooer) return error("Selecione um profissional ativo deste estúdio.");
    const missed = data.status === "Falta";
    const status = data.status === "Finalizado" ? "Concluido" : missed ? "Cancelado" : data.status;
    const allowedStatuses = ["Agendado", "Confirmado", "Concluido", "Cancelado", "Remarcado"];
    if (!allowedStatuses.includes(status)) return error("Status de agendamento inválido.", 400);
    const orderStatuses = {
      Agendado: "Agendada",
      Confirmado: "Confirmada",
      Concluido: "Finalizada",
      Cancelado: "Cancelada",
      Remarcado: "Remarcada"
    };
    const appointmentId = integer(url.pathname.split("/").pop());
    const previous = await db.prepare(
      `SELECT id_cliente,data_hora,status,faltou FROM agendamentos
       WHERE id=? AND id_estudio=?`
    ).bind(appointmentId, studioId).first();
    if (!previous) return error("Agendamento não encontrado.", 404);
    const conflict = await db.prepare(`
      SELECT id FROM agendamentos
      WHERE id_estudio=? AND id_tatuador=? AND data_hora=? AND id<>?
        AND status NOT IN ('Cancelado','Concluido')
      LIMIT 1
    `).bind(studioId, tattooerId, `${data.data} ${data.hora}:00`,
      appointmentId).first();
    if (conflict) return error("Este profissional já possui um agendamento neste horário.");
    const statements = [
      db.prepare(`UPDATE agendamentos SET data_hora=?,status=?,faltou=?,id_tatuador=?
        WHERE id=? AND id_estudio=?`)
        .bind(`${data.data} ${data.hora}:00`, status, missed ? 1 : 0, tattooerId,
          appointmentId, studioId),
      db.prepare(`UPDATE ordem_servico SET status=?
        WHERE id_agendamento=? AND id_estudio=?`)
        .bind(orderStatuses[status], appointmentId, studioId)
    ];
    if (previous) {
      const nextDate = `${data.data} ${data.hora}:00`;
      if (previous.data_hora !== nextDate) statements.push(db.prepare(`
        INSERT INTO crm_eventos(id_estudio,id_cliente,id_agendamento,tipo,descricao)
        VALUES(?,?,?,'Reagendamento',?)
      `).bind(studioId, previous.id_cliente, appointmentId,
        `Horário alterado de ${brDateTime(previous.data_hora)} para ${brDateTime(nextDate)}.`));
      if (previous.status !== status || Boolean(previous.faltou) !== missed) {
        statements.push(db.prepare(`
          INSERT INTO crm_eventos(id_estudio,id_cliente,id_agendamento,tipo,descricao)
          VALUES(?,?,?,?,?)
        `).bind(studioId, previous.id_cliente, appointmentId,
          missed ? "Falta" : "Status",
          missed ? "Cliente não compareceu ao agendamento." : `Status alterado para ${status}.`));
      }
    }
    let signalRefund = 0;
    if (status === "Cancelado") {
      const financial = await db.prepare(`
        SELECT f.id, f.id_cliente, f.id_os,
          COALESCE(SUM(CASE WHEN fm.tipo='Sinal' THEN fm.valor
            WHEN fm.tipo='Estorno' THEN -fm.valor ELSE 0 END),0) sinal_recebido,
          COALESCE((
            SELECT forma_pagamento FROM financeiro_movimentos
            WHERE id_financeiro=f.id AND tipo='Sinal'
            ORDER BY id DESC LIMIT 1
          ),'Pix') forma_pagamento
        FROM financeiro f
        JOIN ordem_servico os ON os.id=f.id_os
        LEFT JOIN financeiro_movimentos fm ON fm.id_financeiro=f.id
        WHERE os.id_agendamento=? AND f.id_estudio=?
        GROUP BY f.id
      `).bind(appointmentId, studioId).first();
      if (financial) {
        signalRefund = Math.max(0, Number(financial.sinal_recebido));
        statements.push(
          db.prepare(`
            UPDATE financeiro SET status='Cancelado',sinal_pago=0,
              data_pagamento_sinal=NULL WHERE id=?
          `).bind(financial.id),
          db.prepare(`
            UPDATE crediario SET status='Cancelado'
            WHERE id_financeiro=? AND status IN ('Pendente','Atrasado')
          `).bind(financial.id)
        );
        if (signalRefund > 0) {
          const refundDate = saoPauloDate();
          const description = "Estorno automático do sinal por cancelamento";
          statements.push(
            db.prepare(`
              INSERT INTO financeiro_movimentos
                (id_financeiro,tipo,valor,forma_pagamento,observacao,data_pagamento)
              VALUES(?,'Estorno',?,?,?,?)
            `).bind(financial.id, signalRefund, financial.forma_pagamento,
              description, refundDate),
            db.prepare(`
              INSERT INTO caixa
                (id_estudio,data_movimento,tipo,categoria,descricao,valor,id_cliente,
                  id_financeiro,id_os,forma_pagamento)
              VALUES(?,?,'Saida','Estorno',?,?,?,?,?,?)
            `).bind(studioId, refundDate, description, signalRefund, financial.id_cliente,
              financial.id, financial.id_os, financial.forma_pagamento)
          );
        }
      }
    }
    await db.batch(statements);
    return json({ ok: true, estorno_sinal: signalRefund });
  }
  if (request.method === "GET" && url.pathname === "/api/os")
    return openOrder(db, url, studioId, enabledModules);
  if (/^\/api\/os\/\d+(?:\/(?:materiais|tintas)(?:\/\d+)?)?$/.test(url.pathname)) {
    const response = await orderService(db, request, url, studioId);
    if (response) return response;
  }
  if (request.method === "GET" && url.pathname === "/api/dashboard")
    return dashboard(db, studioId);
  if (request.method === "POST" && url.pathname === "/api/crediario")
    return createInstallments(db, request, studioId);
  if (request.method === "POST" && /^\/api\/crediario\/\d+\/pagar$/.test(url.pathname))
    return payInstallment(db, request, url, studioId);
  if (["/api/movimentos", "/api/ajustes"].includes(url.pathname))
    return finance(db, request, url, studioId);
  if (request.method === "GET" && /^\/api\/clientes\/\d+\/(historico|financeiro)$/.test(url.pathname))
    return clientSummary(db, url, studioId);
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
        const response = await api(request, env, url, user);
        const shouldAudit = !["GET", "HEAD"].includes(request.method) ||
          /\/(?:lgpd\/)?exportar$/.test(url.pathname);
        if (shouldAudit) {
          try {
            await env.DB.prepare(`
              INSERT INTO lgpd_auditoria
                (id_estudio,id_usuario,acao,recurso,resultado,ip,user_agent)
              VALUES(?,?,?,?,?,?,?)
            `).bind(user.id_estudio, user.id, request.method,
              url.pathname.slice(0, 300), response.status,
              request.headers.get("CF-Connecting-IP") || "",
              (request.headers.get("user-agent") || "").slice(0, 500)).run();
          } catch {}
        }
        return response;
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
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(sendDailyWhatsAppSummaries(env));
  }
};
