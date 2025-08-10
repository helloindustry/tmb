# TMB Chat (Lightweight Campfire-style)

A tiny, self-hostable chat for The Music Building. No ads, no algorithm, just rooms and messages.

## Features
- Invite-code join (no accounts/passwords)
- Rooms (channels): Announcements (read-only), General, Events, Ideas
- Realtime chat (Socket.IO) with message history (SQLite)
- Optional admin mode (create rooms, delete messages)
- Minimal, mobile-friendly UI
- Single process, file DB (SQLite). Easy backup and move.

---

## 🚀 One‑click deploy (Render)
This repo includes a `render.yaml` blueprint. Put this code on GitHub, then open:

```
https://render.com/deploy?repo=<YOUR_PUBLIC_GITHUB_REPO_URL>
```

Render will read `render.yaml`, provision a Node service, and a small persistent disk so `data.sqlite` survives deploys.

**Environment variables set during deploy:**
- `SESSION_SECRET` (generate a long random string)
- `INVITE_CODE` (share privately with members)
- `ADMIN_CODE` (for you to unlock admin)
- `SITE_NAME` (e.g., The Music Building)
- `READONLY_ROOMS` (comma slugs, default: `announcements`)

---

## Local quick start
```bash
npm install
cp .env.example .env   # edit values
npm start
```
Visit http://localhost:3000 and enter the invite code from `.env`.

## Backups
- Stop the server and copy `data.sqlite` somewhere safe.
- Or on Render, the disk keeps it across deploys.

## Admin API (optional)
- POST `/api/admin` `{ adminCode }` → upgrades your signed cookie to admin
- POST `/api/rooms` `{ slug, name }` (admin only)
- DELETE `/api/messages/:id` (admin only)

## License
MIT
