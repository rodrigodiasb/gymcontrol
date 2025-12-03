// js/app.js - SPA GymControl (sem séries, com Backup, Play na lista e marcação de exercício realizado)
(function () {
  const root = document.getElementById('root');

  // ---------- helpers de DOM ----------
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    attrs = attrs || {};
    children = children || [];

    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function')
        node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    });

    (Array.isArray(children) ? children : [children])
      .filter(Boolean)
      .forEach((c) => {
        if (typeof c === 'string')
          node.appendChild(document.createTextNode(c));
        else
          node.appendChild(c);
      });

    return node;
  }

  function shell(content) {
    const top = el('header', { class: 'topbar' }, [
      el('h1', { class: 'logo-clickable', onclick: () => navigate('home') }, 'GymControl')
    ]);
    const main = el('main', { class: 'content' }, [content]);
    return el('div', { class: 'app-shell' }, [top, main]);
  }

  function card(emoji, title, onClick, subtitle) {
    return el('div', { class: 'card', onclick: onClick }, [
      el('div', { class: 'card-emoji' }, [emoji]),
      el('div', { class: 'card-title' }, [title]),
      subtitle ? el('div', { class: 'muted' }, [subtitle]) : null
    ]);
  }

  function formatDate(dateStr, withTime) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      ...(withTime
        ? { hour: '2-digit', minute: '2-digit' }
        : {})
    });
  }

  // ---------- navegação ----------
  const routes = {
    home: renderHome,
    treinos: renderTreinos,
    treino: renderTreino,
    execucao: renderExecucao,
    historico: renderHistorico,
    sessao: renderSessao,
    config: renderConfig
  };

  function navigate(route, params) {
    params = params || {};
    const query = new URLSearchParams(params).toString();
    const hash = '#' + route + (query ? '?' + query : '');
    history.pushState(params, '', hash);
    renderRoute();
  }

  async function renderRoute() {
    const raw = location.hash.slice(1) || 'home';
    const [route, queryString] = raw.split('?');
    const fn = routes[route] || renderHome;
    const params = {};
    if (queryString) {
      const usp = new URLSearchParams(queryString);
      usp.forEach((v, k) => {
        params[k] = v;
      });
    }

    const view = await fn(params);
    root.innerHTML = '';
    root.appendChild(shell(view));
  }

  window.addEventListener('popstate', renderRoute);

  // ---------- views ----------
  function renderHome() {
    const grid = el('div', { class: 'grid' }, [
      card('🏋️', 'Meus treinos', () => navigate('treinos')),
      card('📅', 'Histórico de sessões', () => navigate('historico')),
      card('☁️', 'Backup & Configurações', () => navigate('config'), 'Exportar / importar dados')
    ]);

    return el('div', {}, [
      el('p', { class: 'muted' }, [
        'Cadastre seus treinos, execute e acompanhe sua evolução.'
      ]),
      grid
    ]);
  }

  // ----- lista de treinos -----
  async function renderTreinos() {
    const treinos = await window.DB.listarTreinos();

    const list = treinos.length
      ? treinos.map((t) => {
          const title = el('div', {
            class: 'card-title card-title-link',
            onclick: () => navigate('treino', { id: t.id })
          }, [t.nome]);

          const playBtn = el('button', {
            class: 'btn icon-btn',
            onclick: (ev) => {
              ev.stopPropagation();
              navigate('execucao', { treino_id: t.id });
            }
          }, ['▶']);

          const headerRow = el('div', { class: 'card-header-row' }, [
            title,
            playBtn
          ]);

          return el('div', { class: 'card' }, [
            headerRow,
            el('div', { class: 'muted' }, [
              `Criado em ${formatDate(t.criado_em)}`
            ])
          ]);
        })
      : el('p', { class: 'muted' }, [
          'Nenhum treino cadastrado ainda.'
        ]);

    const fab = el('button', {
      class: 'fab',
      onclick: () => navigate('treino')
    }, ['+']);

    return el('div', {}, [
      el('h2', {}, ['Meus treinos']),
      ...(Array.isArray(list) ? list : [list]),
      fab
    ]);
  }

  // ----- cadastro/edição de treino -----
  async function renderTreino(params) {
    const treinoId = params.id ? Number(params.id) : null;
    const editMode = !!treinoId;
    const treino = editMode
      ? await window.DB.obterTreino(treinoId)
      : null;
    const exercicios = editMode
      ? await window.DB.listarExerciciosDoTreino(treinoId)
      : [];

    const nomeInput = el('input', {
      type: 'text',
      class: 'input',
      value: treino ? treino.nome : '',
      placeholder: 'Nome do treino (ex: Treino A)'
    });

    const exContainer = el('div', { class: 'stack' }, []);

    function addExRow(ex) {
      ex = ex || { id: null, nome: '', repeticoes: 10, carga: 0, observacao: '' };
      const row = el('div', { class: 'card ex-row' }, []);
      if (ex.id) row.dataset.exId = ex.id;

      const nome = el('input', {
        type: 'text',
        class: 'input ex-nome',
        value: ex.nome,
        placeholder: 'Exercício (ex: Supino reto)'
      });

      const reps = el('input', {
        type: 'number',
        class: 'input-small ex-reps',
        value: ex.repeticoes || 0,
        min: 0
      });

      const carga = el('input', {
        type: 'number',
        class: 'input-small ex-carga',
        value: ex.carga || 0,
        min: 0,
        step: 0.5
      });

      const obs = el('input', {
        type: 'text',
        class: 'input ex-obs',
        value: ex.observacao || '',
        placeholder: 'Observação (opcional)'
      });

      const btnDel = el('button', {
        class: 'btn ghost',
        onclick: () => row.remove()
      }, ['Remover']);

      const topLine = el('div', { class: 'btn-row' }, [
        nome
      ]);
      const midLine = el('div', { class: 'btn-row' }, [
        el('span', {}, ['Reps: ']),
        reps,
        el('span', {}, ['Kg: ']),
        carga
      ]);
      const bottomLine = el('div', { class: 'btn-row' }, [
        obs,
        btnDel
      ]);

      row.appendChild(topLine);
      row.appendChild(midLine);
      row.appendChild(bottomLine);
      exContainer.appendChild(row);
    }

    exercicios.forEach(addExRow);
    if (!exercicios.length) addExRow();

    const btnAddEx = el('button', {
      class: 'btn ghost',
      onclick: () => addExRow()
    }, ['Adicionar exercício']);

    const btnSalvar = el('button', {
      class: 'btn primary',
      onclick: async () => {
        const nomeTreino = nomeInput.value.trim();
        if (!nomeTreino) {
          alert('Digite o nome do treino.');
          return;
        }

        const rows = Array.from(exContainer.querySelectorAll('.ex-row'));
        const data = rows.map((r) => ({
          id: r.dataset.exId ? Number(r.dataset.exId) : null,
          nome: r.querySelector('.ex-nome').value.trim(),
          repeticoes: Number(r.querySelector('.ex-reps').value) || 0,
          carga: Number(r.querySelector('.ex-carga').value) || 0,
          observacao: r.querySelector('.ex-obs').value.trim()
        })).filter((x) => x.nome);

        if (!data.length) {
          alert('Cadastre pelo menos um exercício.');
          return;
        }

        let id = treinoId;
        if (!editMode) {
          id = await window.DB.criarTreino({ nome: nomeTreino });
        } else {
          await window.DB.atualizarTreino(treinoId, { nome: nomeTreino });
        }

        // limpar exercícios removidos
        if (editMode) {
          const existentes = await window.DB.listarExerciciosDoTreino(id);
          const idsMantidos = data.filter(d => d.id).map(d => d.id);
          const idsRemover = existentes
            .filter(e => !idsMantidos.includes(e.id))
            .map(e => e.id);
          for (const exId of idsRemover) {
            await window.DB.removerExercicio(exId);
          }
        }

        // salvar/atualizar exercícios
        for (const ex of data) {
          const payload = {
            nome: ex.nome,
            repeticoes: ex.repeticoes,
            carga: ex.carga,
            observacao: ex.observacao
          };
          if (ex.id) {
            await window.DB.atualizarExercicio(ex.id, payload);
          } else {
            await window.DB.adicionarExercicio(id, payload);
          }
        }

        alert('Treino salvo com sucesso!');
        navigate('treinos');
      }
    }, ['Salvar treino']);

    const btnExecutar = editMode
      ? el('button', {
          class: 'btn ghost',
          onclick: () => navigate('execucao', { treino_id: treinoId })
        }, ['Executar treino'])
      : null;

    const btnExcluir = editMode
      ? el('button', {
          class: 'btn ghost',
          onclick: async () => {
            if (confirm('Deseja realmente excluir este treino?')) {
              await window.DB.excluirTreino(treinoId);
              alert('Treino excluído.');
              navigate('treinos');
            }
          }
        }, ['Excluir treino'])
      : null;

    const actions = el('div', { class: 'btn-row btn-row-wrap' }, [
      btnSalvar,
      btnExecutar,
      btnExcluir
    ]);

    return el('div', {}, [
      el('h2', {}, [editMode ? 'Editar treino' : 'Novo treino']),
      nomeInput,
      el('h3', {}, ['Exercícios']),
      exContainer,
      btnAddEx,
      actions
    ]);
  }

  // ----- execução de treino -----
  async function renderExecucao(params) {
    const treinoId = Number(params.treino_id);
    if (!treinoId) {
      return el('p', { class: 'muted' }, [
        'Treino não encontrado.'
      ]);
    }

    const treino = await window.DB.obterTreino(treinoId);
    const exercicios = await window.DB.listarExerciciosDoTreino(treinoId);

    if (!treino) {
      return el('p', { class: 'muted' }, [
        'Treino não encontrado.'
      ]);
    }

    if (!exercicios.length) {
      return el('div', {}, [
        el('h2', {}, [treino.nome]),
        el('p', { class: 'muted' }, [
          'Este treino ainda não possui exercícios cadastrados.'
        ])
      ]);
    }

    const blocks = exercicios.map((e, idx) => {
      const block = el('div', {
        class: 'exec-block',
        'data-ex-id': e.id
      }, []);

      const statusPill = el('span', { class: 'badge' }, ['Em andamento']);

      const nameLine = el('div', { class: 'exec-name-row' }, [
        el('div', { class: 'exec-name' }, [`${idx + 1}. ${e.nome}`]),
        statusPill
      ]);

      const baseLine = el('div', { class: 'muted exec-base' }, [
        `Base: ${e.repeticoes || 0} reps · ${e.carga || 0} kg`
      ]);

      const repsInput = el('input', {
        type: 'number',
        class: 'input-small cur-reps',
        value: e.repeticoes || 0,
        min: 0
      });

      const cargaInput = el('input', {
        type: 'number',
        class: 'input-small cur-carga',
        value: e.carga || 0,
        min: 0,
        step: 0.5
      });

      const doneBtn = el('button', {
        class: 'btn secondary btn-done',
        onclick: () => {
          const done = block.classList.toggle('done');
          statusPill.textContent = done ? 'Concluído' : 'Em andamento';
        }
      }, ['Realizado!']);

      const actions = el('div', { class: 'exec-actions' }, [
        el('div', { class: 'exec-inputs' }, [
          el('label', { class: 'exec-label' }, ['Reps']),
          repsInput,
          el('label', { class: 'exec-label' }, ['Kg']),
          cargaInput
        ]),
        doneBtn
      ]);

      block.appendChild(nameLine);
      block.appendChild(baseLine);
      block.appendChild(actions);
      return block;
    });

    const container = el('div', {}, [
      el('h2', {}, [`Execução - ${treino.nome}`]),
      ...blocks
    ]);

    const btnFinalizar = el('button', {
      class: 'btn primary btn-full',
      onclick: async () => {
        const blocksEls = Array.from(container.querySelectorAll('.exec-block'));
        const items = blocksEls.map((b) => ({
          exercicio_id: Number(b.dataset.exId),
          nome: b.querySelector('.exec-name')
            .textContent
            .replace(/^\d+\.\s*/, '')
            .trim(),
          repeticoes: Number(b.querySelector('.cur-reps').value) || 0,
          carga: Number(b.querySelector('.cur-carga').value) || 0
        }));

        await window.DB.salvarSessao({ treino_id: treinoId }, items);

        if (confirm('Deseja atualizar o treino base com os números desta sessão?')) {
          // Atualiza pelo ID do exercício
          for (const it of items) {
            if (!it.exercicio_id) continue;
            await window.DB.atualizarExercicio(it.exercicio_id, {
              repeticoes: it.repeticoes,
              carga: it.carga
            });
          }
          alert('Treino base atualizado.');
        }

        alert('Sessão salva com sucesso!');
        navigate('home');
      }
    }, ['Finalizar sessão']);

    container.appendChild(el('div', { class: 'btn-row' }, [btnFinalizar]));
    return container;
  }

  // ----- histórico de sessões -----
  async function renderHistorico() {
    const sessoes = await window.DB.listarSessoes();
    if (!sessoes.length) {
      return el('div', {}, [
        el('h2', {}, ['Histórico de sessões']),
        el('p', { class: 'muted' }, [
          'Você ainda não registrou nenhuma sessão.'
        ])
      ]);
    }

    const treinos = await window.DB.listarTreinos();
    const mapTreinos = new Map(treinos.map(t => [t.id, t]));

    const list = sessoes.map((s) => {
      const treino = mapTreinos.get(s.treino_id);
      return el('div', {
        class: 'card',
        onclick: () => navigate('sessao', { id: s.id })
      }, [
        el('div', { class: 'card-title' }, [
          treino ? treino.nome : 'Treino removido'
        ]),
        el('div', { class: 'muted' }, [
          formatDate(s.data, true)
        ])
      ]);
    });

    return el('div', {}, [
      el('h2', {}, ['Histórico de sessões']),
      ...list
    ]);
  }

  // ----- detalhe de sessão -----
  async function renderSessao(params) {
    const sessaoId = params.id ? Number(params.id) : null;
    if (!sessaoId) {
      return el('p', { class: 'muted' }, ['Sessão não encontrada.']);
    }

    const exercicios = await window.DB.listarExerciciosSessao(sessaoId);
    if (!exercicios.length) {
      return el('p', { class: 'muted' }, ['Sessão sem exercícios.']);
    }

    const list = exercicios.map((e) =>
      el('div', { class: 'card' }, [
        el('div', { class: 'card-title' }, [e.nome]),
        el('div', { class: 'muted' }, [
          `${e.repeticoes || 0} reps · ${e.carga || 0} kg`
        ])
      ])
    );

    return el('div', {}, [
      el('h2', {}, ['Sessão']),
      ...list
    ]);
  }

  // ----- Backup & Configurações -----
  function renderConfig() {
    const db = window.DB.db;

    const info = el('p', { class: 'muted' }, [
      'Aqui você pode exportar todos os seus dados (treinos, exercícios e sessões) para um arquivo JSON e importar em outro dispositivo.'
    ]);

    const btnExport = el('button', {
      class: 'btn primary btn-full',
      onclick: async () => {
        try {
          const [treinos, exercicios, sessoes, sessoes_exercicios] = await Promise.all([
            db.treinos.toArray(),
            db.exercicios.toArray(),
            db.sessoes.toArray(),
            db.sessoes_exercicios.toArray()
          ]);

          const payload = {
            version: 1,
            exportedAt: new Date().toISOString(),
            treinos,
            exercicios,
            sessoes,
            sessoes_exercicios
          };

          const blob = new Blob(
            [JSON.stringify(payload, null, 2)],
            { type: 'application/json' }
          );
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'gymcontrol-backup.json';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (err) {
          console.error(err);
          alert('Erro ao exportar dados. Verifique o console para mais detalhes.');
        }
      }
    }, ['Exportar dados (JSON)']);

    const fileInput = el('input', {
      type: 'file',
      accept: 'application/json',
      style: 'display:none'
    });

    fileInput.addEventListener('change', async (ev) => {
      const file = ev.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target.result;
          const data = JSON.parse(text);

          if (!data || typeof data !== 'object' || !Array.isArray(data.treinos)) {
            alert('Arquivo inválido ou em formato inesperado.');
            return;
          }

          const confirmar = confirm(
            'A importação irá SUBSTITUIR todos os dados atuais (treinos, exercícios e sessões) pelos dados do arquivo. Deseja continuar?'
          );
          if (!confirmar) return;

          await db.transaction('rw',
            db.treinos,
            db.exercicios,
            db.sessoes,
            db.sessoes_exercicios,
            async () => {
              await Promise.all([
                db.treinos.clear(),
                db.exercicios.clear(),
                db.sessoes.clear(),
                db.sessoes_exercicios.clear()
              ]);

              if (Array.isArray(data.treinos) && data.treinos.length) {
                await db.treinos.bulkAdd(data.treinos);
              }
              if (Array.isArray(data.exercicios) && data.exercicios.length) {
                await db.exercicios.bulkAdd(data.exercicios);
              }
              if (Array.isArray(data.sessoes) && data.sessoes.length) {
                await db.sessoes.bulkAdd(data.sessoes);
              }
              if (Array.isArray(data.sessoes_exercicios) && data.sessoes_exercicios.length) {
                await db.sessoes_exercicios.bulkAdd(data.sessoes_exercicios);
              }
            }
          );

          alert('Dados importados com sucesso!');
          navigate('home');
        } catch (err) {
          console.error(err);
          alert('Erro ao importar dados. Verifique se o arquivo é um backup válido.');
        } finally {
          fileInput.value = '';
        }
      };

      reader.readAsText(file);
    });

    const btnImport = el('button', {
      class: 'btn ghost btn-full',
      onclick: () => fileInput.click()
    }, ['Importar dados de arquivo']);

    const actions = el('div', { class: 'stack' }, [
      btnExport,
      btnImport
    ]);

    const container = el('div', {}, [
      el('h2', {}, ['Backup & Configurações']),
      info,
      actions,
      fileInput
    ]);

    return container;
  }

  // render inicial
  renderRoute();
})();
