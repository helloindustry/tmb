const siteTitleEl = document.getElementById('site-title');
const brandNameEl = document.getElementById('brand-name');
const joinScreen = document.getElementById('join-screen');
const chatScreen = document.getElementById('chat-screen');
const joinForm = document.getElementById('join-form');
const adminForm = document.getElementById('admin-form');
const roomsNav = document.getElementById('rooms');
const roomTitle = document.getElementById('room-title');
const roomHint = document.getElementById('room-hint');
const messagesEl = document.getElementById('messages');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message');
const typingEl = document.getElementById('typing');

let state = {
  user: null,
  rooms: [],
  currentRoom: null,
  readonlyRooms: [],
  typingTimeout: null,
};

async function join(inviteCode, displayName) {
  const res = await fetch('/api/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inviteCode, displayName }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'join failed');
  state.user = data.user;
  state.readonlyRooms = data.readonlyRooms || [];
  siteTitleEl.textContent = data.siteName || 'TMB Chat';
  brandNameEl.textContent = data.siteName || 'TMB Chat';
  joinScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');
  setupSocket();
}

async function upgradeAdmin(adminCode) {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminCode }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'admin failed');
  state.user = data.user;
  alert('You are now an admin.');
  updateRoomHint();
}

function renderRooms() {
  roomsNav.innerHTML = '';
  state.rooms.forEach(r => {
    const a = document.createElement('a');
    a.href = '#';
    a.className = 'room' + (state.currentRoom === r.slug ? ' active' : '');
    a.textContent = '# ' + r.name;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      switchRoom(r.slug, r.name);
    });
    roomsNav.appendChild(a);
  });
}

function renderMessages(messages) {
  messagesEl.innerHTML = '';
  messages.forEach(m => messagesEl.appendChild(renderMessage(m)));
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderMessage(m) {
  const div = document.createElement('div');
  div.className = 'msg';
  div.dataset.id = m.id;
  const date = new Date(m.createdAt);
  const time = date.toLocaleString([], { hour: 'numeric', minute: '2-digit' });
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = `${m.userName} • ${time}`;
  const text = document.createElement('div');
  text.className = 'text';
  text.textContent = m.text;
  div.appendChild(meta);
  div.appendChild(text);
  return div;
}

function setupSocket() {
  const socket = io();
  socket.emit('hello', { id: state.user.id, displayName: state.user.displayName, isAdmin: state.user.isAdmin });

  socket.on('rooms', (rooms) => {
    state.rooms = rooms;
    renderRooms();
    if (!state.currentRoom && rooms[0]) {
      switchRoom(rooms[0].slug, rooms[0].name);
    }
  });

  socket.on('room:history', ({ slug, messages, readonly }) => {
    if (slug !== state.currentRoom) return;
    renderMessages(messages);
    updateRoomHint(readonly);
  });

  socket.on('message', (msg) => {
    if (!state.currentRoom) return;
    messagesEl.appendChild(renderMessage(msg));
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });

  socket.on('typing', ({ user, isTyping }) => {
    typingEl.textContent = isTyping ? `${user} is typing…` : '';
  });

  messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text || !state.currentRoom) return;
    if (state.readonlyRooms.includes(state.currentRoom) && !state.user.isAdmin) {
      alert('This room is read-only.');
      return;
    }
    socket.emit('message:new', { slug: state.currentRoom, text });
    messageInput.value = '';
  });

  messageInput.addEventListener('input', () => {
    if (!state.currentRoom) return;
    socket.emit('typing', { slug: state.currentRoom, isTyping: true });
    clearTimeout(state.typingTimeout);
    state.typingTimeout = setTimeout(() => {
      socket.emit('typing', { slug: state.currentRoom, isTyping: false });
    }, 1000);
  });

  window.switchRoom = (slug, name) => {
    state.currentRoom = slug;
    roomTitle.textContent = '# ' + name;
    renderRooms();
    socket.emit('room:join', { slug });
  };
}

function switchRoom(slug, name) {
  if (window.switchRoom) window.switchRoom(slug, name);
}

function updateRoomHint(readonlyFromServer) {
  const readonly = typeof readonlyFromServer === 'boolean'
    ? readonlyFromServer
    : (state.readonlyRooms.includes(state.currentRoom) && !state.user?.isAdmin);
  roomHint.textContent = readonly ? 'Read-only (admins can post)' : '';
}

joinForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const inviteCode = document.getElementById('inviteCode').value.trim();
  const displayName = document.getElementById('displayName').value.trim();
  try {
    await join(inviteCode, displayName);
  } catch (err) {
    alert(err.message || 'Could not join');
  }
});

adminForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const adminCode = document.getElementById('adminCode').value.trim();
  if (!adminCode) return;
  try {
    await upgradeAdmin(adminCode);
  } catch (err) {
    alert(err.message || 'Could not upgrade');
  }
});
