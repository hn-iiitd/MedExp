// Authentication routes - Google OAuth flow
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { getAuthUrl, getTokensFromCode, getUserInfo } = require('../services/googleAuth');

// GET /api/auth/google - Get Google OAuth URL
router.get('/google', (req, res) => {
  const url = getAuthUrl();
  res.json({ url });
});

// GET /api/auth/google/callback - Handle OAuth callback
router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.redirect(`${process.env.CLIENT_URL}/login?error=no_code`);
    }

    const tokens = await getTokensFromCode(code);
    const userInfo = await getUserInfo(tokens.access_token);

    const db = getDb();

    // Upsert user
    const existing = db.prepare('SELECT * FROM users WHERE google_id = ?').get(userInfo.id);

    let userId;
    if (existing) {
      db.prepare(`
        UPDATE users SET 
          email = ?, name = ?, picture = ?, access_token = ?, 
          refresh_token = COALESCE(?, refresh_token)
        WHERE google_id = ?
      `).run(
        userInfo.email,
        userInfo.name,
        userInfo.picture,
        tokens.access_token,
        tokens.refresh_token || null,
        userInfo.id
      );
      userId = existing.id;
    } else {
      const result = db.prepare(`
        INSERT INTO users (google_id, email, name, picture, access_token, refresh_token)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        userInfo.id,
        userInfo.email,
        userInfo.name,
        userInfo.picture,
        tokens.access_token,
        tokens.refresh_token || null
      );
      userId = result.lastInsertRowid;
    }

    // Redirect to frontend with user ID (simple session via query param)
    res.redirect(`${process.env.CLIENT_URL}/auth-callback?userId=${userId}`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect(`${process.env.CLIENT_URL}/login?error=auth_failed`);
  }
});

// GET /api/auth/me - Get current user info
router.get('/me', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const db = getDb();
  const user = db.prepare('SELECT id, email, name, picture FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(401).json({ error: 'User not found' });

  res.json(user);
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.json({ success: true });
});

module.exports = router;
