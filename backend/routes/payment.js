const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../database/db');

// Planos e preços (Stripe price IDs — configurar depois)
const PLANS = {
  basic:   { name: 'Básico',  price: 2990,  description: 'R$ 29,90/mês' },
  plus:    { name: 'Plus',    price: 3490,  description: 'R$ 34,90/mês' },
  premium: { name: 'Premium', price: 3990,  description: 'R$ 39,90/mês' },
};

// Listar planos disponíveis
router.get('/plans', (req, res) => {
  res.json({
    plans: [
      {
        id: 'basic',
        name: 'Básico',
        price: 'R$ 29,90',
        period: '/mês',
        features: ['3 planos de rotina', '30 mensagens IA/dia', 'Histórico básico', 'Suporte por e-mail'],
        limits: { maxPlans: 3, aiMessages: 30, trustMode: false },
        highlight: false,
      },
      {
        id: 'plus',
        name: 'Plus',
        price: 'R$ 34,90',
        period: '/mês',
        features: ['10 planos de rotina', '100 mensagens IA/dia', 'Modo confiança', 'Histórico completo', 'Suporte prioritário'],
        limits: { maxPlans: 10, aiMessages: 100, trustMode: true },
        highlight: true,
        badge: 'MAIS POPULAR',
      },
      {
        id: 'premium',
        name: 'Premium',
        price: 'R$ 39,90',
        period: '/mês',
        features: ['Planos ilimitados', 'IA ilimitada', 'Modo confiança', 'Todas as integrações', 'Suporte VIP 24h'],
        limits: { maxPlans: -1, aiMessages: -1, trustMode: true },
        highlight: false,
        badge: 'COMPLETO',
      },
    ]
  });
});

// Criar sessão de checkout (Stripe)
router.post('/checkout', auth, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!PLANS[plan]) return res.status(400).json({ error: 'Plano inválido' });
    
    // Por enquanto retorna simulação — integrar Stripe depois
    res.json({ 
      ok: true, 
      message: 'Integração com Stripe será configurada em breve.',
      plan: PLANS[plan]
    });
  } catch(e) { res.status(500).json({ error: 'Erro interno.' }); }
});

// Ativar plano (admin/manual)
router.post('/activate', auth, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!PLANS[plan] && plan !== 'trial') return res.status(400).json({ error: 'Plano inválido' });
    db.prepare('UPDATE users SET plan = ?, plan_status = ? WHERE id = ?').run(plan, 'active', req.user.id);
    res.json({ ok: true, plan });
  } catch(e) { res.status(500).json({ error: 'Erro interno.' }); }
});

module.exports = router;
