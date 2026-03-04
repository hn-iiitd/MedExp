// Authentication middleware - validates user session
const { getDb } = require('../db/database');

function authMiddleware(req, res, next) {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    return res.status(401).json({ error: 'Invalid user' });
  }

  req.user = user;
  next();
}

module.exports = authMiddleware;
