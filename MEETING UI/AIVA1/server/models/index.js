const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: false,
});

// ─── User Model ───────────────────────────────────────────────────────────────
const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: true },
  googleId: { type: DataTypes.STRING, allowNull: true },
  picture: { type: DataTypes.STRING, allowNull: true },
}, { tableName: 'users', timestamps: true });

// ─── Meeting Model ────────────────────────────────────────────────────────────
const Meeting = sequelize.define('Meeting', {
  id: { type: DataTypes.STRING(12), primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  hostEmail: { type: DataTypes.STRING, allowNull: false },
  hostName: { type: DataTypes.STRING, allowNull: false },
  isScheduled: { type: DataTypes.BOOLEAN, defaultValue: false },
  scheduledFor: { type: DataTypes.DATE, allowNull: true },
  status: { type: DataTypes.ENUM('scheduled', 'active', 'ended'), defaultValue: 'active' },
  invitees: { type: DataTypes.JSON, defaultValue: [] },
  durationSeconds: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: 'meetings', timestamps: true });

// ─── Transcript Model ─────────────────────────────────────────────────────────
const Transcript = sequelize.define('Transcript', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  meetingId: { type: DataTypes.STRING(12), allowNull: false },
  speakerName: { type: DataTypes.STRING, allowNull: false },
  speakerEmail: { type: DataTypes.STRING, allowNull: true },
  text: { type: DataTypes.TEXT, allowNull: false },
}, { tableName: 'transcripts', timestamps: true });

// ─── ChatMessage Model ────────────────────────────────────────────────────────
const ChatMessage = sequelize.define('ChatMessage', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  meetingId: { type: DataTypes.STRING(12), allowNull: false },
  senderName: { type: DataTypes.STRING, allowNull: false },
  senderEmail: { type: DataTypes.STRING, allowNull: true },
  text: { type: DataTypes.TEXT, allowNull: false },
}, { tableName: 'chat_messages', timestamps: true });

// ─── Recording Model ──────────────────────────────────────────────────────────
const Recording = sequelize.define('Recording', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  meetingId: { type: DataTypes.STRING(12), allowNull: false },
  durationSeconds: { type: DataTypes.INTEGER, defaultValue: 0 },
  mimeType: { type: DataTypes.STRING, defaultValue: 'video/webm' },
  filePath: { type: DataTypes.STRING, allowNull: true },
}, { tableName: 'recordings', timestamps: true });

module.exports = { sequelize, User, Meeting, Transcript, ChatMessage, Recording };
