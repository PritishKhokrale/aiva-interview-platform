// DB models are optional — socket handlers work without MySQL
let Transcript = null, ChatMessage = null;
try {
  const models = require('../models');
  Transcript = models.Transcript;
  ChatMessage = models.ChatMessage;
} catch (e) {}

// In-memory fallback for when DB is unavailable
const memChats = [];
const memTranscripts = [];

async function persistChat(data) {
  if (ChatMessage) { try { await ChatMessage.create(data); return; } catch {} }
  memChats.push(data);
}

async function persistTranscript(data) {
  if (Transcript) { try { await Transcript.create(data); return; } catch {} }
  memTranscripts.push(data);
}


// roomParticipants: { [roomId]: { [socketId]: { name, email, socketId } } }
const roomParticipants = {};

// pendingCandidates: { [roomId]: { [socketId]: { name, email, socketId } } }
const pendingCandidates = {};

// Meeting-level state
const meetingLocked = {};           // { roomId: bool }
const participantRoles = {};         // { roomId: { socketId: role } }

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // ─── JOIN ROOM ───────────────────────────────────────────────────────────
    socket.on('join-room', ({ roomId, name, email }) => {
      if (meetingLocked[roomId]) { socket.emit('meeting-locked'); return; }
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.name = name || 'Guest';
      socket.data.email = email || '';

      if (!roomParticipants[roomId]) roomParticipants[roomId] = {};

      // Send existing participants to the new joiner
      const existingParticipants = Object.values(roomParticipants[roomId]);
      socket.emit('room-state', { participants: existingParticipants, socketId: socket.id });

      // Add the new participant to the room map
      roomParticipants[roomId][socket.id] = { socketId: socket.id, name: socket.data.name, email: socket.data.email };

      // Notify others that someone joined
      socket.to(roomId).emit('participant-joined', {
        socketId: socket.id,
        name: socket.data.name,
        email: socket.data.email,
      });

      console.log(`${name} joined room ${roomId}. Participants: ${Object.keys(roomParticipants[roomId]).length}`);
    });

    // ─── WebRTC SIGNALING ────────────────────────────────────────────────────
    socket.on('offer', ({ targetSocketId, offer }) => {
      io.to(targetSocketId).emit('offer', {
        fromSocketId: socket.id,
        fromName: socket.data.name,
        offer,
      });
    });

    socket.on('answer', ({ targetSocketId, answer }) => {
      io.to(targetSocketId).emit('answer', {
        fromSocketId: socket.id,
        answer,
      });
    });

    socket.on('ice-candidate', ({ targetSocketId, candidate }) => {
      io.to(targetSocketId).emit('ice-candidate', {
        fromSocketId: socket.id,
        candidate,
      });
    });

    // ─── CHAT ────────────────────────────────────────────────────────────────
    socket.on('chat-message', async ({ roomId, text }) => {
      const msg = {
        id: Date.now().toString(),
        senderName: socket.data.name,
        senderEmail: socket.data.email,
        text,
        timestamp: new Date().toISOString(),
      };
      io.to(roomId).emit('chat-message', msg);
      persistChat({ meetingId: roomId, senderName: socket.data.name, senderEmail: socket.data.email, text });
    });

    // ─── CODE EDITOR ─────────────────────────────────────────────────────────
    socket.on('code-editor-update', ({ roomId, code }) => {
      socket.to(roomId).emit('code-editor-update', { code, socketId: socket.id });
    });

    // ─── TRANSCRIPT ──────────────────────────────────────────────────────────
    socket.on('transcript-update', async ({ roomId, text }) => {
      const entry = {
        id: Date.now().toString(),
        speakerName: socket.data.name,
        speakerEmail: socket.data.email,
        text,
        timestamp: new Date().toISOString(),
      };
      io.to(roomId).emit('transcript-update', entry);
      persistTranscript({ meetingId: roomId, speakerName: socket.data.name, speakerEmail: socket.data.email, text });
    });

    // ─── SPEAKING STATE ──────────────────────────────────────────────────────
    socket.on('speaking-state', ({ roomId, isSpeaking }) => {
      socket.to(roomId).emit('speaking-state', {
        socketId: socket.id,
        isSpeaking,
      });
    });

    // ─── RAISE HAND ──────────────────────────────────────────────────────────
    socket.on('raise-hand', ({ roomId, raised }) => {
      io.to(roomId).emit('raise-hand', {
        socketId: socket.id,
        name: socket.data.name,
        raised,
      });
    });

    // ─── ANTI-CHEAT VIOLATION ────────────────────────────────────────────────
    socket.on('anti-cheat-violation', ({ roomId, violationType, count }) => {
      socket.to(roomId).emit('anti-cheat-violation', {
        socketId: socket.id,
        name: socket.data.name,
        violationType,
        count,
      });
    });

    // ─── REMOVE PARTICIPANT ──────────────────────────────────────────────────
    socket.on('remove-participant', ({ roomId, targetSocketId }) => {
      io.to(targetSocketId).emit('kicked');
      io.to(targetSocketId).socketsLeave(roomId);
      if (roomParticipants[roomId]) {
        delete roomParticipants[roomId][targetSocketId];
      }
      io.to(roomId).emit('participant-left', { socketId: targetSocketId });
    });

    // ─── END MEETING ─────────────────────────────────────────────────────────
    socket.on('end-meeting', ({ roomId }) => {
      io.to(roomId).emit('meeting-ended');
    });

    // ─── MEDIA & RECORDING STATE ─────────────────────────────────────────────
    socket.on('recording-state', ({ roomId, isRecording }) => {
      socket.to(roomId).emit('recording-state', { socketId: socket.id, isRecording });
    });
    socket.on('media-state-update', ({ roomId, isVideoOff, isMuted }) => {
      socket.to(roomId).emit('media-state-update', { socketId: socket.id, isVideoOff, isMuted });
    });

    // ─── HOST CONTROL EVENTS ─────────────────────────────────────────────────
    socket.on('meeting-lock', ({ roomId, locked }) => {
      meetingLocked[roomId] = locked;
      io.to(roomId).emit('meeting-lock-update', { locked });
    });
    socket.on('host-mute-user', ({ roomId, targetSocketId }) => {
      io.to(targetSocketId).emit('force-mute');
      io.to(roomId).emit('participant-muted', { socketId: targetSocketId });
    });
    socket.on('host-request-camera', ({ roomId, targetSocketId, turn }) => {
      io.to(targetSocketId).emit('camera-request', { turn });
    });
    socket.on('host-disable-screenshare', ({ roomId, targetSocketId }) => {
      io.to(targetSocketId).emit('force-stop-screenshare');
    });
    socket.on('host-promote-cohost', ({ roomId, targetSocketId }) => {
      if (!participantRoles[roomId]) participantRoles[roomId] = {};
      participantRoles[roomId][targetSocketId] = 'cohost';
      io.to(roomId).emit('role-update', { socketId: targetSocketId, role: 'cohost' });
    });
    socket.on('recording-permission', ({ roomId, targetSocketId, granted }) => {
      io.to(targetSocketId).emit('recording-permission', { granted });
    });
    socket.on('interview-mode-update', ({ roomId, settings }) => {
      io.to(roomId).emit('interview-mode-update', settings);
    });
    socket.on('timer-update', ({ roomId, timerState }) => {
      socket.to(roomId).emit('timer-update', timerState);
    });

    // ─── WAITING ROOM: candidate knocks ─────────────────────────────────────
    socket.on('request-join', ({ roomId, name, email }) => {
      if (!pendingCandidates[roomId]) pendingCandidates[roomId] = {};
      pendingCandidates[roomId][socket.id] = { socketId: socket.id, name: name || 'Guest', email: email || '' };
      socket.data.waitingIn = roomId;
      socket.data.name = name || 'Guest';
      socket.data.email = email || '';
      // Tell everyone in the room (host) that someone is knocking
      socket.to(roomId).emit('join-request', { socketId: socket.id, name: name || 'Guest', email: email || '' });
      console.log(`${name} is waiting to join ${roomId}`);
    });

    // ─── WAITING ROOM: host admits ────────────────────────────────────────────
    socket.on('admit-candidate', ({ roomId, targetSocketId }) => {
      if (pendingCandidates[roomId]) delete pendingCandidates[roomId][targetSocketId];
      io.to(targetSocketId).emit('admitted', { roomId });
      io.to(roomId).emit('candidate-admitted', { socketId: targetSocketId });
    });

    // ─── WAITING ROOM: host rejects ───────────────────────────────────────────
    socket.on('reject-candidate', ({ roomId, targetSocketId }) => {
      if (pendingCandidates[roomId]) delete pendingCandidates[roomId][targetSocketId];
      io.to(targetSocketId).emit('rejected');
    });

    // ─── DISCONNECT ──────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const roomId = socket.data.roomId;
      if (roomId && roomParticipants[roomId]) {
        delete roomParticipants[roomId][socket.id];
        if (Object.keys(roomParticipants[roomId]).length === 0) {
          delete roomParticipants[roomId];
        }
        socket.to(roomId).emit('participant-left', { socketId: socket.id });
      }
      // Clean up waiting room
      const waitingIn = socket.data.waitingIn;
      if (waitingIn && pendingCandidates[waitingIn]) {
        delete pendingCandidates[waitingIn][socket.id];
        socket.to(waitingIn).emit('candidate-left-waiting', { socketId: socket.id });
      }
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}

module.exports = { setupSocketHandlers };
