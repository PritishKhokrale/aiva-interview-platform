const express = require('express');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const translate = require('translate');
translate.engine = 'google'; // use free google engine

const router = express.Router();

// ─── Translation Proxy ────────────────────────────────────────────────────────
router.post('/translate', async (req, res) => {
  try {
    const { text, from } = req.body;
    if (!text || from === 'en-US') return res.json({ translated: text });
    
    // Extract base language code (e.g. 'mr-IN' -> 'mr')
    const langCode = from.split('-')[0];
    const translated = await translate(text, { from: langCode, to: 'en' });
    
    res.json({ translated });
  } catch (err) {
    console.error('Translation error:', err);
    res.json({ translated: req.body.text }); // fallback to original
  }
});

// ─── In-Memory Meeting Store ──────────────────────────────────────────────────
const memMeetings = new Map(); // id -> meeting
const memTranscripts = []; // flat array
const memChats = [];
const memRecordings = [];

function generateId() {
  return uuidv4().replace(/-/g, '').substring(0, 8);
}

// ─── Try to load DB models (optional) ────────────────────────────────────────
let Meeting = null, Transcript = null, ChatMessage = null, Recording = null;
try {
  const models = require('../models');
  Meeting = models.Meeting;
  Transcript = models.Transcript;
  ChatMessage = models.ChatMessage;
  Recording = models.Recording;
} catch (e) {}

// ─── DB helpers ───────────────────────────────────────────────────────────────
async function tryDb(fn) {
  try { return await fn(); } catch { return null; }
}

// ─── POST /api/meetings ───────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { title, hostEmail, hostName, isScheduled, scheduledFor, invitees } = req.body;
    if (!title || !hostEmail || !hostName)
      return res.status(400).json({ error: 'Missing required fields' });

    const id = generateId();
    const data = {
      id, title, hostEmail, hostName,
      isScheduled: isScheduled || false,
      scheduledFor: scheduledFor || null,
      status: isScheduled ? 'scheduled' : 'active',
      invitees: invitees || [],
      durationSeconds: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Try DB first
    if (Meeting) {
      const dbMeeting = await tryDb(() => Meeting.create(data));
      if (dbMeeting) return res.json(dbMeeting);
    }

    // Memory fallback
    memMeetings.set(id, data);
    return res.json(data);
  } catch (err) {
    console.error('Create meeting error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ─── GET /api/meetings?email= ─────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email required' });

    if (Meeting) {
      const { Op } = require('sequelize');
      const dbList = await tryDb(() => Meeting.findAll({ where: { hostEmail: email }, order: [['createdAt', 'DESC']] }));
      if (dbList) return res.json(dbList);
    }

    // Memory fallback
    const list = [...memMeetings.values()]
      .filter(m => m.hostEmail === email)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ─── GET /api/meetings/:id ────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    if (Meeting) {
      const dbMeeting = await tryDb(() => Meeting.findByPk(req.params.id));
      if (dbMeeting) return res.json(dbMeeting);
    }
    const mem = memMeetings.get(req.params.id);
    if (mem) return res.json(mem);
    return res.status(404).json({ error: 'Meeting not found' });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ─── PATCH /api/meetings/:id/end ─────────────────────────────────────────────
router.patch('/:id/end', async (req, res) => {
  try {
    const { durationSeconds } = req.body;

    if (Meeting) {
      const dbMeeting = await tryDb(() => Meeting.findByPk(req.params.id));
      if (dbMeeting) {
        await dbMeeting.update({ status: 'ended', durationSeconds: durationSeconds || 0 });
        return res.json(dbMeeting);
      }
    }

    const mem = memMeetings.get(req.params.id);
    if (mem) {
      mem.status = 'ended'; mem.durationSeconds = durationSeconds || 0; mem.updatedAt = new Date().toISOString();
      return res.json(mem);
    }
    return res.status(404).json({ error: 'Meeting not found' });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ─── GET /api/meetings/:id/transcript ────────────────────────────────────────
router.get('/:id/transcript', async (req, res) => {
  try {
    if (Transcript) {
      const rows = await tryDb(() => Transcript.findAll({ where: { meetingId: req.params.id }, order: [['createdAt', 'ASC']] }));
      if (rows) return res.json(rows);
    }
    const rows = memTranscripts.filter(t => t.meetingId === req.params.id);
    return res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/meetings/:id/chat ───────────────────────────────────────────────
router.get('/:id/chat', async (req, res) => {
  try {
    if (ChatMessage) {
      const rows = await tryDb(() => ChatMessage.findAll({ where: { meetingId: req.params.id }, order: [['createdAt', 'ASC']] }));
      if (rows) return res.json(rows);
    }
    const rows = memChats.filter(c => c.meetingId === req.params.id);
    return res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/meetings/:id/recording ────────────────────────────────────────
router.post('/:id/recording', async (req, res) => {
  try {
    const { durationSeconds, mimeType } = req.body;
    const rec = {
      id: uuidv4(), meetingId: req.params.id,
      durationSeconds: durationSeconds || 0,
      mimeType: mimeType || 'video/webm',
      filePath: `/recordings/${req.params.id}_${Date.now()}.webm`,
    };
    if (Recording) {
      const dbRec = await tryDb(() => Recording.create(rec));
      if (dbRec) return res.json(dbRec);
    }
    memRecordings.push(rec);
    return res.json(rec);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── DELETE /api/meetings/:id — delete single meeting ────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    if (Meeting) {
      const dbMeeting = await tryDb(() => Meeting.findByPk(req.params.id));
      if (dbMeeting) { await dbMeeting.destroy(); return res.json({ success: true }); }
    }
    if (memMeetings.has(req.params.id)) {
      memMeetings.delete(req.params.id);
      return res.json({ success: true });
    }
    return res.status(404).json({ error: 'Meeting not found' });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ─── DELETE /api/meetings?email=&status= — bulk delete (clear history) ────────
router.delete('/', async (req, res) => {
  try {
    const { email, status } = req.query;
    if (!email) return res.status(400).json({ error: 'Email required' });

    if (Meeting) {
      const where = { hostEmail: email };
      if (status) where.status = status;
      const deleted = await tryDb(() => Meeting.destroy({ where }));
      if (deleted !== null) return res.json({ deleted });
    }

    // Memory fallback
    let count = 0;
    for (const [id, m] of memMeetings.entries()) {
      if (m.hostEmail === email && (!status || m.status === status)) {
        memMeetings.delete(id);
        count++;
      }
    }
    return res.json({ deleted: count });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

module.exports = router;

