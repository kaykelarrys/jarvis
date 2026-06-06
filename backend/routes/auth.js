const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const JWT_SECRET = process.env.JWT_SECRET || 'jarvis_final_ultra_secure_2026';
const ROUNDS = 12;

// Planos e limites
const PLANS = {
  trial:   { name: 'Trial',   maxPlans: 2,  aiMessages: 10,  trustMode: false },
  basic:   { name: 'Básico',  maxPlans: 3,  aiMessages: 30,  trustMode: false },
  plus:    { name: 'Plus',    maxPlans: 10, aiMessages: 100, trustMode: true  },
  premium: { name: 'Premium', maxPlans: -1, aiMessages: -1,  trustMode: true  },
  vip:     { name: 'VIP',     maxPlans: -1, aiMessages: -1,  trustMode: true  },
};

const VIP_EMAIL = 'kaykelarrysilva@gmail.com';

router.post('/register', async (req, res) => {
  try {
    const { name, email, passphrase, secret_question, secret_answer } = req.body;
    if (!name?.trim() || !email?.trim() || !passphrase)
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios' });
    if (passphrase.length < 4)
      return res.status(400).json({ error: 'Palavra-chave precisa ter no mínimo 4 caracteres' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error: 'E-mail inválido' });

    const emailLower = email.toLowerCase().trim();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(emailLower);
    if (existing) return res.status(400).json({ error: 'Este e-mail já está cadastrado' });

    const isVip = emailLower === VIP_EMAIL ? 1 : 0;
    const plan = isVip ? 'vip' : 'trial';
    const hash = await bcrypt.hash(passphrase, ROUNDS);
    const answerHash = secret_answer ? await bcrypt.hash(secret_answer.toLowerCase().trim(), ROUNDS) : null;

    const result = db.prepare(
      'INSERT INTO users (name, email, passphrase_hash, plan, plan_status, is_vip, secret_question, secret_answer) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(name.trim(), emailLower, hash, plan, plan, isVip, secret_question || null, answerHash);

    db.prepare('INSERT INTO settings (user_id) VALUES (?)').run(result.lastInsertRowid);

    try {
      const { sendWelcome } = require('../security/emailService');
      await sendWelcome(emailLower, name, PLANS[plan].name);
    } catch(e) { console.error('Email:', e.message); }

    const token = jwt.sign({ id: result.lastInsertRowid, name: name.trim(), email: emailLower }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: result.lastInsertRowid, name: name.trim(), email: emailLower, plan, is_vip: isVip } });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Erro interno. Tente novamente.' }); }
});

router.post('/login', async (req, res) => {
  try {
    const { email, passphrase, rememberMe } = req.body;
    if (!email || !passphrase) return res.status(400).json({ error: 'Preencha e-mail e palavra-chave' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!user) return res.status(400).json({ error: 'E-mail não encontrado' });

    if ((user.failed_attempts || 0) >= 5)
      return res.status(401).json({ error: 'Conta bloqueada. Use a opção Desbloquear.', blocked: true });

    const match = await bcrypt.compare(passphrase, user.passphrase_hash);
    if (!match) {
      const attempts = (user.failed_attempts || 0) + 1;
      db.prepare('UPDATE users SET failed_attempts = ? WHERE id = ?').run(attempts, user.id);
      if (attempts >= 5)
        return res.status(401).json({ error: 'Conta bloqueada. Use a opção Desbloquear.', blocked: true });
      const rest = 5 - attempts;
      return res.status(401).json({ error: `Palavra-chave incorreta. Você tem mais ${rest} tentativa${rest > 1 ? 's' : ''}.` });
    }

    db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);
    const expiresIn = rememberMe ? '30d' : '8h';
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, plan: user.plan, is_vip: user.is_vip } });
  } catch(e) { res.status(500).json({ error: 'Erro interno.' }); }
});

router.post('/verify', require('../middleware/auth'), async (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.json({ ok: false, error: 'Usuário não encontrado' });
    if ((user.failed_attempts || 0) >= 5)
      return res.json({ ok: false, blocked: true, error: 'Conta bloqueada. Use a opção Desbloquear.' });
    const match = await bcrypt.compare(req.body.passphrase, user.passphrase_hash);
    if (!match) {
      const attempts = (user.failed_attempts || 0) + 1;
      db.prepare('UPDATE users SET failed_attempts = ? WHERE id = ?').run(attempts, user.id);
      if (attempts >= 5) return res.json({ ok: false, blocked: true, error: 'Conta bloqueada. Use a opção Desbloquear.' });
      return res.json({ ok: false, error: `Incorreta. ${5 - attempts} tentativa${5 - attempts > 1 ? 's' : ''} restante${5 - attempts > 1 ? 's' : ''}.` });
    }
    db.prepare('UPDATE users SET failed_attempts = 0 WHERE id = ?').run(user.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ ok: false, error: 'Erro interno.' }); }
});

router.post('/request-unlock', async (req, res) => {
  try {
    const { email } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email?.toLowerCase().trim());
    if (!user) return res.status(400).json({ error: 'E-mail não encontrado' });
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    global._unlockCodes = global._unlockCodes || {};
    global._unlockCodes[email.toLowerCase()] = { code, expires: Date.now() + 30 * 60 * 1000 };
    console.log(`\n🔑 Código para ${email}: ${code}\n`);
    try {
      const { sendUnlockCode } = require('../security/emailService');
      await sendUnlockCode(email, code, user.name);
    } catch(e) { console.error('Email:', e.message); }
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: 'Erro interno.' }); }
});

router.post('/unlock-with-code', async (req, res) => {
  try {
    const { email, code, newPassphrase } = req.body;
    if (!email || !code || !newPassphrase) return res.status(400).json({ error: 'Preencha todos os campos' });
    if (newPassphrase.length < 4) return res.status(400).json({ error: 'Palavra-chave mínimo 4 caracteres' });
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user) return res.status(400).json({ error: 'E-mail não encontrado' });
    global._unlockCodes = global._unlockCodes || {};
    const entry = global._unlockCodes[email.toLowerCase()];
    if (!entry) return res.status(400).json({ error: 'Nenhum código pendente. Solicite um novo.' });
    if (Date.now() > entry.expires) { delete global._unlockCodes[email.toLowerCase()]; return res.status(400).json({ error: 'Código expirado. Solicite um novo.' }); }
    if (entry.code !== code) return res.status(400).json({ error: 'Código incorreto.' });
    delete global._unlockCodes[email.toLowerCase()];
    const hash = await bcrypt.hash(newPassphrase, ROUNDS);
    db.prepare('UPDATE users SET passphrase_hash = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?').run(hash, user.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: 'Erro interno.' }); }
});

router.post('/unlock-with-secret', async (req, res) => {
  try {
    const { email, answer, newPassphrase } = req.body;
    if (!email || !answer || !newPassphrase) return res.status(400).json({ error: 'Preencha todos os campos' });
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user) return res.status(400).json({ error: 'E-mail não encontrado' });
    if (!user.secret_answer) return res.status(400).json({ error: 'Resposta secreta não cadastrada.' });
    const match = await bcrypt.compare(answer.toLowerCase().trim(), user.secret_answer);
    if (!match) return res.status(400).json({ error: 'Resposta secreta incorreta.' });
    const hash = await bcrypt.hash(newPassphrase, ROUNDS);
    db.prepare('UPDATE users SET passphrase_hash = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?').run(hash, user.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: 'Erro interno.' }); }
});

router.get('/me', require('../middleware/auth'), (req, res) => {
  try {
    const user = db.prepare('SELECT id, name, email, plan, plan_status, is_vip, trust_mode, trial_start, failed_attempts FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'Não encontrado' });
    const trialDaysLeft = Math.max(0, 5 - Math.floor((Date.now() / 1000 - (user.trial_start || 0)) / 86400));
    const planLimits = PLANS[user.plan] || PLANS.trial;
    res.json({ ...user, trialDaysLeft, planLimits });
  } catch(e) { res.status(500).json({ error: 'Erro interno.' }); }
});

module.exports = router;
