const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'jarvis_final_ultra_secure_2026';

module.exports = function(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'Token não fornecido' });
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch(e) {
    return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
  }
};
