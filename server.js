const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// Раздаем клиентскую часть (фронтенд)
app.use(express.static('public'));

// Хранилище комнат
const rooms = {};

io.on('connection', (socket) => {
    console.log(`[+] Игрок подключился: ${socket.id}`);

    // Хост создает комнату
    socket.on('createRoom', (profile) => {
        const roomId = Math.floor(1000 + Math.random() * 9000).toString();
        rooms[roomId] = { 
            host: socket.id, 
            client: null,
            p1Profile: profile, // Профиль хоста
            p2Profile: null     // Профиль клиента (пока пусто)
        };
        
        socket.join(roomId);
        socket.emit('roomCreated', roomId);
        console.log(`[ROOM] Создана комната ${roomId}. Хост: ${profile.name}`);
    });

    // Клиент (друг) присоединяется к комнате
    socket.on('joinRoom', (data) => {
        const { roomId, profile } = data;
        
        if (rooms[roomId]) {
            if (!rooms[roomId].client) {
                rooms[roomId].client = socket.id;
                rooms[roomId].p2Profile = profile; // Сохраняем профиль друга
                socket.join(roomId);
                
                // Отправляем другу успешный вход и ОБА профиля, чтобы он знал, кто хост
                socket.emit('joinedRoom', { 
                    p1Profile: rooms[roomId].p1Profile, 
                    p2Profile: rooms[roomId].p2Profile 
                });
                
                // Отправляем хосту профиль подключившегося друга
                io.to(rooms[roomId].host).emit('clientJoined', { 
                    p2Profile: rooms[roomId].p2Profile 
                });
                
                console.log(`[ROOM] ${profile.name} зашел в комнату ${roomId}`);
            } else {
                socket.emit('errorMsg', 'Комната уже полна! Идет бой.');
            }
        } else {
            socket.emit('errorMsg', 'Комната не найдена! Проверьте код.');
        }
    });

    // Идеальная маршрутизация игровых данных (Синхронизация физики и кнопок)
    socket.on('gameData', (data) => {
        const room = Array.from(socket.rooms).find(r => r !== socket.id);
        if (room) {
            // Отправляем всем в комнате, кроме самого отправителя
            socket.to(room).emit('gameData', data);
        }
    });

    // Отключение игрока
    socket.on('disconnect', () => {
        console.log(`[-] Игрок отключился: ${socket.id}`);
        for (const roomId in rooms) {
            if (rooms[roomId].host === socket.id || rooms[roomId].client === socket.id) {
                // Предупреждаем второго игрока, что лобби распалось
                socket.to(roomId).emit('peerDisconnected');
                delete rooms[roomId];
                console.log(`[ROOM] Комната ${roomId} закрыта.`);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Сервер Неоновых Дуэлей PRO запущен на порту ${PORT}`);
});
