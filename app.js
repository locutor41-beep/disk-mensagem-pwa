
/* Disco & Mensagem - app único (Cliente + Admin)
   Armazena dados no localStorage por padrão e pode usar Supabase (tempo real).
*/
(function(){
  const cfg = window.APP_CONFIG || {};
  const state = {
    pedidos: [],
    categorias: [],
    templates: [],
    logged: false,
    som: true,
    supabase: null,
    useSupabase: false
  };

  // ===== Util =====
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const fmtMoney = (v) => (Number(v||0)).toLocaleString("pt-BR",{ style:"currency", currency:"BRL" });
  const todayISO = () => new Date().toISOString().slice(0,10);
  function toast(msg){ alert(msg); }

  function setupTabs(){
    const tabCliente = $("#tabCliente");
    const tabAdmin = $("#tabAdmin");
    const clienteView = $("#clienteView");
    const adminView = $("#adminView");
    tabCliente.onclick = () => {
      tabCliente.classList.add("active"); tabAdmin.classList.remove("active");
      clienteView.classList.remove("hidden"); adminView.classList.add("hidden");
    };
    tabAdmin.onclick = () => {
      tabAdmin.classList.add("active"); tabCliente.classList.remove("active");
      adminView.classList.remove("hidden"); clienteView.classList.add("hidden");
    };
  }

  function beep(){
    if(!state.som) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = "sine"; o.frequency.value = 880;
      o.connect(g); g.connect(ctx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 1.0);
      setTimeout(()=>{ o.stop(); ctx.close(); }, 1100);
    } catch(e){ /* ignore */ }
  }

  // ===== Persistência Local (fallback) =====
  function loadLocal(){
    state.pedidos = JSON.parse(localStorage.getItem("dm_pedidos")||"[]");
    state.categorias = JSON.parse(localStorage.getItem("dm_categorias")||"[]");
    state.templates = JSON.parse(localStorage.getItem("dm_templates")||"[]");
  }
  function saveLocal(){
    localStorage.setItem("dm_pedidos", JSON.stringify(state.pedidos));
    localStorage.setItem("dm_categorias", JSON.stringify(state.categorias));
    localStorage.setItem("dm_templates", JSON.stringify(state.templates));
  }

  // ===== Supabase (opcional) =====
  async function setupSupabase(){
    const { url, anonKey } = cfg.supabase || {};
    if(url && anonKey){
      // carrega cliente supabase via CDN
      let supa = window.supabase;
      if(!supa){
        // injeta script do supabase
        await new Promise((res,rej)=>{
          const s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.3/dist/umd/supabase.js";
          s.onload = res; s.onerror = rej; document.head.appendChild(s);
        });
        supa = window.supabase;
      }
      state.supabase = supa.createClient(url, anonKey);
      state.useSupabase = true;
      await bootstrapSupabase();
      listenRealtime();
    }
  }

  async function bootstrapSupabase(){
    // Carrega dados existentes
    const sb = state.supabase;
    const { data: cats } = await sb.from("categorias").select("*").order("nome");
    const { data: temps } = await sb.from("templates").select("*").order("titulo");
    const { data: peds } = await sb.from("pedidos").select("*").order("created_at", { ascending: false });
    state.categorias = cats || [];
    state.templates = temps || [];
    state.pedidos = (peds || []).map(mapFromSBPedido);
    renderAll();
  }

  function listenRealtime(){
    const sb = state.supabase;
    // ouvindo inserts na tabela pedidos
    sb.channel("pedidos-inserts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pedidos" }, payload => {
        const ped = mapFromSBPedido(payload.new);
        state.pedidos.unshift(ped);
        renderPedidos();
        beep();
      }).subscribe();
  }

  function mapToSBPedido(p){
    return {
      destinatario: p.destinatario,
      remetentes: p.remetentes,
      endereco: p.endereco,
      cidade: p.cidade,
      dia: p.dia,
      hora: p.hora,
      link_musica_inicio: p.musica1,
      link_musica_final: p.musica2,
      mensagem: p.mensagem,
      categoria: p.categoria || null,
      template_titulo: p.templateTitulo || null,
      valor: p.valor,
      pix_key: p.pixKey,
      status: p.status || "novo"
    };
  }
  function mapFromSBPedido(r){
    return {
      id: r.id,
      created_at: r.created_at,
      destinatario: r.destinatario,
      remetentes: r.remetentes || [],
      endereco: r.endereco,
      cidade: r.cidade,
      dia: r.dia,
      hora: r.hora,
      musica1: r.link_musica_inicio,
      musica2: r.link_musica_final,
      mensagem: r.mensagem,
      categoria: r.categoria,
      templateTitulo: r.template_titulo,
      valor: r.valor,
      pixKey: r.pix_key,
      status: r.status || "novo"
    };
  }

  // ===== PIX (EMV "copia e cola") =====
  function removeAccents(str){ return str.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function emvField(id, value){
    const len = String(value.length).padStart(2,"0");
    return id + len + value;
  }
  function crc16(payload){
    // CRC16/CCITT-FALSE
    let crc = 0xFFFF;
    for(let i=0;i<payload.length;i++){
      crc ^= (payload.charCodeAt(i) << 8);
      for(let j=0;j<8;j++){
        if((crc & 0x8000) !== 0){
          crc = (crc << 1) ^ 0x1021;
        } else {
          crc <<= 1;
        }
        crc &= 0xFFFF;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4,"0");
  }
  function buildPixPayload({pixKey, amount, nome, cidade, descricao}){
    // Campos básicos (estáticos/dinâmicos simples)
    const gui = emvField("00","br.gov.bcb.pix");
    const chave = emvField("01", pixKey);
    const desc = descricao ? emvField("02", descricao.substring(0,25)) : ""; // opcional
    const mai = emvField("26", gui + chave + desc);

    const payload = [
      emvField("00","01"),
      emvField("01","12"),
      mai,
      emvField("52","0000"),
      emvField("53","986"),
      amount ? emvField("54", String(Number(amount).toFixed(2))) : "",
      emvField("58","BR"),
      emvField("59",(nome||"DISCO MENSAGEM").substring(0,25)),
      emvField("60", removeAccents((cidade||"PARAGUACU PAULISTA").toUpperCase()).substring(0,15)),
      emvField("62", emvField("05","DM"))
    ].join("");
    const toCRC = payload + "6304";
    const crc = crc16(toCRC);
    return toCRC + crc;
  }
  function renderQR(payload){
    const el = $("#qrContainer");
    const url = "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" + encodeURIComponent(payload);
    el.innerHTML = `<img src="${url}" alt="QR Pix" width="220" height="220"/>`;
  }

  // ===== Cliente UI =====
  function initCliente(){
    $("#cidadePadraoLabel").textContent = cfg.cidadePadrao;
    $("#cidadePadraoLabel2").textContent = cfg.cidadePadrao;
    $("#pixKey").value = cfg.pixKey;
    $("#pixValor").value = fmtMoney(cfg.precoPadrao);
    $("#valorLabel").textContent = fmtMoney(cfg.precoPadrao);

    $("#selCategoria").innerHTML = "";
    state.categorias.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id || c.nome; opt.textContent = c.nome;
      $("#selCategoria").appendChild(opt);
    });
    loadTemplatesForSelectedCategory();

    $("#btnRecarregarModelos").onclick = () => {
      renderCategorias();
      loadTemplatesForSelectedCategory();
    };
    $("#selCategoria").onchange = loadTemplatesForSelectedCategory;
    $("#btnVerTemplate").onclick = () => {
      const t = getSelectedTemplate();
      const preview = $("#previewTemplate");
      if(!t){ toast("Escolha um modelo."); return; }
      preview.classList.remove("hidden");
      preview.innerHTML = `<h4 style="margin:4px 0">${t.titulo}</h4><div style="white-space:pre-wrap">${t.conteudo}</div>`;
    };
    $("#btnCalcularPix").onclick = calcPix;
    $("#btnCopiar").onclick = () => {
      navigator.clipboard.writeText($("#pixCopiaCola").value||"");
      toast("Pix copia e cola copiado!");
    };
    $("#btnEnviar").onclick = enviarPedido;
  }

  function getSelectedTemplate(){
    const id = $("#selTemplate").value;
    return state.templates.find(t => (t.id||t.titulo) == id);
  }
  function loadTemplatesForSelectedCategory(){
    const catId = $("#selCategoria").value;
    $("#selTemplate").innerHTML = "";
    const temps = state.templates.filter(t => (t.categoria_id||t.categoria) == catId || t.categoria == $("#selCategoria").selectedOptions[0]?.textContent);
    temps.forEach(t => {
      const opt = document.createElement("option");
      opt.value = t.id || t.titulo;
      opt.textContent = t.titulo;
      $("#selTemplate").appendChild(opt);
    });
  }
  function calcPix(){
    const cidade = ($("#cidade").value || "").trim();
    const isPadrao = cidade.length===0 || cidade.toLowerCase() === (cfg.cidadePadrao||"").toLowerCase();
    const valor = isPadrao ? Number(cfg.precoPadrao||0) : 0;
    $("#pixKey").value = cfg.pixKey;
    $("#pixValor").value = valor ? fmtMoney(valor) : "Consultar";
    const payload = buildPixPayload({
      pixKey: cfg.pixKey,
      amount: valor || undefined,
      nome: "DISK MENSAGEM STUDIO NM",
      cidade: cfg.cidadePadrao,
      descricao: "Pedido DM"
    });
    $("#pixCopiaCola").value = payload;
    renderQR(payload);
  }

  async function enviarPedido(){
    const p = {
      id: "local_" + Date.now(),
      created_at: new Date().toISOString(),
      destinatario: $("#destinatario").value.trim(),
      remetentes: ($("#remetentes").value||"").split(",").map(s=>s.trim()).filter(Boolean),
      endereco: $("#endereco").value.trim(),
      cidade: $("#cidade").value.trim() || cfg.cidadePadrao,
      dia: $("#dia").value,
      hora: $("#hora").value,
      musica1: $("#musica1").value.trim(),
      musica2: $("#musica2").value.trim(),
      mensagem: $("#mensagem").value.trim(),
      categoria: $("#selCategoria").selectedOptions[0]?.textContent || null,
      templateTitulo: $("#selTemplate").selectedOptions[0]?.textContent || null,
      valor: ($("#pixValor").value.includes("Consultar")? null : Number(cfg.precoPadrao||0)),
      pixKey: cfg.pixKey,
      status: "novo"
    };
    if(!p.destinatario || !p.endereco || !p.dia || !p.hora){
      toast("Preencha destinatário, endereço, dia e hora."); return;
    }
    if(state.useSupabase){
      const sb = state.supabase;
      const { data, error } = await sb.from("pedidos").insert([mapToSBPedido(p)]).select().single();
      if(error){ console.error(error); toast("Erro ao enviar pedido."); return; }
      toast("Pedido enviado!");
    } else {
      state.pedidos.unshift(p);
      saveLocal();
      toast("Pedido enviado (modo local). Abra o Admin neste mesmo computador para ver.");
      // dispara evento local (para outra aba)
      try { localStorage.setItem("dm_ping", String(Date.now())); } catch(e){}
    }
    // limpa
    $("#mensagem").value = "";
  }

  // ===== Admin UI =====
  function initAdmin(){
    $("#btnEntrar").onclick = () => {
      const pass = $("#adminPass").value;
      if(pass === cfg.adminPassword){
        state.logged = true;
        $("#adminLogin").classList.add("hidden");
        $("#adminApp").classList.remove("hidden");
        renderAll();
      } else {
        toast("Senha incorreta.");
      }
    };
    $("#btnSair").onclick = () => { state.logged = false; $("#adminApp").classList.add("hidden"); $("#adminLogin").classList.remove("hidden"); };

    $("#btnSom").onclick = () => {
      state.som = !state.som;
      $("#somStatus").textContent = state.som ? "ON" : "OFF";
    };

    // subtabs
    const t1 = $("#tabPedidos"), t2 = $("#tabModelos"), t3 = $("#tabConfig");
    const v1 = $("#viewPedidos"), v2 = $("#viewModelos"), v3 = $("#viewConfig");
    t1.onclick = ()=>{ t1.classList.add("active"); t2.classList.remove("active"); t3.classList.remove("active"); v1.classList.remove("hidden"); v2.classList.add("hidden"); v3.classList.add("hidden"); };
    t2.onclick = ()=>{ t2.classList.add("active"); t1.classList.remove("active"); t3.classList.remove("active"); v2.classList.remove("hidden"); v1.classList.add("hidden"); v3.classList.add("hidden"); renderCategorias(); renderTemplates(); };
    t3.onclick = ()=>{ t3.classList.add("active"); t1.classList.remove("active"); t2.classList.remove("active"); v3.classList.remove("hidden"); v1.classList.add("hidden"); v2.classList.add("hidden"); renderConfig(); };

    $("#btnAtualizar").onclick = renderPedidos;
    $("#btnAddCategoria").onclick = addCategoria;
    $("#btnSalvarTemplate").onclick = salvarTemplate;
    $("#btnExcluirTemplate").onclick = excluirTemplate;
    $("#btnSalvarCfg").onclick = salvarConfig;

    // ouvir eventos de nova aba (modo local)
    window.addEventListener("storage", (e)=>{
      if(e.key==="dm_pedidos" || e.key==="dm_ping"){
        loadLocal(); renderPedidos(); beep();
      }
    });
  }

  function renderAll(){
    initCliente(); // repopula selects
    renderPedidos();
    renderCategorias();
    renderTemplates();
    renderConfig();
  }

  function renderPedidos(){
    const tbody = $("#tbPedidos");
    tbody.innerHTML = "";
    const filtro = $("#filtroData").value;
    const arr = state.pedidos.filter(p => !filtro || p.dia === filtro);
    arr.forEach(p => {
      const tr = document.createElement("tr");
      const quando = new Date(p.created_at || Date.now()).toLocaleString("pt-BR");
      tr.innerHTML = `
        <td><small>${quando}</small></td>
        <td>${p.destinatario}</td>
        <td><small>${(p.remetentes||[]).join(", ")}</small></td>
        <td><small>${p.endereco}</small></td>
        <td>${p.dia} ${p.hora||""}</td>
        <td>${p.cidade||""}</td>
        <td>${p.valor? fmtMoney(p.valor): "-"}</td>
        <td><span class="status ${p.status}">${p.status}</span></td>
        <td>
          <button class="secondary" data-act="ver" data-id="${p.id}">Ver</button>
          <button class="secondary" data-act="agendar" data-id="${p.id}">Agendar</button>
          <button class="secondary" data-act="entregar" data-id="${p.id}">Entregue</button>
          <button class="danger" data-act="cancelar" data-id="${p.id}">Cancelar</button>
        
          <button class="secondary" data-act="word" data-id="${p.id}">Word</button>
          <button class="secondary" data-act="imprimir" data-id="${p.id}">Imprimir</button>
          <button class="danger" data-act="excluir" data-id="${p.id}">Excluir</button>
          ${p.musica1 ? `<button class="secondary" data-act="yt1" data-id="${p.id}">Música 1</button>` : ""}
          ${p.musica2 ? `<button class="secondary" data-act="yt2" data-id="${p.id}">Música 2</button>` : ""}
        </td>`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll("button").forEach(btn => {
      btn.onclick = async (e) => {
        const id = btn.getAttribute("data-id");
        const act = btn.getAttribute("data-act");
        const p = state.pedidos.find(x => String(x.id) === String(id));
        if(!p) return;
        if(act==="ver"){ 
          verPedido(p);
        } else if(act==="word"){
          exportPedidoToWord(p);
        } else if(act==="imprimir"){
          printPedido(p);
        } else if(act==="yt1"){
          abrirMusica(p.musica1);
        } else if(act==="yt2"){
          abrirMusica(p.musica2);
        
        } else if(act==="excluir"){
          const ok = confirm("Excluir este pedido definitivamente?");
          if(!ok) return;
          if(state.useSupabase){
            const { error } = await state.supabase.from("pedidos").delete().eq("id", p.id);
            if(error){ console.error(error); toast("Erro ao excluir."); return; }
            // Remove local e atualizar UI
            state.pedidos = state.pedidos.filter(x => x.id !== p.id);
            renderPedidos();
            toast("Pedido excluído.");
          } else {
            // LocalStorage
            state.pedidos = state.pedidos.filter(x => x.id !== p.id);
            saveLocal(); 
            renderPedidos();
            toast("Pedido excluído.");
          }
        } else {
          p.status = (act==="agendar"?"agendado": act==="entregar"?"entregue":"cancelado");
          if(state.useSupabase){
            const { error } = await state.supabase.from("pedidos").update({ status: p.status }).eq("id", p.id);
            if(error){ console.error(error); toast("Erro ao atualizar."); }
          } else {
            saveLocal(); renderPedidos();
          }
        }
      };
    });
  }

  function verPedido(p){
    const msg = `
Destinatário: ${p.destinatario}
Remetentes: ${(p.remetentes||[]).join(", ")}
Endereço: ${p.endereco} — ${p.cidade||""}
Dia/Hora: ${p.dia} ${p.hora||""}
Música 1: ${p.musica1||"-"}
Música 2: ${p.musica2||"-"}
Modelo: ${p.templateTitulo||"-"}
Mensagem:
${p.mensagem||"(usou modelo)"}    
`;
    const play = confirm(msg + "\n\nTocar trecho da 1ª música?");
    if(play){
      tocarTrecho(p.musica1);
    }
  }
  function tocarTrecho(url){
    if(!url){ toast("Sem link."); return; }
    const a = new Audio(url);
    a.play().catch(()=>{
      window.open(url, "_blank");
    });
    // parar após 30s
    setTimeout(()=>{ try { a.pause(); a.currentTime = 0; } catch(e){} }, 30000);
  }

  
  // ===== Exportar / Imprimir Pedido =====
  function htmlPedido(p){
    const safe = (v) => (v||"").toString().replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    const link1 = p.musica1 ? `<a href="${safe(p.musica1)}">${safe(p.musica1)}</a>` : "-";
    const link2 = p.musica2 ? `<a href="${safe(p.musica2)}">${safe(p.musica2)}</a>` : "-";
    return `
      <div style="font-family: Arial, sans-serif; line-height:1.35">
        <h1 style="margin:0 0 12px 0; font-size:20pt;">Pedido - ${safe(cfg.projectName||"Disk Mensagem")}</h1>
        <p style="margin:0 0 8px 0;"><b>Data do pedido:</b> ${new Date(p.created_at||Date.now()).toLocaleString("pt-BR")}</p>
        <table style="border-collapse:collapse; width:100%; font-size:12pt;" border="1" cellspacing="0" cellpadding="6">
          <tr><td><b>Destinatário</b></td><td>${safe(p.destinatario)}</td></tr>
          <tr><td><b>Remetentes</b></td><td>${safe((p.remetentes||[]).join(", "))}</td></tr>
          <tr><td><b>Endereço</b></td><td>${safe(p.endereco)} — ${safe(p.cidade||"")}</td></tr>
          <tr><td><b>Dia/Hora</b></td><td>${safe(p.dia||"")} ${safe(p.hora||"")}</td></tr>
          <tr><td><b>Modelo</b></td><td>${safe(p.templateTitulo||"-")}</td></tr>
          <tr><td><b>Mensagem</b></td><td>${(p.mensagem||"(usou modelo)").replace(/\n/g,"<br/>")}</td></tr>
          <tr><td><b>Música 1</b></td><td>${link1}</td></tr>
          <tr><td><b>Música 2</b></td><td>${link2}</td></tr>
          <tr><td><b>Valor</b></td><td>${p.valor? fmtMoney(p.valor): "-"}</td></tr>
          <tr><td><b>Status</b></td><td>${safe(p.status||"novo")}</td></tr>
        </table>
        <p style="margin-top:10px; font-size:10pt; color:#555">Links acima são clicáveis. Ao abrir este arquivo no Word, os links devem abrir no navegador.</p>
      </div>`;
  }
  function exportPedidoToWord(p){
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${htmlPedido(p)}</body></html>`;
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const name = `pedido-${(p.destinatario||"destinatario").replace(/[^a-z0-9\-]+/gi,"-")}-${(p.dia||"").replace(/[^0-9\-]/g,"")}.doc`;
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 500);
  }
  function printPedido(p){
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Imprimir Pedido</title></head><body>${htmlPedido(p)}<script>setTimeout(()=>window.print(), 200);<\/script></body></html>`;
    const w = window.open("", "_blank");
    if(!w){ alert("Permita pop-ups para imprimir."); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }
  function abrirMusica(url){
    if(!url){ toast("Sem link."); return; }
    try { window.open(url, "_blank"); } catch(e){ toast("Não foi possível abrir o link."); }
  }

// ===== Modelos (Categorias + Templates) =====
  function renderCategorias(){
    // preencher selects/listas a partir do state
    const lc = $("#listaCategorias"); lc.innerHTML = "";
    const sel1 = $("#selCategoria"); sel1.innerHTML = "";
    const sel2 = $("#templateCategoria"); sel2.innerHTML = "";

    state.categorias.forEach(c => {
      // lista
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `<div>${c.nome}</div>
        <div class="row">
          <button class="secondary" data-act="ren" data-id="${c.id||c.nome}">Renomear</button>
          <button class="danger" data-act="del" data-id="${c.id||c.nome}">Excluir</button>
        </div>`;
      lc.appendChild(div);
      // selects
      const opt = document.createElement("option");
      opt.value = c.id || c.nome; opt.textContent = c.nome;
      sel1.appendChild(opt.cloneNode(true));
      sel2.appendChild(opt);
    });

    // ações
    lc.querySelectorAll("button").forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute("data-id");
        const act = btn.getAttribute("data-act");
        const c = state.categorias.find(x => (x.id||x.nome) == id);
        if(!c) return;
        if(act==="del"){
          if(!confirm("Excluir categoria e seus modelos?")) return;
          if(state.useSupabase){
            // excluir modelos também (on delete cascade se configurado); aqui forçamos
            await state.supabase.from("templates").delete().eq("categoria_id", c.id);
            await state.supabase.from("categorias").delete().eq("id", c.id);
          } else {
            state.templates = state.templates.filter(t => (t.categoria_id||t.categoria)!=(c.id||c.nome));
            state.categorias = state.categorias.filter(x => x!=(c));
            saveLocal();
          }
          renderCategorias(); renderTemplates();
        } else if(act==="ren"){
          const novo = prompt("Novo nome:", c.nome);
          if(!novo) return;
          if(state.useSupabase){
            await state.supabase.from("categorias").update({ nome: novo }).eq("id", c.id);
          } else {
            c.nome = novo; saveLocal();
          }
          renderCategorias();
        }
      };
    });
  }

  function addCategoria(){
    const nome = $("#novaCategoria").value.trim();
    if(!nome) return;
    if(state.useSupabase){
      state.supabase.from("categorias").insert([{ nome }]).then(()=> bootstrapSupabase());
    } else {
      state.categorias.push({ nome });
      saveLocal(); renderCategorias();
    }
    $("#novaCategoria").value = "";
  }

  function renderTemplates(){
    const wrap = $("#listaTemplates"); wrap.innerHTML = "";
    state.templates.forEach(t => {
      const catNome = state.categorias.find(c => (c.id||c.nome) == (t.categoria_id||t.categoria))?.nome || t.categoria || "-";
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `<div>
        <div style="font-weight:700">${t.titulo}</div>
        <small class="muted">${catNome}</small>
      </div>
      <div class="row">
        <button class="secondary" data-act="edit" data-id="${t.id||t.titulo}">Editar</button>
        <button class="danger" data-act="del" data-id="${t.id||t.titulo}">Excluir</button>
      </div>`;
      wrap.appendChild(div);
    });
    wrap.querySelectorAll("button").forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute("data-id");
        const act = btn.getAttribute("data-act");
        const t = state.templates.find(x => (x.id||x.titulo) == id);
        if(!t) return;
        if(act==="edit"){
          $("#templateTitulo").value = t.titulo;
          $("#templateCategoria").value = t.categoria_id || t.categoria;
          $("#templateConteudo").value = t.conteudo;
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else if(act==="del"){
          if(!confirm("Excluir modelo?")) return;
          if(state.useSupabase){
            await state.supabase.from("templates").delete().eq("id", t.id);
            bootstrapSupabase();
          } else {
            state.templates = state.templates.filter(x => x!=(t));
            saveLocal(); renderTemplates();
          }
        }
      };
    });
  }

  async function salvarTemplate(){
    const titulo = $("#templateTitulo").value.trim();
    const categoria = $("#templateCategoria").value || $("#templateCategoria").selectedOptions[0]?.textContent;
    const conteudo = $("#templateConteudo").value.trim();
    if(!titulo || !categoria || !conteudo){ toast("Preencha título, categoria e conteúdo."); return; }
    if(state.useSupabase){
      // descobrir ID de categoria pelo nome, se necessário
      let catId = categoria;
      const found = state.categorias.find(c => String(c.id)===String(categoria) || c.nome===categoria);
      if(found) catId = found.id;
      // upsert por título + categoria
      const existing = state.templates.find(t => t.titulo===titulo && (t.categoria_id===catId || t.categoria===categoria));
      if(existing){
        await state.supabase.from("templates").update({ titulo, conteudo, categoria_id: catId }).eq("id", existing.id);
      } else {
        await state.supabase.from("templates").insert([{ titulo, conteudo, categoria_id: catId }]);
      }
      bootstrapSupabase();
    } else {
      const existing = state.templates.find(t => t.titulo===titulo && (t.categoria===categoria));
      if(existing){
        existing.conteudo = conteudo;
      } else {
        state.templates.push({ titulo, conteudo, categoria });
      }
      saveLocal(); renderTemplates();
    }
    $("#templateTitulo").value = ""; $("#templateConteudo").value = "";
  }

  function excluirTemplate(){
    const titulo = $("#templateTitulo").value.trim();
    if(!titulo){ toast("Informe o título do modelo a excluir (carregue com Editar)."); return; }
    if(state.useSupabase){
      const t = state.templates.find(x => x.titulo===titulo);
      if(t){ state.supabase.from("templates").delete().eq("id", t.id).then(()=>bootstrapSupabase()); }
    } else {
      state.templates = state.templates.filter(t => t.titulo !== titulo);
      saveLocal(); renderTemplates();
    }
    $("#templateTitulo").value = ""; $("#templateConteudo").value = "";
  }

  // ===== Config =====
  function renderConfig(){
    $("#cfgCidade").value = cfg.cidadePadrao || "";
    $("#cfgValor").value = cfg.precoPadrao || 0;
    $("#cfgPix").value = cfg.pixKey || "";
  }
  function salvarConfig(){
    cfg.cidadePadrao = $("#cfgCidade").value.trim() || cfg.cidadePadrao;
    cfg.precoPadrao = Number($("#cfgValor").value) || cfg.precoPadrao;
    cfg.pixKey = $("#cfgPix").value.trim() || cfg.pixKey;
    initCliente(); // atualiza labels
    toast("Configurações atualizadas (somente neste dispositivo; para sincronizar use Supabase).");
  }

  // ===== Boot =====
  function boot(){
    setupTabs();
    loadLocal();
    initCliente();
    initAdmin();
    $("#filtroData").value = todayISO();
    renderPedidos();
    // Setup Supabase se configurado
    setupSupabase().catch(()=>{});
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
