// db.js - wrapper for Dexie, attaches DB API to window.DB for non-module usage
const DexieLib = window.Dexie;
const dexieDB = new DexieLib('GymControlDB');

dexieDB.version(1).stores({
  treinos: '++id, nome, criado_em',
  exercicios: '++id, treino_id, nome, repeticoes, carga, observacao',
  sessoes: '++id, treino_id, data',
  sessoes_exercicios: '++id, sessao_id, nome, repeticoes, carga'
});

const DB = {
  db: dexieDB,
  async criarTreino(treino){
    const id = await dexieDB.treinos.add({...treino, criado_em: new Date().toISOString()});
    return id;
  },
  async atualizarTreino(id, payload){
    return dexieDB.treinos.update(id, payload);
  },
  async deletarTreino(id){
    await dexieDB.exercicios.where('treino_id').equals(id).delete();
    return dexieDB.treinos.delete(id);
  },
  async listarTreinos(){
    return dexieDB.treinos.orderBy('criado_em').reverse().toArray();
  },
  async adicionarExercicio(treino_id, ex){
    return dexieDB.exercicios.add({...ex, treino_id});
  },
  async listarExerciciosDoTreino(treino_id){
    return dexieDB.exercicios.where('treino_id').equals(treino_id).toArray();
  },
  async salvarSessao(sessao, exercicios){
    const sessaoId = await dexieDB.sessoes.add({treino_id: sessao.treino_id, data: new Date().toISOString()});
    const items = exercicios.map(e => ({...e, sessao_id: sessaoId}));
    await dexieDB.sessoes_exercicios.bulkAdd(items);
    return sessaoId;
  },
  async listarSessoes(){
    return dexieDB.sessoes.orderBy('data').reverse().toArray();
  },
  async listarExerciciosSessao(sessao_id){
    return dexieDB.sessoes_exercicios.where('sessao_id').equals(sessao_id).toArray();
  }
};

window.DB = DB;
