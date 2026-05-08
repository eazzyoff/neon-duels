const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// Раздаем статические файлы из папки public
app.use(express.static('public'));

// Хранилище активных комнат
const rooms = {};

io.on('connection', (socket) => {
    console.log(`[+] Игрок подключился: ${socket.id}`);

    // Создание новой комнаты (Хост)
    socket.on('createRoom', () => {
        const roomId = Math.floor(1000 + Math.random() * 9000).toString();
        rooms[roomId] = { host: socket.id, client: null };
        
        socket.join(roomId);
        socket.emit('roomCreated', roomId);
        console.log(`[ROOM] Создана комната ${roomId} хостом ${socket.id}`);
    });

    // Подключение к комнате (Клиент)
    socket.on('joinRoom', (roomId) => {
        if (rooms[roomId]) {
            if (!rooms[roomId].client) {
                rooms[roomId].client = socket.id;
                socket.join(roomId);
                socket.emit('joinedRoom', roomId);
                io.to(rooms[roomId].host).emit('clientJoined');
                console.log(`[ROOM] Игрок ${socket.id} вошел в комнату ${roomId}`);
            } else {
                socket.emit('errorMsg', 'Комната уже полна! Бой идет.');
            }
        } else {
            socket.emit('errorMsg', 'Комната с таким кодом не найдена!');
        }
    });

    // Ретрансляция игровых данных (Координаты, нажатия клавиш и т.д.)
    socket.on('gameData', (data) => {
        // Ищем комнату игрока (индекс 1, т.к. индекс 0 это сам socket.id)
        const room = Array.from(socket.rooms)[1];
        if (room) {
            // Отправляем данные всем в комнате, КРОМЕ отправителя
            socket.to(room).emit('gameData', data);
        }
    });

    // Обработка отключения
    socket.on('disconnect', () => {
        console.log(`[-] Игрок отключился: ${socket.id}`);
        // Ищем комнату игрока и уничтожаем её, сообщая второму игроку
        for (const roomId in rooms) {
            if (rooms[roomId].host === socket.id || rooms[roomId].client === socket.id) {
                socket.to(roomId).emit('peerDisconnected');
                delete rooms[roomId];
                console.log(`[ROOM] Комната ${roomId} удалена из-за отключения игрока`);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Сервер Неоновых Дуэлей запущен на порту ${PORT}`);
});
