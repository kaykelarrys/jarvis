const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../database/db');

router.get('/', auth, (req, res) => {
  const s = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(req.user.id);
  const u = db.prepare('SELECT trust_mode, personality FROM users WHERE id = ?').get(req.user.id);
  res.json({ ...s, ...u });
});

router.post('/trust-mode', auth, (req, res) => {
  const user = db.prepare('SELECT plan, is_vip FROM users WHERE id = ?').get(req.user.id);
  const allowed = ['plus', 'premium', 'vip'].includes(user.plan) || user.is_vip;
  if (!allowed && req.body.active)
    return res.status(403).json({ error: 'Modo confiança disponível no plano Plus ou superior.', upgrade: true });
  db.prepare('UPDATE users SET trust_mode = ? WHERE id = ?').run(req.body.active ? 1 : 0, req.user.id);
  res.json({ ok: true });
});

router.put('/voice', auth, (req, res) => {
  db.prepare('UPDATE settings SET voice_rate = ?, voice_pitch = ? WHERE user_id = ?').run(req.body.voice_rate ?? 0.95, req.body.voice_pitch ?? 1.05, req.user.id);
  res.json({ ok: true });
});

module.exports = router;
