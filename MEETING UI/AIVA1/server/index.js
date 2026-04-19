require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { sequelize } = require('./models');
const authRoutes = require('./routes/auth');
const meetingRoutes = require('./routes/meetings');
const { setupSocketHandlers } = require('./socket/handlers');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// ─── Socket.IO ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: true, methods: ['GET', 'POST'], credentials: true },
  transports: ['websocket', 'polling'],
});
setupSocketHandlers(io);

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function boot() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');
    await sequelize.sync();
    console.log('✅ Database synced');
    server.listen(PORT, () => {
      console.log(`🚀 AIVA Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Boot error:', err.message);
    console.log('⚠️  Starting server without DB (DB connection failed)');
    server.listen(PORT, () => {
      console.log(`🚀 AIVA Server running on http://localhost:${PORT} (no DB)`);
    });
  }
}

boot();
