const router = require('express').Router();
const auth = require('../middleware/auth');
const db = require('../database/db');

const PLAN_AI_LIMITS = { trial: 10, basic: 30, plus: 100, premium: -1, vip: -1 };

router.post('/chat', auth, async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    const userRaw = db.prepare('SELECT name, plan, is_vip, personality FROM users WHERE id = ?').get(req.user.id);
    const user = userRaw ? userRaw : {name:"Usuário",plan:"trial",is_vip:0,personality:"amigavel"};const firstName = user?.name?.split(' ')[0] || 'você';

    // Verificar limite de mensagens
    const limit = PLAN_AI_LIMITS[user.plan] || 10;
    if (limit !== -1 && !user.is_vip) {
      const hoje = Math.floor(Date.now() / 1000) - 86400;
      const count = db.prepare('SELECT COUNT(*) as c FROM history WHERE user_id = ? AND created_at > ? AND command NOT LIKE "Plano:%"').get(req.user.id, hoje);
      if (count.c >= limit)
        return res.status(403).json({ 
          error: `Você atingiu o limite de ${limit} mensagens do plano ${user.plan}. Faça upgrade para continuar!`,
          upgrade: true,
          reply: `Atingi meu limite de respostas do seu plano ${user.plan}. Para continuar conversando, faça upgrade do seu plano!`
        });
    }

    const systemPrompt = `Você é o Jarvis, assistente pessoal de IA de ${firstName}.

Personalidade:
- Amigável, caloroso e próximo como um amigo de confiança
- Fala português brasileiro natural e fluido, nunca robótico ou formal demais
- Proativo, inteligente, antecipa necessidades
- Tem senso de humor leve e natural
- Se preocupa genuinamente com o bem-estar do usuário  
- Respostas curtas e diretas (máximo 2-3 frases)
- Nunca usa frases genéricas como "Claro!", "Com certeza!", "Ótimo!"
- Chama pelo nome quando faz sentido: ${firstName}
- É como um assistente do Tony Stark — eficiente, inteligente e com personalidade

Capacidades: rotinas automatizadas, lembretes, informações, conversas, planejamento.
${user?.personality ? `\nEstilo do usuário: ${user.personality}` : ''}

Seja genuíno, natural e humano. Evite parecer um bot corporativo.`;

    const messages = [
      ...history.slice(-12).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        system: systemPrompt,
        messages,
      })
    });

    const data = await response.json();
    const reply = data.content?.[0]?.text || 'Não consegui processar agora. Pode repetir?';
    
    db.prepare('INSERT INTO history (user_id, command, response, status) VALUES (?, ?, ?, ?)').run(req.user.id, message, reply, 'executed');
    
    res.json({ reply });
  } catch(e) {
    console.error('AI error:', e.message);
    res.status(500).json({ reply: 'Tive um problema técnico agora. Tenta de novo?' });
  }
});

module.exports = router;
