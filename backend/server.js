process.env.JWT_SECRET = process.env.JWT_SECRET || 'jarvis_final_ultra_secure_2026';
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./database/db');

const app = express();

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

initDB().then(() => {
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/plans', require('./routes/plans'));
  app.use('/api/history', require('./routes/history'));
  app.use('/api/settings', require('./routes/settings'));
  app.use('/api/ai', require('./routes/ai'));
  app.use('/api/payment', require('./routes/payment'));
  app.get('/api/health', (req, res) => res.json({ status: 'online', version: '7.0' }));
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`\n🤖 J.A.R.V.I.S v7 Final → http://localhost:${PORT}`);
    console.log(`   VIP: kaykelarrysilva@gmail.com\n`);
  });
}).catch(e => { console.error('Erro:', e.message); process.exit(1); });
