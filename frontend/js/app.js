// J.A.R.V.I.S v7 Final — app.js
const API = '';
let token = localStorage.getItem('jarvis_token');
let user = JSON.parse(localStorage.getItem('jarvis_user') || 'null');
let listening = false, speaking = false, trustMode = false;
let recognition = null, synth = window.speechSynthesis;
let ptVoice = null, aiHistory = [], plans = [];
let planLimits = { maxPlans: 2, aiMessages: 10, trustMode: false };

// ── INIT ──────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  loadVoices();
  if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = loadVoices;

  // Auto-fill saved email
  const savedEmail = localStorage.getItem('jarvis_saved_email');
  if (savedEmail) {
    document.getElementById('loginEmail').value = savedEmail;
    document.getElementById('rememberMe').checked = true;
  }

  if (token && user) {
    showApp();
    await loadAll();
    setTimeout(() => speak(`Olá ${user.name.split(' ')[0]}, sistema pronto.`), 600);
  } else {
    showAuth();
  }

  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.code === 'Space') { e.preventDefault(); toggleListen(); }
  });
});

function loadVoices() {
  const voices = synth.getVoices();
  ptVoice = voices.find(v => v.lang === 'pt-BR' && v.name.toLowerCase().includes('google')) ||
            voices.find(v => v.lang === 'pt-BR' && !v.localService) ||
            voices.find(v => v.lang === 'pt-BR') ||
            voices.find(v => v.lang.startsWith('pt')) || null;
}

// ── AUTH ──────────────────────────────────────────────────────────────────
function showAuth() {
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('appScreen').style.display = 'none';
}
function showApp() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appScreen').style.display = 'block';
  if (user) {
    document.getElementById('userName').textContent = user.name.split(' ')[0].toUpperCase();
    updatePlanBadge(user.plan || 'trial');
  }
}

window.switchTab = function(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  ['loginForm', 'registerForm', 'unlockForm'].forEach(id => {
    document.getElementById(id).style.display = id === tab + 'Form' ? 'block' : 'none';
  });
  setAuthErr('');
};

window.doLogin = async function() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value;
  const rememberMe = document.getElementById('rememberMe').checked;
  if (!email || !pass) return setAuthErr('Preencha e-mail e palavra-chave');
  try {
    const r = await api('/api/auth/login', 'POST', { email, passphrase: pass, rememberMe });
    if (r.error) return setAuthErr(r.error);
    if (rememberMe) localStorage.setItem('jarvis_saved_email', email);
    else localStorage.removeItem('jarvis_saved_email');
    saveAuth(r);
    showApp();
    await loadAll();
    setTimeout(() => speak(`Bem-vindo de volta, ${user.name.split(' ')[0]}.`), 400);
  } catch(e) { setAuthErr('Erro de conexão com o servidor'); }
};

window.doRegister = async function() {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pass = document.getElementById('regPass').value;
  const question = document.getElementById('regQuestion').value;
  const answer = document.getElementById('regAnswer').value.trim();
  if (!name || !email || !pass) return setAuthErr('Preencha todos os campos obrigatórios');
  if (pass.length < 4) return setAuthErr('Palavra-chave mínimo 4 caracteres');
  if (!answer) return setAuthErr('A resposta secreta é obrigatória para recuperação de conta');
  try {
    const r = await api('/api/auth/register', 'POST', { name, email, passphrase: pass, secret_question: question, secret_answer: answer });
    if (r.error) return setAuthErr(r.error);
    saveAuth(r);
    showApp();
    await loadAll();
    setTimeout(() => speak(`Conta criada com sucesso! Bem-vindo ao Jarvis, ${name.split(' ')[0]}.`), 400);
  } catch(e) { setAuthErr('Erro de conexão com o servidor'); }
};

function saveAuth(r) {
  token = r.token; user = r.user;
  localStorage.setItem('jarvis_token', token);
  localStorage.setItem('jarvis_user', JSON.stringify(user));
}

function setAuthErr(msg, ok = false) {
  const el = document.getElementById('authErr');
  el.textContent = msg;
  el.className = 'auth-err' + (ok ? ' ok' : '');
}

window.logout = function() {
  synth.cancel();
  token = null; user = null;
  localStorage.removeItem('jarvis_token');
  localStorage.removeItem('jarvis_user');
  aiHistory = []; plans = [];
  showAuth();
};

// ── UNLOCK ────────────────────────────────────────────────────────────────
window.showUnlockMethod = function(method) {
  document.getElementById('unlockOptions').style.display = 'none';
  document.getElementById('unlockEmail').style.display = method === 'email' ? 'block' : 'none';
  document.getElementById('unlockSecret').style.display = method === 'secret' ? 'block' : 'none';
};

window.resetUnlock = function() {
  document.getElementById('unlockOptions').style.display = 'block';
  document.getElementById('unlockEmail').style.display = 'none';
  document.getElementById('unlockSecret').style.display = 'none';
};

window.sendUnlockCode = async function() {
  const email = document.getElementById('unlockEmailInput').value.trim();
  if (!email) return setAuthErr('Digite seu e-mail');
  setAuthErr('Enviando código...');
  try {
    const r = await api('/api/auth/request-unlock', 'POST', { email });
    if (r.error) return setAuthErr(r.error);
    setAuthErr('');
    document.getElementById('unlockEmailStep1').style.display = 'none';
    document.getElementById('unlockEmailStep2').style.display = 'block';
  } catch(e) { setAuthErr('Erro de conexão'); }
};

window.doUnlockWithCode = async function() {
  const email = document.getElementById('unlockEmailInput').value.trim();
  const code = document.getElementById('unlockCodeInput').value.trim();
  const np = document.getElementById('unlockNewPass').value;
  if (!code || !np) return setAuthErr('Preencha todos os campos');
  try {
    const r = await api('/api/auth/unlock-with-code', 'POST', { email, code, newPassphrase: np });
    if (r.error) return setAuthErr(r.error);
    setAuthErr('✓ Conta desbloqueada! Faça login com a nova senha.', true);
    setTimeout(() => switchTab('login'), 2500);
  } catch(e) { setAuthErr('Erro de conexão'); }
};

window.doUnlockWithSecret = async function() {
  const email = document.getElementById('unlockSecretEmail').value.trim();
  const answer = document.getElementById('unlockSecretAnswer').value.trim();
  const np = document.getElementById('unlockSecretNewPass').value;
  if (!email || !answer || !np) return setAuthErr('Preencha todos os campos');
  try {
    const r = await api('/api/auth/unlock-with-secret', 'POST', { email, answer, newPassphrase: np });
    if (r.error) return setAuthErr(r.error);
    setAuthErr('✓ Conta desbloqueada! Faça login com a nova senha.', true);
    setTimeout(() => switchTab('login'), 2500);
  } catch(e) { setAuthErr('Erro de conexão'); }
};

// ── API ───────────────────────────────────────────────────────────────────
async function api(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(API + path, opts);
  return r.json();
}

// ── LOAD ──────────────────────────────────────────────────────────────────
async function loadAll() {
  await Promise.all([loadPlans(), loadHistory(), loadUserInfo()]);
}

async function loadUserInfo() {
  try {
    const u = await api('/api/auth/me');
    if (u.id) {
      trustMode = !!u.trust_mode;
      planLimits = u.planLimits || planLimits;
      updateTrustUI();
      updatePlanBadge(u.plan);
      document.getElementById('planName').textContent = (u.plan || 'trial').toUpperCase();
      document.getElementById('trialDays').textContent = u.trialDaysLeft + ' DIAS';
      document.getElementById('trialDays').className = 'sec-val ' + (u.trialDaysLeft <= 1 ? 'danger' : 'warn');
    }
  } catch(e) {}
}

function updatePlanBadge(plan) {
  const badge = document.getElementById('planBadge');
  const names = { trial: 'TRIAL', basic: 'BÁSICO', plus: 'PLUS', premium: 'PREMIUM', vip: 'VIP ★' };
  const classes = { trial: 'plan-trial', basic: 'plan-basic', plus: 'plan-plus', premium: 'plan-premium', vip: 'plan-vip' };
  badge.textContent = names[plan] || 'TRIAL';
  badge.className = 'plan-badge-top ' + (classes[plan] || 'plan-trial');
}

async function loadPlans() {
  try {
    plans = await api('/api/plans');
    const list = document.getElementById('plansList');
    list.innerHTML = '';
    if (!plans.length) {
      list.innerHTML = '<div style="font-family:\'Share Tech Mono\',monospace;font-size:10px;color:var(--text3);text-align:center;padding:18px">Nenhum plano criado ainda. Clique em + para adicionar!</div>';
      return;
    }
    plans.forEach(p => {
      const div = document.createElement('div');
      div.className = 'plan-item fade-in';
      const actions = Array.isArray(p.actions) ? p.actions.join(' → ') : p.actions;
      div.innerHTML = `<div class="plan-trigger">"${p.trigger_phrase}"</div><div class="plan-name">${p.name}</div><div class="plan-preview">${actions}</div><div class="plan-count">${Array.isArray(p.actions) ? p.actions.length : 1} AÇÃO</div><button class="plan-del" onclick="deletePlan(event,${p.id})">✕</button>`;
      div.onclick = () => activatePlan(div, p.trigger_phrase, p.id);
      list.appendChild(div);
    });
  } catch(e) {}
}

window.deletePlan = async function(e, id) {
  e.stopPropagation();
  if (!confirm('Remover este plano?')) return;
  await api('/api/plans/' + id, 'DELETE');
  await loadPlans();
};

window.activatePlan = function(el, phrase, id) {
  document.querySelectorAll('.plan-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  simulateCmd(phrase, id);
};

window.openAddPlan = function() {
  document.getElementById('addPlanModal').classList.add('show');
  setTimeout(() => document.getElementById('planPhrase').focus(), 100);
};

window.savePlan = async function() {
  const phrase = document.getElementById('planPhrase').value.trim();
  const name = document.getElementById('planName2').value.trim();
  const actions = document.getElementById('planActions').value.split(',').map(s => s.trim()).filter(Boolean);
  if (!phrase || !name) return;
  const r = await api('/api/plans', 'POST', { name, trigger_phrase: phrase, actions });
  if (r.error) {
    if (r.upgrade) { closeModal('addPlanModal'); openPricing(); return; }
    alert(r.error); return;
  }
  await loadPlans();
  closeModal('addPlanModal');
  ['planPhrase', 'planName2', 'planActions'].forEach(id => document.getElementById(id).value = '');
  const msg = `Plano ${name} criado com sucesso!`;
  addAIMessage('jarvis', msg); speak(msg);
};

async function loadHistory() {
  try {
    const items = await api('/api/history');
    const list = document.getElementById('historyList');
    list.innerHTML = '';
    if (!items.length) {
      list.innerHTML = '<div style="font-family:\'Share Tech Mono\',monospace;font-size:10px;color:var(--text3);text-align:center;padding:16px">Sem histórico ainda</div>';
      return;
    }
    items.slice(0, 15).forEach(item => {
      const div = document.createElement('div');
      div.className = 'h-item';
      const d = new Date(item.created_at * 1000);
      const time = d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
      div.innerHTML = `<div class="h-time">${time}</div><div><div class="h-cmd"><span>▶</span> ${item.command.substring(0, 40)}${item.command.length > 40 ? '...' : ''}</div><div class="h-ok">✓ OK</div></div>`;
      list.appendChild(div);
    });
  } catch(e) {}
}

function addHistoryItem(cmd) {
  const list = document.getElementById('historyList');
  if (list.querySelector('.ai-empty, [style*="Sem histórico"]')) list.innerHTML = '';
  const now = new Date();
  const time = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  const div = document.createElement('div');
  div.className = 'h-item fade-in';
  div.innerHTML = `<div class="h-time">${time}</div><div><div class="h-cmd"><span>▶</span> ${cmd.substring(0, 40)}${cmd.length > 40 ? '...' : ''}</div><div class="h-ok">✓ OK</div></div>`;
  list.insertBefore(div, list.firstChild);
}

// ── AI CHAT ───────────────────────────────────────────────────────────────
function addAIMessage(role, text) {
  const chat = document.getElementById('aiChat');
  const empty = chat.querySelector('.ai-empty');
  if (empty) empty.remove();
  const div = document.createElement('div');
  div.className = role === 'user' ? 'ai-user fade-in' : 'ai-response fade-in';
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function showTyping() {
  const chat = document.getElementById('aiChat');
  const empty = chat.querySelector('.ai-empty');
  if (empty) empty.remove();
  const div = document.createElement('div');
  div.className = 'ai-typing';
  div.id = 'typingDot';
  div.textContent = 'Jarvis está pensando...';
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}
function hideTyping() { const el = document.getElementById('typingDot'); if (el) el.remove(); }

async function askAI(userMessage) {
  aiHistory.push({ role: 'user', content: userMessage });
  showTyping();
  setStatus('thinking');
  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ message: userMessage, history: aiHistory.slice(-12) })
    });
    const data = await res.json();
    hideTyping();
    if (data.upgrade) { openPricing(); speak('Você atingiu o limite do seu plano. Veja as opções de upgrade!'); return; }
    const reply = data.reply || 'Não consegui processar agora. Pode repetir?';
    aiHistory.push({ role: 'assistant', content: reply });
    addAIMessage('jarvis', reply);
    speak(reply);
    addHistoryItem(userMessage);
  } catch(e) {
    hideTyping();
    const fallback = getFallback(userMessage);
    aiHistory.push({ role: 'assistant', content: fallback });
    addAIMessage('jarvis', fallback);
    speak(fallback);
    addHistoryItem(userMessage);
  }
}

function getFallback(cmd) {
  const l = cmd.toLowerCase();
  if (l.includes('boa noite') || l.includes('dormir')) return 'Boa noite! Iniciando sua rotina noturna.';
  if (l.includes('cheguei') && l.includes('trabalho')) return 'Bem-vindo ao trabalho! Preparando seu ambiente.';
  if (l.includes('cheguei')) return 'Bem-vindo em casa! Iniciando sua rotina de chegada.';
  if (l.includes('histórico')) return 'Exibindo seu histórico de atividades.';
  if (l.includes('plano')) return 'Abrindo o criador de planos.';
  if (l.includes('como você está') || l.includes('tudo bem')) return 'Estou funcionando perfeitamente, obrigado por perguntar! Como posso te ajudar hoje?';
  if (l.includes('olá') || l.includes('oi')) return `Olá! Estou aqui e pronto para te ajudar. O que você precisa?`;
  return `Entendido. Processando sua solicitação.`;
}

// ── VOICE ──────────────────────────────────────────────────────────────────
function speak(text) {
  if (!synth) return;
  synth.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = 'pt-BR';
  utt.rate = 0.92;
  utt.pitch = 1.08;
  utt.volume = 1;
  if (ptVoice) utt.voice = ptVoice;
  utt.onstart = () => { speaking = true; setStatus('speaking'); };
  utt.onend = () => { speaking = false; if (listening) setStatus('listening'); else setStatus('online'); };
  utt.onerror = () => { speaking = false; setStatus('online'); };
  synth.speak(utt);
}

function setStatus(state) {
  const configs = {
    online:    { dot: 'online',    status: 'ONLINE',     btn: '',         orb: '',           wave: '',             vstxt: 'CLIQUE PARA ATIVAR O MICROFONE', vcls: '' },
    listening: { dot: 'listening', status: 'OUVINDO',    btn: 'active',   orb: 'orb-active', wave: 'wave-active',  vstxt: 'OUVINDO...',                     vcls: 'active' },
    speaking:  { dot: 'speaking',  status: 'FALANDO',    btn: 'speaking', orb: 'orb-speaking',wave: 'wave-speaking',vstxt: 'JARVIS FALANDO...',              vcls: 'speaking' },
    thinking:  { dot: 'thinking',  status: 'PENSANDO',   btn: 'thinking', orb: 'orb-thinking',wave: 'wave-thinking',vstxt: 'PROCESSANDO...',                 vcls: 'thinking' },
  };
  const s = configs[state] || configs.online;
  document.getElementById('mainDot').className = 'status-dot ' + s.dot;
  document.getElementById('mainStatus').textContent = s.status;
  document.getElementById('orbBtn').className = 'orb-btn' + (s.btn ? ' ' + s.btn : '');
  document.getElementById('orbContainer').className = 'orb-container' + (s.orb ? ' ' + s.orb : '');
  document.getElementById('voiceWave').className = 'voice-wave' + (s.wave ? ' ' + s.wave : '');
  document.getElementById('voiceStatusTxt').textContent = s.vstxt;
  document.getElementById('voiceStatusTxt').className = 'voice-status' + (s.vcls ? ' ' + s.vcls : '');
}

window.toggleListen = function() {
  if (speaking) { synth.cancel(); speaking = false; }
  listening = !listening;
  if (listening) {
    setStatus('listening');
    startRecognition();
  } else {
    stopRecognition();
    setStatus('online');
  }
};

function startRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  if (recognition) { try { recognition.stop(); } catch(e) {} }
  recognition = new SR();
  recognition.lang = 'pt-BR';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.onresult = (e) => {
    let final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) final += e.results[i][0].transcript;
    }
    if (final.trim()) { addAIMessage('user', final.trim()); processCommand(final.trim()); }
  };
  recognition.onerror = (e) => { if (e.error !== 'no-speech' && listening) setTimeout(startRecognition, 500); };
  recognition.onend = () => { if (listening && !speaking) setTimeout(startRecognition, 300); };
  try { recognition.start(); } catch(e) {}
}

function stopRecognition() {
  if (recognition) { try { recognition.stop(); } catch(e) {} recognition = null; }
}

// ── COMMANDS ───────────────────────────────────────────────────────────────
function processCommand(cmd) {
  const lower = cmd.toLowerCase().trim();
  stopRecognition();

  const matchedPlan = plans.find(p => lower.includes(p.trigger_phrase.toLowerCase().replace(/^"|"$/g, '')));
  if (matchedPlan) {
    if (!trustMode) {
      requireAuth('AUTENTICAÇÃO', `Confirme para executar: ${matchedPlan.name}`, async () => await executePlan(matchedPlan));
    } else executePlan(matchedPlan);
    return;
  }

  if (lower.includes('criar') && lower.includes('plano')) {
    const msg = 'Abrindo o criador de planos.';
    addAIMessage('jarvis', msg); speak(msg);
    setTimeout(() => openAddPlan(), 1500);
    if (listening) setTimeout(startRecognition, 3500);
    return;
  }

  if (lower.includes('histórico')) {
    const msg = 'Exibindo seu histórico de atividades.';
    addAIMessage('jarvis', msg); speak(msg);
    loadHistory();
    if (listening) setTimeout(startRecognition, 2500);
    return;
  }

  if (lower.includes('modo confiança') && !trustMode) {
    requireAuth('MODO CONFIANÇA', 'Confirme para ativar', async () => {
      const r = await api('/api/settings/trust-mode', 'POST', { active: true });
      if (r.upgrade) { openPricing(); return; }
      trustMode = true; updateTrustUI();
      const msg = 'Modo confiança ativado!'; addAIMessage('jarvis', msg); speak(msg);
    });
    return;
  }

  askAI(cmd).then(() => { if (listening) setTimeout(startRecognition, 3500); });
}

async function executePlan(plan) {
  await api('/api/plans/' + plan.id + '/execute', 'POST');
  const actions = Array.isArray(plan.actions) ? plan.actions.join(', ') : plan.actions;
  const msg = `Plano ${plan.name} iniciado. Executando: ${actions}.`;
  addAIMessage('jarvis', msg); speak(msg); addHistoryItem('Plano: ' + plan.name);
  if (listening) setTimeout(startRecognition, 3500);
}

window.simulateCmd = function(cmd) {
  if (!listening) toggleListen();
  addAIMessage('user', cmd);
  processCommand(cmd);
};

// ── TRUST ──────────────────────────────────────────────────────────────────
window.toggleTrust = function() {
  if (!trustMode) {
    requireAuth('MODO CONFIANÇA', 'Confirme para ativar', async () => {
      const r = await api('/api/settings/trust-mode', 'POST', { active: true });
      if (r.upgrade) { openPricing(); return; }
      trustMode = true; updateTrustUI(); speak('Modo confiança ativado!');
    });
  } else {
    api('/api/settings/trust-mode', 'POST', { active: false });
    trustMode = false; updateTrustUI(); speak('Modo confiança desativado.');
  }
};
function updateTrustUI() {
  document.getElementById('trustBar').classList.toggle('on', trustMode);
  document.getElementById('trustToggle').classList.toggle('on', trustMode);
}

// ── AUTH MODAL ─────────────────────────────────────────────────────────────
let authCb = null;
function requireAuth(title, desc, cb) {
  authCb = cb;
  document.getElementById('authModalTitle').textContent = title;
  document.getElementById('authModalDesc').textContent = desc;
  document.getElementById('authInput').value = '';
  document.getElementById('authModalErr').textContent = '';
  document.getElementById('authModal').classList.add('show');
  setTimeout(() => document.getElementById('authInput').focus(), 100);
}

window.confirmAuth = async function() {
  const val = document.getElementById('authInput').value;
  if (!val) return;
  try {
    const r = await api('/api/auth/verify', 'POST', { passphrase: val });
    if (r.ok) {
      closeModal('authModal');
      if (authCb) { authCb(); authCb = null; }
    } else {
      document.getElementById('authModalErr').textContent = r.error || 'Incorreta';
      document.getElementById('authInput').value = '';
      if (r.blocked) {
        closeModal('authModal');
        document.getElementById('lockStatus').textContent = 'BLOQUEADA';
        document.getElementById('lockStatus').className = 'sec-val danger';
        speak('Conta bloqueada. Verifique seu e-mail para desbloquear.');
      }
    }
  } catch(e) { document.getElementById('authModalErr').textContent = 'Erro de conexão'; }
};

// ── PRICING ─────────────────────────────────────────────────────────────────
window.openPricing = function() { document.getElementById('pricingModal').classList.add('show'); };
window.selectPlan = async function(plan) {
  closeModal('pricingModal');
  const names = { basic: 'Básico', plus: 'Plus', premium: 'Premium' };
  const msg = `Plano ${names[plan]} selecionado! Em breve a integração com pagamento estará disponível.`;
  addAIMessage('jarvis', msg); speak(msg);
};

// ── MODALS ──────────────────────────────────────────────────────────────────
window.closeModal = function(id) { document.getElementById(id).classList.remove('show'); };

document.addEventListener('DOMContentLoaded', () => {
  ['authModal', 'addPlanModal', 'pricingModal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', e => { if (e.target === el) closeModal(id); });
  });
  document.getElementById('authInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') confirmAuth(); });
  document.getElementById('loginPass')?.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  document.getElementById('regAnswer')?.addEventListener('keydown', e => { if (e.key === 'Enter') doRegister(); });
});

window.speechSynthesis.onvoiceschanged = () => loadVoices();
