const express = require('express');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const router = express.Router();

// ─── In-Memory Fallback Store ─────────────────────────────────────────────────
// Used when MySQL is unavailable. Persists for the lifetime of the server process.
const memUsers = new Map(); // email -> user object

function memFindUser(email) {
  return memUsers.get(email) || null;
}

function memCreateUser(data) {
  const user = {
    id: uuidv4(),
    email: data.email,
    name: data.name,
    password: data.password || null,
    googleId: data.googleId || null,
    picture: data.picture || null,
  };
  memUsers.set(user.email, user);
  return user;
}

function safeUser(u) {
  return { id: u.id, email: u.email, name: u.name, picture: u.picture };
}

// ─── Try to load DB models (optional) ────────────────────────────────────────
let User = null;
try {
  const models = require('../models');
  User = models.User;
} catch (e) {}

// ─── Helper: find or create user (DB-first, mem fallback) ────────────────────
async function dbFindUser(email) {
  if (!User) return null;
  try { return await User.findOne({ where: { email } }); } catch { return null; }
}

async function dbCreateUser(data) {
  if (!User) return null;
  try { return await User.create(data); } catch { return null; }
}

async function dbUpdateUser(user, data) {
  if (!user || !User) return;
  try { await user.update(data); } catch {}
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { email, name, password } = req.body;
    if (!email || !name || !password)
      return res.status(400).json({ error: 'All fields required' });

    // Check existing
    const existingDb = await dbFindUser(email);
    if (existingDb) return res.status(409).json({ error: 'Email already registered' });
    if (memFindUser(email)) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);

    // Try DB first, fall back to memory
    const dbUser = await dbCreateUser({ email, name, password: hash });
    if (dbUser) return res.json(safeUser(dbUser));

    const memUser = memCreateUser({ email, name, password: hash });
    return res.json(safeUser(memUser));
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required' });

    // Try DB first
    let user = await dbFindUser(email);
    if (user) {
      const match = await bcrypt.compare(password, user.password || '');
      if (!match) return res.status(401).json({ error: 'Invalid credentials' });
      return res.json(safeUser(user));
    }

    // Fall back to memory
    const memUser = memFindUser(email);
    if (!memUser || !memUser.password)
      return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, memUser.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    return res.json(safeUser(memUser));
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ─── POST /api/auth/google ────────────────────────────────────────────────────
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Missing credential' });

    // Decode JWT payload (base64) without verifying — simple local mode
    const [, payloadB64] = credential.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    const { email, name, sub: googleId, picture } = payload;

    let user = await dbFindUser(email);
    if (user) {
      await dbUpdateUser(user, { googleId, picture, name });
      return res.json(safeUser(user));
    }
    const memUser = memFindUser(email);
    if (memUser) {
      Object.assign(memUser, { googleId, picture, name });
      return res.json(safeUser(memUser));
    }

    // Create new
    const dbUser = await dbCreateUser({ email, name: name || email, googleId, picture });
    if (dbUser) return res.json(safeUser(dbUser));
    return res.json(safeUser(memCreateUser({ email, name: name || email, googleId, picture })));
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(401).json({ error: 'Google authentication failed: ' + err.message });
  }
});

// ─── POST /api/auth/google-token ─────────────────────────────────────────────
router.post('/google-token', async (req, res) => {
  try {
    const { userInfo } = req.body;
    if (!userInfo?.email) return res.status(400).json({ error: 'Missing user info' });
    const { email, name, sub: googleId, picture } = userInfo;

    let user = await dbFindUser(email);
    if (user) {
      await dbUpdateUser(user, { googleId, picture, name });
      return res.json(safeUser(user));
    }
    const memUser = memFindUser(email);
    if (memUser) {
      Object.assign(memUser, { googleId: googleId || memUser.googleId, picture, name });
      return res.json(safeUser(memUser));
    }

    const dbUser = await dbCreateUser({ email, name: name || email, googleId, picture });
    if (dbUser) return res.json(safeUser(dbUser));
    return res.json(safeUser(memCreateUser({ email, name: name || email, googleId, picture })));
  } catch (err) {
    console.error('Google token error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ─── GET /api/auth/me?email= ──────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const dbUser = await dbFindUser(email);
    if (dbUser) return res.json(safeUser(dbUser));

    const memUser = memFindUser(email);
    if (memUser) return res.json(safeUser(memUser));

    return res.status(404).json({ error: 'User not found' });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

module.exports = router;
