# GymControl

Protótipo mobile-first para controle de treinos, sessões e progressão. Usa Dexie.js (IndexedDB) para persistência offline. Simples e leve.

Como executar localmente:
1. Coloque os arquivos em uma pasta web (por exemplo, `./gymcontrol`).
2. Rode um servidor local (ex: `npx http-server` ou `python -m http.server 8000`).
3. Abra http://localhost:8000 no celular ou navegador.

Observações:
- O service worker serve um cache simples. Atualize a versão do cache para invalidar.
- db.js disponibiliza a API via `window.DB`; `app.js` é o controlador UI.
