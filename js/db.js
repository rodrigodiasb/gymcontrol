// db.js — Dexie wrapper exposed as window.DB
(function(){
  const dexie = new Dexie('GymControlMaterialDB');
  dexie.version(1).stores({
    treinos: '++id, nome, criado_em',
    exercicios: '++id, treino_id, nome, repeticoes, carga, observacao',
    sessoes: '++id, treino_id, data',
    sessoes_exercicios: '++id, sessao_id, nome, repeticoes, carga'
  });

  const API = {
    db: dexie,
    criarTreino: async (t)=> {
      const id = await dexie.treinos.add({...t, criado_em:new Date().toISOString()});
      return id;
    },
    atualizarTreino: async (id,payload)=> dexie.treinos.update(id,payload),
    deletarTreino: async (id)=> { await dexie.exercicios.where('treino_id').equals(id).delete(); return dexie.treinos.delete(id); },
    listarTreinos: async ()=> dexie.treinos.orderBy('criado_em').reverse().toArray(),
    adicionarExercicio: async (treino_id, ex)=> dexie.exercicios.add({...ex, treino_id}),
    listarExerciciosDoTreino: async (treino_id)=> dexie.exercicios.where('treino_id').equals(treino_id).toArray(),
    salvarSessao: async (sessao, exercicios)=> {
      const id = await dexie.sessoes.add({treino_id:sessao.treino_id, data:new Date().toISOString()});
      const items = exercicios.map(e=>({...e, sessao_id:id}));
      await dexie.sessoes_exercicios.bulkAdd(items);
      return id;
    },
    listarSessoes: async ()=> dexie.sessoes.orderBy('data').reverse().toArray(),
    listarExerciciosSessao: async (sessao_id)=> dexie.sessoes_exercicios.where('sessao_id').equals(sessao_id).toArray()
  };

  window.DB = API;
})();
