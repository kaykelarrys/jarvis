const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'iajarvis2026@gmail.com',
    pass: 'fczpjclmhlgtyevo',
  },
});

const style = `background:#030508;color:#dff0ff;padding:32px;font-family:monospace;border-radius:12px;max-width:500px;margin:0 auto`;
const logo = `<h2 style="color:#00d4ff;letter-spacing:6px;margin-bottom:4px">J.A.R.V.I.S</h2><p style="color:#2a4a6a;font-size:10px;letter-spacing:3px;margin-bottom:24px">ASSISTENTE DE INTELIGÊNCIA ARTIFICIAL PESSOAL</p>`;

async function sendUnlockCode(email, code, name) {
  await transporter.sendMail({
    from: '"J.A.R.V.I.S" <iajarvis2026@gmail.com>',
    to: email,
    subject: '🔐 Código de desbloqueio — J.A.R.V.I.S',
    html: `<div style="${style}">${logo}<p>Olá, <strong>${name}</strong>!</p><p style="margin-top:12px">Seu código de desbloqueio:</p><div style="background:#070b14;border:1px solid #00d4ff;padding:24px;text-align:center;margin:20px 0;border-radius:8px"><span style="font-size:40px;color:#00d4ff;letter-spacing:16px;font-weight:900">${code}</span></div><p style="color:#6a94b8;font-size:12px">Expira em 30 minutos. Se não foi você, ignore este e-mail.</p></div>`,
  });
}

async function sendWelcome(email, name, plan) {
  await transporter.sendMail({
    from: '"J.A.R.V.I.S" <iajarvis2026@gmail.com>',
    to: email,
    subject: '👋 Bem-vindo ao J.A.R.V.I.S!',
    html: `<div style="${style}">${logo}<p>Olá, <strong>${name}</strong>! Seja bem-vindo.</p><p style="margin-top:12px">Você ativou o plano <strong style="color:#00d4ff">${plan || 'Trial'}</strong>. Aproveite os 5 dias gratuitos!</p><div style="background:#070b14;border:1px solid rgba(0,212,255,0.2);padding:20px;margin:20px 0;border-radius:8px"><p style="color:#00d4ff;font-size:11px;letter-spacing:2px;margin-bottom:12px">PARA COMEÇAR:</p><p>🎙 Ative o microfone clicando no orbe</p><p style="margin-top:8px">➕ Crie seus planos de rotina</p><p style="margin-top:8px">💬 Converse com o Jarvis</p></div></div>`,
  });
}

module.exports = { sendUnlockCode, sendWelcome };
