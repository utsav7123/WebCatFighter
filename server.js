const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.static(path.join(__dirname)));

// Serve the game
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Store active rooms
const rooms = new Map();

// Generate room code
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Create room
    socket.on('createRoom', () => {
        const roomCode = generateRoomCode();
        const roomData = {
            code: roomCode,
            host: socket.id,
            guest: null,
            gameState: {},
            players: 1
        };
        
        rooms.set(roomCode, roomData);
        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.role = 'host';
        
        socket.emit('roomCreated', { roomCode, role: 'host' });
        console.log(`Room created: ${roomCode}`);
    });

    // Join room
    socket.on('joinRoom', (roomCode) => {
        const room = rooms.get(roomCode);
        
        if (!room) {
            socket.emit('roomError', 'Room not found');
            return;
        }
        
        if (room.players >= 2) {
            socket.emit('roomError', 'Room is full');
            return;
        }
        
        room.guest = socket.id;
        room.players = 2;
        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.role = 'guest';
        
        socket.emit('roomJoined', { roomCode, role: 'guest' });
        socket.to(roomCode).emit('playerJoined');
        
        // Start game for both players
        io.to(roomCode).emit('gameStart');
        console.log(`Player joined room: ${roomCode}`);
    });

    // Game state updates
    socket.on('gameUpdate', (data) => {
        const roomCode = socket.roomCode;
        if (roomCode) {
            // Broadcast to other player in room
            socket.to(roomCode).emit('opponentUpdate', {
                ...data,
                playerId: socket.id
            });
        }
    });

    // Handle health updates when player hits opponent
    socket.on('opponentHealthUpdate', (data) => {
        const roomCode = socket.roomCode;
        if (roomCode) {
            // Send health update to the opponent who was hit
            socket.to(roomCode).emit('opponentHealthUpdate', {
                health: data.health,
                dead: data.dead
            });
        }
    });

    // Handle health updates when player heals themselves (eating mouse)
    socket.on('myHealthUpdate', (data) => {
        const roomCode = socket.roomCode;
        if (roomCode) {
            // Send health update to the opponent so they see our new health
            socket.to(roomCode).emit('myHealthUpdate', {
                health: data.health,
                dead: data.dead
            });
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        
        if (socket.roomCode) {
            const room = rooms.get(socket.roomCode);
            if (room) {
                // Notify other player
                socket.to(socket.roomCode).emit('playerDisconnected');
                
                // Clean up room if empty
                room.players--;
                if (room.players <= 0) {
                    rooms.delete(socket.roomCode);
                    console.log(`Room deleted: ${socket.roomCode}`);
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Cat Fighter server running on http://localhost:${PORT}`);
});
