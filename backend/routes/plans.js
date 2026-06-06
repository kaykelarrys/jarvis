const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../database/db');

const PLAN_LIMITS = { trial: 2, basic: 3, plus: 10, premium: -1, vip: -1 };

router.get('/', auth, (req, res) => {
  const plans = db.prepare('SELECT * FROM plans WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(plans.map(p => ({ ...p, actions: JSON.parse(p.actions) })));
});

router.post('/', auth, (req, res) => {
  try {
    const { name, trigger_phrase, actions } = req.body;
    if (!name || !trigger_phrase || !actions?.length)
      return res.status(400).json({ error: 'Preencha todos os campos' });
    const user = db.prepare('SELECT plan, is_vip FROM users WHERE id = ?').get(req.user.id);
    const limit = PLAN_LIMITS[user.plan] || 2;
    if (limit !== -1) {
      const count = db.prepare('SELECT COUNT(*) as c FROM plans WHERE user_id = ?').get(req.user.id);
      if (count.c >= limit)
        return res.status(403).json({ error: `Seu plano ${user.plan} permite no máximo ${limit} planos. Faça upgrade!`, upgrade: true });
    }
    const result = db.prepare('INSERT INTO plans (user_id, name, trigger_phrase, actions) VALUES (?, ?, ?, ?)').run(req.user.id, name, trigger_phrase, JSON.stringify(actions));
    res.json({ id: result.lastInsertRowid, name, trigger_phrase, actions });
  } catch(e) { res.status(500).json({ error: 'Erro interno.' }); }
});

router.put('/:id', auth, (req, res) => {
  const plan = db.prepare('SELECT * FROM plans WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!plan) return res.status(404).json({ error: 'Plano não encontrado' });
  const { name, trigger_phrase, actions } = req.body;
  db.prepare('UPDATE plans SET name = ?, trigger_phrase = ?, actions = ? WHERE id = ?')
    .run(name || plan.name, trigger_phrase || plan.trigger_phrase, JSON.stringify(actions || JSON.parse(plan.actions)), plan.id);
  res.json({ ok: true });
});

router.delete('/:id', auth, (req, res) => {
  const plan = db.prepare('SELECT * FROM plans WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!plan) return res.status(404).json({ error: 'Plano não encontrado' });
  db.prepare('DELETE FROM plans WHERE id = ?').run(plan.id);
  res.json({ ok: true });
});

router.post('/:id/execute', auth, (req, res) => {
  const plan = db.prepare('SELECT * FROM plans WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!plan) return res.status(404).json({ error: 'Plano não encontrado' });
  db.prepare('INSERT INTO history (user_id, command, response, status) VALUES (?, ?, ?, ?)').run(req.user.id, `Plano: ${plan.name}`, `Executado via "${plan.trigger_phrase}"`, 'executed');
  res.json({ ok: true, actions: JSON.parse(plan.actions) });
});

module.exports = router;
