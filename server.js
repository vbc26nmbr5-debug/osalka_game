const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 10000;

// Отдаём index.html и остальные файлы
app.use(express.static(path.join(__dirname)));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const rooms = new Map();

function generateCode() {
  let code;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (rooms.has(code));
  return code;
}

function publish(room) {
  io.to(room.code).emit("state", {
    players: room.players,
    started: room.started
  });
}

io.on("connection", socket => {

  socket.on("create", ({ name }, cb) => {
    const code = generateCode();

    const room = {
      code,
      host: socket.id,
      players: [],
      started: false
    };

    rooms.set(code, room);
    socket.join(code);
    socket.data.room = code;

    room.players.push({
      id: socket.id,
      name: String(name || "Игрок"),
      tagged: false
    });

    cb({ ok: true, code });
    publish(room);
  });

  socket.on("join", ({ code, name }, cb) => {
    const room = rooms.get(String(code || "").trim());

    if (!room)
      return cb({ ok: false, error: "Комната не найдена" });

    if (room.started)
      return cb({ ok: false, error: "Игра уже началась" });

    if (room.players.length >= 35)
      return cb({ ok: false, error: "Комната заполнена (максимум 35 игроков)" });

    socket.join(room.code);
    socket.data.room = room.code;

    room.players.push({
      id: socket.id,
      name: String(name || "Игрок"),
      tagged: false
    });

    cb({ ok: true, code: room.code });
    publish(room);
  });

  socket.on("start", cb => {
    const room = rooms.get(socket.data.room);

    if (!room)
      return cb?.({ ok: false, error: "Комната не найдена" });

    if (socket.id !== room.host)
      return cb?.({ ok: false, error: "Только создатель может начать игру" });

    if (room.players.length < 2)
      return cb?.({ ok: false, error: "Нужно минимум 2 игрока" });

    room.started = true;

    publish(room);
    cb?.({ ok: true });
  });

  socket.on("tag", id => {
    const room = rooms.get(socket.data.room);

    if (!room || !room.started) return;

    const player = room.players.find(p => p.id === id);

    if (player) {
      player.tagged = true;
      publish(room);
    }
  });

  socket.on("disconnect", () => {
    const code = socket.data.room;
    const room = rooms.get(code);

    if (!room) return;

    room.players = room.players.filter(p => p.id !== socket.id);

    if (room.players.length === 0) {
      rooms.delete(code);
      return;
    }

    if (room.host === socket.id) {
      room.host = room.players[0].id;
    }

    publish(room);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
