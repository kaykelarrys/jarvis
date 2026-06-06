const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../database/db');

router.get('/', auth, (req, res) => {
  const items = db.prepare('SELECT * FROM history WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.user.id);
  res.json(items);
});

router.post('/', auth, (req, res) => {
  const { command, response, status } = req.body;
  if (!command) return res.status(400).json({ error: 'Comando obrigatório' });
  const result = db.prepare('INSERT INTO history (user_id, command, response, status) VALUES (?, ?, ?, ?)').run(req.user.id, command, response || '', status || 'executed');
  res.json({ id: result.lastInsertRowid });
});

router.delete('/', auth, (req, res) => {
  db.prepare('DELETE FROM history WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

module.exports = router;
