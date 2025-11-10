// app.js — SPA router + UI (Material-inspired)
(function(){
  const root = document.getElementById('root');

  function el(tag, attrs={}, children=[]){
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k,v])=>{
      if(k==='class') node.className = v;
      else if(k==='html') node.innerHTML = v;
      else if(k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else node.setAttribute(k,v);
    });
    (Array.isArray(children)?children:[children]).flat().forEach(c=> {
      if(typeof c === 'string') node.appendChild(document.createTextNode(c));
      else if(c) node.appendChild(c);
    });
    return node;
  }

  // App shell
  function shell(content){
    const top = el('div',{class:'topbar'},['GymControl']);
    const main = el('main',{class:'content'},[content]);
    const container = el('div',{class:'app-shell'},[top, main]);
    return container;
  }

  // Home page
  function renderHome(){
    const grid = el('div',{class:'grid'},[
      card('🏋️','Meus Treinos', ()=>navigate('treinos')),
      card('📅','Histórico de Sessões', ()=>navigate('historico')),
      card('📊','Progresso', ()=>navigate('progresso'))
    ]);
    const fab = el('button',{class:'fab', onclick:()=>navigate('cadastro')},['＋']);
    const page = el('div',{class:''},[grid, fab]);
    return shell(page);
  }

  function card(icon, title, onClick){
    return el('div',{class:'card', onclick:onClick}, [
      el('div',{class:'icon'},[icon]),
      el('div',{class:'title'},[title])
    ]);
  }

  // Treinos list
  async function renderTreinos(){
    const header = el('h2',{},['Meus Treinos']);
    const list = el('div',{class:'list'},[]);
    const treinos = await window.DB.listarTreinos();
    if(treinos.length===0) list.appendChild(el('div',{},['Nenhum treino salvo']));
    for(const t of treinos){
      const left = el('div',{},[el('div',{},[t.nome]), el('div',{class:'muted'},[new Date(t.criado_em).toLocaleString()])]);
      const runBtn = el('button',{class:'btn ghost', onclick:()=>navigate('execucao', {treino_id:t.id})},['▶']);
      const editBtn = el('button',{class:'btn ghost', onclick:()=>navigate('cadastro',{treino_id:t.id})},['✎']);
      const dupBtn = el('button',{class:'btn ghost', onclick:async ()=>{ const newId = await window.DB.criarTreino({nome:t.nome+' (cópia)'}); const exs = await window.DB.listarExerciciosDoTreino(t.id); await Promise.all(exs.map(e=> window.DB.adicionarExercicio(newId,{nome:e.nome,repeticoes:e.repeticoes,carga:e.carga}))); renderRoute(); }},['⤾']);
      const delBtn = el('button',{class:'btn ghost', onclick:async ()=>{ if(confirm('Excluir treino?')){ await window.DB.deletarTreino(t.id); renderRoute(); }}},['🗑']);
      const item = el('div',{class:'item'},[left, el('div',{class:'btn-row'},[runBtn, editBtn, dupBtn, delBtn])]);
      list.appendChild(item);
    }
    const content = el('div',{},[header, list]);
    return shell(content);
  }

  // Cadastro (novo ou editar)
  async function renderCadastro(params={}){
    const treino = params.treino_id ? (await window.DB.listarTreinos()).find(x=>x.id===params.treino_id) : null;
    const title = treino ? 'Editar Treino' : 'Cadastrar Treino';
    const header = el('h2',{},[title]);

    const inputNome = el('input',{type:'text', id:'treino-nome', value: treino?treino.nome:''});
    const lista = el('div',{id:'lista-ex'},[]);
    async function loadExs(){
      lista.innerHTML='';
      if(treino){
        const exs = await window.DB.listarExerciciosDoTreino(treino.id);
        exs.forEach(e=> lista.appendChild(renderExRow(e)));
      }
    }
    function renderExRow(data={}) {
      const row = el('div',{class:'item'},[
        el('div',{},[ el('div',{},[ el('input',{type:'text', class:'ex-name', value:data.nome||'', placeholder:'Ex: Agachamento'}) ]) ]),
        el('div',{},[ el('input',{type:'number', class:'ex-reps', value:data.repeticoes||'', placeholder:'reps', min:0}), el('input',{type:'number', class:'ex-carga', value:data.carga||'', placeholder:'kg', min:0, step:0.5}), el('button',{class:'btn ghost', onclick:()=>row.remove()},['✖']) ])
      ]);
      return row;
    }

    const btnAdd = el('button',{class:'btn ghost', onclick:()=> lista.appendChild(renderExRow())},['Adicionar exercício']);
    const btnSave = el('button',{class:'btn primary', onclick: async ()=>{
      const nome = document.getElementById('treino-nome').value.trim();
      if(!nome) return alert('Nome obrigatório');
      const rows = Array.from(lista.querySelectorAll('.item'));
      const items = rows.map(r=>({
        nome: r.querySelector('.ex-name').value.trim(),
        repeticoes: Number(r.querySelector('.ex-reps').value) || 0,
        carga: Number(r.querySelector('.ex-carga').value) || 0
      })).filter(x=>x.nome);

      if(treino){
        await window.DB.atualizarTreino(treino.id, {nome});
        const old = await window.DB.listarExerciciosDoTreino(treino.id);
        await Promise.all(old.map(o=> window.DB.db.exercicios.delete(o.id)));
        await Promise.all(items.map(i=> window.DB.adicionarExercicio(treino.id, i)));
        alert('Atualizado');
        navigate('treinos');
      } else {
        const id = await window.DB.criarTreino({nome});
        await Promise.all(items.map(i=> window.DB.adicionarExercicio(id, i)));
        alert('Salvo');
        navigate('treinos');
      }
    }},['Salvar treino']);

    const content = el('div',{},[ header, el('div',{class:'form'},[
      el('div',{class:'field'},[ el('label',{},['Nome do treino']), inputNome ]),
      el('div',{},[ el('h3',{},['Exercícios']), lista, btnAdd ]),
      el('div',{class:'btn-row'},[btnSave, el('button',{class:'btn ghost', onclick:()=>navigate('treinos')},['Cancelar']) ])
    ])]);

    // if editing load exs
    if(treino) await loadExs();
    return shell(content);
  }

  // Execução
  async function renderExecucao(params){
    const treino_id = params.treino_id;
    const treino = (await window.DB.listarTreinos()).find(x=>x.id===treino_id);
    const exs = await window.DB.listarExerciciosDoTreino(treino_id);
    const header = el('h2',{},[treino?treino.nome:'Execução']);
    const container = el('div',{});
    exs.forEach((e, idx)=>{
      const block = el('div',{class:'exec-block'},[
        el('div',{},[el('div',{class:''},[ (idx+1)+'. '+e.nome ]), el('div',{class:'muted'},['Base: '+e.repeticoes+' reps · '+e.carga+' kg'])]),
        el('div',{},[ el('input',{type:'number', class:'input-small cur-reps', value:e.repeticoes, min:0}), el('input',{type:'number', class:'input-small cur-carga', value:e.carga, min:0, step:0.5}) ])
      ]);
      container.appendChild(block);
    });
    const btnFinish = el('button',{class:'btn primary', onclick: async ()=>{
      const blocks = Array.from(document.querySelectorAll('.exec-block'));
      const items = blocks.map(b=>({
        nome: b.querySelector('div').textContent.replace(/^\d+\.\s*/,'').trim(),
        repeticoes: Number(b.querySelector('.cur-reps').value) || 0,
        carga: Number(b.querySelector('.cur-carga').value) || 0
      }));
      await window.DB.salvarSessao({treino_id}, items);
      if(confirm('Deseja atualizar o treino base com os números desta sessão?')){
        const baseEx = await window.DB.listarExerciciosDoTreino(treino_id);
        for(const it of items){
          const match = baseEx.find(b=>b.nome===it.nome);
          if(match) await window.DB.db.exercicios.update(match.id, {repeticoes:it.repeticoes, carga:it.carga});
        }
        alert('Treino base atualizado');
      }
      navigate('treinos');
    }},['Finalizar sessão']);

    const content = el('div',{},[header, container, el('div',{style:'margin-top:12px'},[btnFinish, el('button',{class:'btn ghost', onclick:()=>navigate('treinos')},['Voltar'])])]);
    return shell(content);
  }

  // Historico
  async function renderHistorico(){
    const header = el('h2',{},['Histórico de sessões']);
    const list = el('div',{class:'list'},[]);
    const sessoes = await window.DB.listarSessoes();
    if(sessoes.length===0) list.appendChild(el('div',{},['Nenhuma sessão registrada']));
    for(const s of sessoes){
      const treino = await window.DB.db.treinos.get(s.treino_id);
      const left = el('div',{},[ el('div',{},[treino?treino.nome:'Treino']), el('div',{class:'muted'},[new Date(s.data).toLocaleString()]) ]);
      const viewBtn = el('button',{class:'btn ghost', onclick: async ()=>{ const exs = await window.DB.listarExerciciosSessao(s.id); alert(exs.map(x=>`${x.nome} — ${x.repeticoes} reps · ${x.carga} kg`).join('\n')); }},['👁']);
      const item = el('div',{class:'item'},[left, viewBtn]);
      list.appendChild(item);
    }
    return shell(el('div',{},[header, list]));
  }

  // Progress (placeholder)
  function renderProgress(){
    return shell(el('div',{},[ el('h2',{},['Progresso']), el('p',{},['Gráficos em breve']) ]));
  }

  // Router
  const routes = {
    'home': renderHome,
    'treinos': renderTreinos,
    'cadastro': renderCadastro,
    'execucao': renderExecucao,
    'historico': renderHistorico,
    'progresso': renderProgress
  };

  function navigate(route, params={}){
    history.pushState({route, params}, '', '#'+route);
    renderRoute();
  }

  async function renderRoute(){
    const hash = location.hash.replace('#','') || 'home';
    const [route, _q] = hash.split('?');
    const fn = routes[route] || renderHome;
    const state = history.state || {};
    const params = state.params || {};
    const content = await fn(params);
    root.innerHTML = '';
    root.appendChild(content);
  }

  window.addEventListener('popstate', renderRoute);
  // initial render
  renderRoute();
})();
