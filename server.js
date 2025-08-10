const express = require('express');
const http = require('http');
const path = require('path');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const db = require('./src/db');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret';
const INVITE_CODE = process.env.INVITE_CODE || 'tmb-2025';
const ADMIN_CODE = process.env.ADMIN_CODE || 'let-me-in';
const SITE_NAME = process.env.SITE_NAME || 'TMB Chat';
const READONLY_ROOMS = (process.env.READONLY_ROOMS || '').split(',').map(s => s.trim()).filter(Boolean);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(cookieParser(SESSION_SECRET));
app.use(express.static(path.join(__dirname, 'public')));

function authMiddleware(req, res, next) {
  const session = req.signedCookies.session;
  if (!session) return res.status(401).json({ ok: false, error: 'unauthorized' });
  req.session = session;
  next();
}

app.get('/health', (req, res) => res.json({ ok: true }));

db.init();

if (db.getRoomCount() === 0) {
  db.createRoom('announcements', 'Announcements');
  db.createRoom('general', 'General');
  db.createRoom('events', 'Events');
  db.createRoom('ideas', 'Ideas');
}

app.post('/api/join', (req, res) => {
  const { inviteCode, displayName } = req.body || {};
  if (!inviteCode || !displayName) {
    return res.status(400).json({ ok: false, error: 'missing fields' });
  }
  if (inviteCode !== INVITE_CODE) {
    return res.status(403).json({ ok: false, error: 'invalid invite code' });
  }
  const userId = uuidv4();
  const isAdmin = false;
  const user = { id: userId, displayName: String(displayName).slice(0, 40), isAdmin };
  res.cookie('session', user, { signed: true, httpOnly: true, sameSite: 'lax' });
  return res.json({ ok: true, user, siteName: SITE_NAME, readonlyRooms: READONLY_ROOMS });
});

app.post('/api/admin', authMiddleware, (req, res) => {
  const { adminCode } = req.body || {};
  if (adminCode !== ADMIN_CODE) return res.status(403).json({ ok: false, error: 'invalid admin code' });
  const session = req.session;
  session.isAdmin = true;
  res.cookie('session', session, { signed: true, httpOnly: true, sameSite: 'lax' });
  return res.json({ ok: true, user: session });
});

app.get('/api/rooms', authMiddleware, (req, res) => {
  return res.json({ ok: true, rooms: db.listRooms(), readonlyRooms: READONLY_ROOMS });
});

app.post('/api/rooms', authMiddleware, (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ ok: false, error: 'forbidden' });
  const { slug, name } = req.body || {};
  if (!slug || !name) return res.status(400).json({ ok: false, error: 'missing fields' });
  try {
    const room = db.createRoom(slug, name);
    return res.json({ ok: true, room });
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.message });
  }
});

app.delete('/api/messages/:id', authMiddleware, (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ ok: false, error: 'forbidden' });
  const id = req.params.id;
  db.deleteMessage(id);
  io.emit('message:deleted', { id });
  return res.json({ ok: true });
});

io.on('connection', (socket) => {
  let user = null;

  socket.on('hello', (payload) => {
    user = {
      id: payload?.id || uuidv4(),
      displayName: payload?.displayName?.slice(0, 40) || 'Guest',
      isAdmin: !!payload?.isAdmin
    };
    socket.emit('rooms', db.listRooms());
  });

  socket.on('room:join', ({ slug }) => {
    const room = db.getRoomBySlug(slug);
    if (!room) return;
    [...socket.rooms].forEach(r => { if (String(r).startsWith('room:')) socket.leave(r); });
    socket.join(`room:${slug}`);
    const recent = db.listMessages(room.id, 200);
    socket.emit('room:history', { slug, messages: recent, readonly: READONLY_ROOMS.includes(slug) && !user?.isAdmin });
  });

  socket.on('message:new', ({ slug, text }) => {
    if (!text || !slug) return;
    const clean = String(text).slice(0, 4000).trim();
    if (!clean) return;
    const room = db.getRoomBySlug(slug);
    if (!room) return;
    const isReadonly = READONLY_ROOMS.includes(slug) && !(user?.isAdmin);
    if (isReadonly) return;
    const msg = db.createMessage({
      roomId: room.id,
      userName: user?.displayName || 'Guest',
      text: clean
    });
    io.to(`room:${slug}`).emit('message', msg);
  });

  socket.on('typing', ({ slug, isTyping }) => {
    socket.to(`room:${slug}`).emit('typing', { user: user?.displayName || 'Guest', isTyping: !!isTyping });
  });
});

server.listen(PORT, () => {
  console.log(`TMB Chat running on http://localhost:${PORT}`);
});
