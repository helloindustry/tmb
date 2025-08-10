const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '..', 'data.sqlite'));

function init() {
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (room_id) REFERENCES rooms(id)
    );
  `);
}

function uid() {
  return (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 16);
}

function createRoom(slug, name) {
  const id = uid();
  const stmt = db.prepare('INSERT INTO rooms (id, slug, name) VALUES (?, ?, ?)');
  try {
    stmt.run(id, slug, name);
  } catch (e) {
    if (e.message.includes('UNIQUE')) throw new Error('slug already exists');
    throw e;
  }
  return { id, slug, name };
}

function getRoomCount() {
  const row = db.prepare('SELECT COUNT(*) as c FROM rooms').get();
  return row.c;
}

function listRooms() {
  return db.prepare('SELECT id, slug, name FROM rooms ORDER BY name').all();
}

function getRoomBySlug(slug) {
  return db.prepare('SELECT id, slug, name FROM rooms WHERE slug = ?').get(slug);
}

function createMessage({ roomId, userName, text }) {
  const id = uid();
  const createdAt = Date.now();
  db.prepare('INSERT INTO messages (id, room_id, user_name, text, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, roomId, userName, text, createdAt);
  return { id, roomId, userName, text, createdAt };
}

function listMessages(roomId, limit = 100) {
  return db.prepare('SELECT id, room_id as roomId, user_name as userName, text, created_at as createdAt FROM messages WHERE room_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(roomId, limit)
    .reverse();
}

function deleteMessage(id) {
  db.prepare('DELETE FROM messages WHERE id = ?').run(id);
}

module.exports = {
  init,
  createRoom,
  listRooms,
  getRoomBySlug,
  getRoomCount,
  createMessage,
  listMessages,
  deleteMessage,
};
