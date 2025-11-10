// app.js - UI control (non-module), expects window.DB available
(function(){
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  const screens = { home: $('#home'), treinos: $('#treinos'), cadastro: $('#cadastro'), execucao: $('#execucao'), historico: $('#historico') };
  function show(screen){ Object.values(screens).forEach(s => s.classList.add('hidden')); screens[screen].classList.remove('hidden'); }

  // Home buttons
  $('#card-treinos').addEventListener('click', ()=> loadTreinos());
  $('#card-historico').addEventListener('click', ()=> loadHistorico());
  $('#card-progresso').addEventListener('click', ()=> alert('Tela de progresso (em breve)'));
  $('#btn-novo-treino').addEventListener('click', ()=> openCadastro());

  // Back buttons
  $$('.back').forEach(b=> b.addEventListener('click', ()=> show('home')));

  // Cadastro
  const formTreino = $('#form-treino');
  const listaExerciciosEl = $('#lista-exercicios');
  const templateEx = $('#template-exercicio').content;
  let editTreinoId = null;

  function clearForm(){ formTreino.reset(); listaExerciciosEl.innerHTML=''; editTreinoId = null; }

  async function openCadastro(treino=null){
    clearForm();
    if(treino){
      $('#cadastro-title').textContent = 'Editar Treino';
      editTreinoId = treino.id;
      $('#treino-nome').value = treino.nome;
      const exs = await DB.listarExerciciosDoTreino(treino.id);
      exs.forEach(e => addExercicioToForm(e));
    } else {
      $('#cadastro-title').textContent = 'Cadastrar Treino';
    }
    show('cadastro');
  }

  function addExercicioToForm(data = {}){
    const node = templateEx.cloneNode(true);
    const el = node.querySelector('.exercise-item');
    el.querySelector('.ex-nome').value = data.nome || '';
    el.querySelector('.ex-reps').value = data.repeticoes || '';
    el.querySelector('.ex-carga').value = data.carga || '';
    el.querySelector('.ex-remove').addEventListener('click', ()=> el.remove());
    listaExerciciosEl.appendChild(el);
  }

  $('#btn-add-exercicio').addEventListener('click', ()=> addExercicioToForm());

  formTreino.addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    const nome = $('#treino-nome').value.trim();
    if(!nome) return alert('Informe um nome para o treino');

    const items = $$('.exercise-item').map(node => ({
      nome: node.querySelector('.ex-nome').value.trim(),
      repeticoes: Number(node.querySelector('.ex-reps').value) || 0,
      carga: Number(node.querySelector('.ex-carga').value) || 0
    })).filter(e => e.nome);

    if(editTreinoId){
      await DB.atualizarTreino(editTreinoId, {nome});
      const old = await DB.listarExerciciosDoTreino(editTreinoId);
      await Promise.all(old.map(o => DB.db.exercicios.delete(o.id)));
      await Promise.all(items.map(i => DB.adicionarExercicio(editTreinoId, i)));
      alert('Treino atualizado');
    } else {
      const id = await DB.criarTreino({nome});
      await Promise.all(items.map(i => DB.adicionarExercicio(id, i)));
      alert('Treino salvo');
    }

    loadTreinos();
  });

  // Lista de treinos
  async function loadTreinos(){
    const lista = await DB.listarTreinos();
    const el = $('#lista-treinos'); el.innerHTML='';
    if(lista.length===0) el.innerHTML = '<p style="padding:12px;color:#666">Nenhum treino salvo</p>';
    for(const t of lista){
      const item = document.createElement('div');
      item.className = 'item-treino';
      item.innerHTML = `<div><strong>${t.nome}</strong><div class="muted">Criado em: ${new Date(t.criado_em).toLocaleString()}</div></div>
        <div class="item-actions">
          <button class="action-btn" data-id="${t.id}" data-action="run">▶</button>
          <button class="action-btn" data-id="${t.id}" data-action="edit">✎</button>
          <button class="action-btn" data-id="${t.id}" data-action="dup">⤾</button>
          <button class="action-btn" data-id="${t.id}" data-action="del">🗑</button>
        </div>`;
      el.appendChild(item);
    }

    $$('#lista-treinos .action-btn').forEach(btn=> btn.addEventListener('click', async (ev)=>{
      const id = Number(ev.currentTarget.dataset.id);
      const action = ev.currentTarget.dataset.action;
      if(action==='edit'){
        const t = (await DB.listarTreinos()).find(x=>x.id===id);
        openCadastro(t);
      } else if(action==='run'){
        abrirExecucao(id);
      } else if(action==='dup'){
        const t = (await DB.listarTreinos()).find(x=>x.id===id);
        const newId = await DB.criarTreino({nome: t.nome + ' (cópia)'});
        const exs = await DB.listarExerciciosDoTreino(id);
        await Promise.all(exs.map(e=> DB.adicionarExercicio(newId,{nome:e.nome,repeticoes:e.repeticoes,carga:e.carga})));
        loadTreinos();
      } else if(action==='del'){
        if(confirm('Excluir este treino?')){
          await DB.deletarTreino(id);
          loadTreinos();
        }
      }
    }));

    show('treinos');
  }

  // Execução
  async function abrirExecucao(treino_id){
    const treino = (await DB.listarTreinos()).find(x=>x.id===treino_id);
    const exs = await DB.listarExerciciosDoTreino(treino_id);
    const el = $('#exec-content'); el.innerHTML='';
    $('#exec-title').textContent = treino.nome;

    exs.forEach((e, idx) => {
      const block = document.createElement('div'); block.className='exec-block';
      block.innerHTML = `<div>
        <div class="exec-title">${idx+1}. ${e.nome}</div>
        <div class="muted">Base: ${e.repeticoes} reps · ${e.carga} kg</div>
      </div>
      <div class="exec-controls">
        <input type="number" class="input-number cur-reps" value="${e.repeticoes}" min="1" />
        <input type="number" class="input-number cur-carga" value="${e.carga}" min="0" step="0.5" />
      </div>`;
      block.dataset.baseId = e.id;
      el.appendChild(block);
    });

    $('#btn-finalizar-sessao').onclick = async ()=>{
      const blocks = $$('.exec-block');
      const items = blocks.map(b => ({
        nome: b.querySelector('.exec-title').textContent.replace(/^\d+\.\s*/,''),
        repeticoes: Number(b.querySelector('.cur-reps').value) || 0,
        carga: Number(b.querySelector('.cur-carga').value) || 0
      }));

      await DB.salvarSessao({treino_id}, items);

      if(confirm('Deseja atualizar o treino base com os números desta sessão?')){
        const baseEx = await DB.listarExerciciosDoTreino(treino_id);
        for(const it of items){
          const match = baseEx.find(b => b.nome === it.nome);
          if(match){
            await DB.db.exercicios.update(match.id, {repeticoes: it.repeticoes, carga: it.carga});
          }
        }
        alert('Treino base atualizado');
      }

      loadTreinos();
    };

    show('execucao');
  }

  // Histórico
  async function loadHistorico(){
    const sessoes = await DB.listarSessoes();
    const el = $('#lista-sessoes'); el.innerHTML='';
    if(sessoes.length===0) el.innerHTML = '<p style="padding:12px;color:#666">Sem sessões registradas</p>';
    for(const s of sessoes){
      const item = document.createElement('div');
      item.className = 'item-treino';
      const treino = await DB.db.treinos.get(s.treino_id);
      item.innerHTML = `<div><strong>${treino ? treino.nome : 'Treino'}</strong><div class="muted">${new Date(s.data).toLocaleString()}</div></div>
        <div class="item-actions"><button class="action-btn" data-id="${s.id}" data-action="view">👁</button></div>`;
      el.appendChild(item);
    }

    $$('#lista-sessoes .action-btn').forEach(b=> b.addEventListener('click', async ev=>{
      const id = Number(ev.currentTarget.dataset.id);
      const exs = await DB.listarExerciciosSessao(id);
      alert('Sessão: \n' + exs.map(x=> `${x.nome} — ${x.repeticoes} reps · ${x.carga} kg`).join('\n'));
    }));

    show('historico');
  }

  (async function init(){
    show('home');
  })();
})();
