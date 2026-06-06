process.env.JWT_SECRET = 'jarvis_final_ultra_secure_2026';
const { initDB, exec } = require('./backend/database/db');
initDB().then(() => {
  ['history','plans','settings','users'].forEach(t => {
    try { exec(`DELETE FROM ${t}`); } catch(e) {}
    try { exec(`DELETE FROM sqlite_sequence WHERE name='${t}'`); } catch(e) {}
  });
  console.log('\n✅ Banco resetado! Todos os dados apagados.\n');
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
