// Painel da administração do Conect60+ (só funciona para contas com admin = true)
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const data = d => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "");
  const fone = t => { t = String(t || ""); return t.length === 11 ? `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}` : t.length === 10 ? `(${t.slice(0, 2)}) ${t.slice(2, 6)}-${t.slice(6)}` : t; };
  const toast = msg => { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast.id); toast.id = setTimeout(() => t.classList.remove("show"), 3500); };
  const api = async (path, body, method) => {
    const opt = { method: method || (body ? "POST" : "GET"), credentials: "same-origin" };
    if (body) { opt.headers = { "Content-Type": "application/json" }; opt.body = JSON.stringify(body); }
    const r = await fetch("/api" + path, opt);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.erro || "Não foi possível concluir.");
    return d;
  };
  const NOTAS = ["", "Não gostei", "Neutro", "Gostei", "Ótimo"];
  const box = $("#conteudo");
  const tabela = (cab, linhas, vazio) => linhas.length
    ? `<div class="tbl-wrap"><table><thead><tr>${cab.map(c => `<th scope="col">${c}</th>`).join("")}</tr></thead><tbody>${linhas.join("")}</tbody></table></div>`
    : `<p>${vazio}</p>`;

  const telas = {
    async resumo() {
      const r = await api("/admin/resumo");
      const item = (n, t) => `<li><b>${esc(n)}</b>${t}</li>`;
      box.innerHTML = `<ul class="cards">
        ${item(r.idosos, "Idosos cadastrados")}${item(r.profissionais, "Profissionais")}${item(r.crefitoPendente, "Crefitos para conferir")}
        ${item(r.aulas, "Aulas")}${item(r.mensagensNovas, "Mensagens não lidas")}${item(r.pedidosSenha, "Pedidos de senha pendentes")}
        ${item(r.avaliacoes, "Avaliações")}${item(r.notaMedia == null ? "–" : r.notaMedia.toFixed(1).replace(".", ",") + " / 4", "Nota média")}</ul>`;
    },
    async usuarios() {
      const l = await api("/admin/usuarios");
      box.innerHTML = tabela(["Nome", "Contato", "Perfil", "Crefito", "Desde", "Ações"], l.map(u => `<tr>
        <td>${esc(u.nome)}${u.ativo ? "" : ' <span class="tagx off">desativado</span>'}</td>
        <td>${esc(fone(u.telefone))}<br>${esc(u.email)}</td>
        <td>${u.admin ? '<span class="tagx">Admin</span>' : u.demo ? '<span class="tagx warn">Demonstração</span>' : u.pro ? "Profissional" : "Idoso"}</td>
        <td>${u.pro && !u.demo ? `${esc(u.crefito)}<br><span class="tagx ${u.crefitoVerificado ? "ok" : "warn"}">${u.crefitoVerificado ? "conferido" : "a conferir"}</span>` : ""}</td>
        <td>${data(u.dataCriacao)}</td>
        <td>${u.pro && !u.demo ? `<button class="btn btn-sm" data-a="crefito" data-id="${u.id}" data-v="${u.crefitoVerificado ? 0 : 1}">${u.crefitoVerificado ? "Desaprovar" : "Aprovar Crefito"}</button>` : ""}
            ${u.admin ? "" : `<button class="btn btn-sm btn-outline" data-a="ativo" data-id="${u.id}" data-v="${u.ativo ? 0 : 1}">${u.ativo ? "Desativar" : "Reativar"}</button>
            <button class="btn btn-sm btn-outline" data-a="excluir-usuario" data-id="${u.id}">Excluir</button>`}</td></tr>`), "Nenhum usuário.");
    },
    async aulas() {
      const l = await api("/admin/aulas");
      box.innerHTML = `<p>As aulas marcadas como <strong>destaque</strong> aparecem em “Suas aulas” para todos os idosos. Os arquivos de vídeo são enviados pelo profissional, na área dele.</p>` +
        tabela(["Aula", "Profissional", "Vídeo", "Destaque", "Ações"], l.map(a => `<tr>
        <td>${esc(a.titulo)}${a.duracao ? ` <small>(${esc(a.duracao)})</small>` : ""}</td><td>${esc(a.profissional)}</td>
        <td><span class="tagx ${a.temVideo ? "ok" : "warn"}">${a.temVideo ? "enviado" : "sem arquivo"}</span></td>
        <td>${a.destaque ? '<span class="tagx ok">sim</span>' : "não"}</td>
        <td><button class="btn btn-sm" data-a="destaque" data-id="${a.id}" data-v="${a.destaque ? 0 : 1}">${a.destaque ? "Tirar do destaque" : "Pôr em destaque"}</button>
            <button class="btn btn-sm btn-outline" data-a="excluir-aula" data-id="${a.id}">Excluir</button></td></tr>`), "Nenhuma aula.");
    },
    async mensagens() {
      const l = await api("/admin/mensagens");
      box.innerHTML = tabela(["Quando", "De", "Mensagem", "Ações"], l.map(m => `<tr>
        <td>${data(m.criadoEm)}${m.lida ? "" : ' <span class="tagx warn">nova</span>'}</td>
        <td>${esc(m.nome)}<br><a href="mailto:${esc(m.email)}">${esc(m.email)}</a></td><td class="msg">${esc(m.mensagem)}</td>
        <td><button class="btn btn-sm" data-a="lida" data-id="${m.id}" data-v="${m.lida ? 0 : 1}">${m.lida ? "Marcar como não lida" : "Marcar como lida"}</button>
            <button class="btn btn-sm btn-outline" data-a="excluir-mensagem" data-id="${m.id}">Excluir</button></td></tr>`), "Nenhuma mensagem.");
    },
    async senhas() {
      const l = await api("/admin/pedidos-senha");
      const st = { PENDENTE: ['warn', 'aguardando'], CODIGO_GERADO: ['', 'código gerado'], USADO: ['ok', 'concluído'] };
      box.innerHTML = `<p><strong>Como atender:</strong> ligue para o telefone do cadastro, confirme que é a própria pessoa, toque em “Gerar código” e informe os 6 números. O código vale 24 horas e aparece só uma vez.</p><p id="codigo-box" role="status"></p>` +
        tabela(["Pedido em", "Usuário", "Telefone", "Situação", "Ações"], l.map(p => `<tr>
        <td>${data(p.criadoEm)}</td><td>${esc(p.usuario.nome)}</td><td>${esc(fone(p.usuario.telefone))}</td>
        <td><span class="tagx ${st[p.status][0]}">${st[p.status][1]}</span></td>
        <td>${p.status === "USADO" ? "" : `<button class="btn btn-sm" data-a="codigo" data-id="${p.id}" data-nome="${esc(p.usuario.nome)}">${p.status === "PENDENTE" ? "Gerar código" : "Gerar novo código"}</button>`}</td></tr>`), "Nenhum pedido.");
    },
    async avaliacoes() {
      const l = await api("/admin/avaliacoes");
      box.innerHTML = tabela(["Quando", "Aluno", "Avaliado", "Nota"], l.map(a => `<tr><td>${data(a.criadoEm)}</td><td>${esc(a.aluno)}</td><td>${esc(a.profissional)}</td><td>${a.nota} – ${NOTAS[a.nota]}</td></tr>`), "Nenhuma avaliação ainda.");
    }
  };

  let atual = "resumo";
  const abrir = async nome => {
    atual = nome;
    document.querySelectorAll("[data-tab]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === nome)));
    try { await telas[nome](); } catch (e) { box.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  };
  document.addEventListener("click", async e => {
    const tab = e.target.closest("[data-tab]"); if (tab) return abrir(tab.dataset.tab);
    const b = e.target.closest("[data-a]"); if (!b) return;
    const { a, id, v } = b.dataset, on = v === "1";
    // ações que apagam pedem um segundo toque
    if (a.startsWith("excluir") && b.dataset.armado !== "1") { b.dataset.armado = "1"; b.textContent = "Toque de novo para excluir"; return; }
    b.disabled = true;
    try {
      if (a === "crefito") await api(`/admin/usuarios/${id}`, { crefitoVerificado: on }, "PATCH");
      else if (a === "ativo") await api(`/admin/usuarios/${id}`, { ativo: on }, "PATCH");
      else if (a === "excluir-usuario") await api(`/admin/usuarios/${id}`, null, "DELETE");
      else if (a === "destaque") await api(`/admin/aulas/${id}`, { destaque: on }, "PATCH");
      else if (a === "excluir-aula") await api(`/admin/aulas/${id}`, null, "DELETE");
      else if (a === "lida") await api(`/admin/mensagens/${id}`, { lida: on }, "PATCH");
      else if (a === "excluir-mensagem") await api(`/admin/mensagens/${id}`, null, "DELETE");
      else if (a === "codigo") {
        const r = await api(`/admin/pedidos-senha/${id}/codigo`, {});
        const nome = b.dataset.nome;
        await abrir("senhas");
        $("#codigo-box").innerHTML = `Código para <strong>${esc(nome)}</strong>: <span class="codigo">${esc(r.codigo)}</span> (vale ${r.validoPorHoras} horas). Anote agora: ele não aparece de novo.`;
        return;
      }
      toast("Feito.");
      await abrir(atual);
    } catch (err) { toast(err.message); b.disabled = false; }
  });

  (async () => {
    let eu = null;
    try { eu = (await api("/auth/eu")).usuario; } catch { /* servidor fora do ar */ }
    if (!eu || !eu.admin) {
      $("#gate-msg").innerHTML = eu ? "Esta área é só para a administração." : 'Entre no site com a conta de administrador e volte para esta página. <br><br><a class="btn" href="/">Ir para o site</a>';
      return;
    }
    $("#gate").hidden = true; $("#painel").hidden = false;
    abrir("resumo");
  })();
})();
