import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { GameRoom } from './GameRoom.js';

const PORT = process.env.PORT || 3000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';

const app = express();
app.use(cors());
app.get('/health', (_, res) => res.json({ ok: true }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN, methods: ['GET', 'POST'] },
});

// roomCode -> GameRoom
const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id} connected`);
  let currentRoom = null;

  socket.on('room:create', ({ playerName }) => {
    const code = generateRoomCode();
    const room = new GameRoom(io, code);
    rooms.set(code, room);
    currentRoom = code;
    const ok = room.addPlayer(socket, playerName);
    socket.emit('room:joined', { roomCode: code, ok });
    console.log(`[room] created ${code} by ${socket.id}`);
  });

  socket.on('room:join', ({ roomCode, playerName }) => {
    const code = roomCode.toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) {
      socket.emit('room:error', { message: 'Room not found.' });
      return;
    }
    const ok = room.addPlayer(socket, playerName);
    if (!ok) {
      socket.emit('room:error', { message: 'Room is full or game already started.' });
      return;
    }
    currentRoom = code;
    socket.emit('room:joined', { roomCode: code, ok });
  });

  socket.on('room:start', () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player) return;
    // Only host (first real player) can start
    const firstReal = Array.from(room.players.values()).find(p => !p.isBot);
    if (firstReal?.id !== socket.id) return;
    room.startGame();
  });

  socket.on('player:move', (data) => {
    if (!currentRoom) return;
    rooms.get(currentRoom)?.movePlayer(socket.id, data);
  });

  socket.on('action:kill', ({ targetId }) => {
    if (!currentRoom) return;
    rooms.get(currentRoom)?.attemptKill(socket.id, targetId);
  });

  socket.on('action:kidnap_start', ({ targetId }) => {
    if (!currentRoom) return;
    rooms.get(currentRoom)?.startKidnap(socket.id, targetId);
  });

  socket.on('action:kidnap_complete', () => {
    if (!currentRoom) return;
    rooms.get(currentRoom)?.completeKidnap(socket.id);
  });

  socket.on('action:break_free', () => {
    if (!currentRoom) return;
    rooms.get(currentRoom)?.breakFree(socket.id);
  });

  socket.on('disconnect', () => {
    console.log(`[-] ${socket.id} disconnected`);
    if (currentRoom) {
      const room = rooms.get(currentRoom);
      if (room) {
        room.removePlayer(socket.id);
        if (room.players.size === 0) {
          rooms.delete(currentRoom);
          console.log(`[room] deleted ${currentRoom}`);
        }
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Simon Says Assassin server running on port ${PORT}`);

  // Keep Render free tier awake by self-pinging every 10 minutes
  const SELF_URL = process.env.RENDER_EXTERNAL_URL;
  if (SELF_URL) {
    setInterval(() => {
      fetch(`${SELF_URL}/health`).catch(() => {});
    }, 10 * 60 * 1000);
  }
});
