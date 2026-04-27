const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());

// Serve static files from the "public" directory
app.use(express.static('public'));

// ========== MULTI-ROOM SYSTEM ==========

// Store all active rooms: { roomCode: { ...roomState } }
const rooms = {};

// Generate a unique 6-character room code
function generateRoomCode() {
    let code;
    do {
        code = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 6);
    } while (rooms[code]);
    return code;
}

// Create a fresh room state
function createRoomState(category, phrase) {
    return {
        category: category || '',
        phrase: phrase || '',
        players: [],
        activePlayerId: null,
        keyboardState: { consonants: false, vowels: false },
        usedLetters: [],
        boardState: null,
        eurekaLocked: false,
        createdAt: Date.now(),
        lastActivity: Date.now()
    };
}

// Update room activity timestamp
function touchRoom(roomCode) {
    if (rooms[roomCode]) {
        rooms[roomCode].lastActivity = Date.now();
    }
}

// Clean up inactive rooms (older than 4 hours)
setInterval(() => {
    const FOUR_HOURS = 4 * 60 * 60 * 1000;
    const now = Date.now();
    for (const code of Object.keys(rooms)) {
        if (now - rooms[code].lastActivity > FOUR_HOURS) {
            console.log(`Cleaning up inactive room: ${code}`);
            delete rooms[code];
        }
    }
}, 60 * 60 * 1000); // Check every hour

// ========== REST API ==========

// Create a new room
app.post('/api/create-room', (req, res) => {
    const { category, phrase } = req.body;
    
    if (!phrase || !phrase.trim()) {
        return res.status(400).json({ error: 'La frase è obbligatoria' });
    }
    
    const roomCode = generateRoomCode();
    rooms[roomCode] = createRoomState(category, phrase.trim().toUpperCase());
    
    console.log(`Room created: ${roomCode} — "${phrase}"`);
    
    res.json({ roomCode });
});

// Check if a room exists
app.get('/api/room/:code', (req, res) => {
    const code = req.params.code.toUpperCase();
    if (rooms[code]) {
        res.json({ exists: true, category: rooms[code].category });
    } else {
        res.status(404).json({ exists: false });
    }
});

// ========== ROUTES ==========

// Teacher game page: /teacher?room=ABC123
app.get('/teacher', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'teacher.html'));
});

// Student join page: /join/:roomCode
app.get('/join/:roomCode', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'student.html'));
});

// Landing page (default)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== SOCKET.IO ==========

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    
    let currentRoom = null;

    // Join a specific room
    socket.on('join_room', (roomCode, callback) => {
        const code = roomCode.toUpperCase();
        if (!rooms[code]) {
            if (typeof callback === 'function') {
                callback({ error: 'Stanza non trovata' });
            }
            return;
        }
        
        currentRoom = code;
        socket.join(code);
        touchRoom(code);
        
        const room = rooms[code];
        
        // Send initial state to the new user
        socket.emit('keyboard_state_updated', room.keyboardState);
        socket.emit('used_letters_updated', room.usedLetters);
        if (room.boardState) {
            socket.emit('board_state_updated', room.boardState);
        }
        if (room.eurekaLocked) {
            socket.emit('eureka_announced', { playerName: '(già prenotato)' });
        }
        // Send current players
        socket.emit('players_updated', room.players);
        
        if (typeof callback === 'function') {
            callback({ success: true, category: room.category, phrase: room.phrase });
        }
    });

    // Quando un alunno si collega
    socket.on('join_game', (playerName) => {
        if (!currentRoom || !rooms[currentRoom]) return;
        const room = rooms[currentRoom];
        touchRoom(currentRoom);
        
        // Aggiungi ai giocatori se non esiste già
        const existing = room.players.find(p => p.name.toUpperCase() === playerName.toUpperCase());
        if (!existing) {
            const newPlayer = { id: socket.id, name: playerName, score: 0 };
            room.players.push(newPlayer);
            io.to(currentRoom).emit('players_updated', room.players);
        } else {
            // Aggiorna l'id del socket se il giocatore si è ricollegato
            existing.id = socket.id;
            io.to(currentRoom).emit('players_updated', room.players);
        }
    });

    // Quando l'insegnante cambia il turno
    socket.on('set_turn', (playerId) => {
        if (!currentRoom || !rooms[currentRoom]) return;
        const room = rooms[currentRoom];
        touchRoom(currentRoom);
        room.activePlayerId = playerId;
        io.to(currentRoom).emit('turn_changed', room.activePlayerId);
    });

    // Quando l'insegnante aggiorna i punti manualmente o risolve il gioco
    socket.on('sync_players', (updatedPlayers) => {
        if (!currentRoom || !rooms[currentRoom]) return;
        const room = rooms[currentRoom];
        touchRoom(currentRoom);
        room.players = updatedPlayers;
        io.to(currentRoom).emit('players_updated', room.players);
    });

    // Quando l'insegnante attiva/disattiva le tastiere
    socket.on('set_keyboard_state', (state) => {
        if (!currentRoom || !rooms[currentRoom]) return;
        const room = rooms[currentRoom];
        touchRoom(currentRoom);
        room.keyboardState = state;
        io.to(currentRoom).emit('keyboard_state_updated', room.keyboardState);
    });

    // Quando l'insegnante sincronizza le lettere usate
    socket.on('sync_used_letters', (letters) => {
        if (!currentRoom || !rooms[currentRoom]) return;
        const room = rooms[currentRoom];
        touchRoom(currentRoom);
        room.usedLetters = letters;
        io.to(currentRoom).emit('used_letters_updated', room.usedLetters);
    });

    // Quando l'insegnante sincronizza lo stato del tabellone
    socket.on('sync_board_state', (state) => {
        if (!currentRoom || !rooms[currentRoom]) return;
        const room = rooms[currentRoom];
        touchRoom(currentRoom);
        room.boardState = state;
        io.to(currentRoom).emit('board_state_updated', room.boardState);
    });

    // Quando l'insegnante aggiorna la frase (nuova partita nella stessa stanza)
    socket.on('update_room_phrase', (data) => {
        if (!currentRoom || !rooms[currentRoom]) return;
        const room = rooms[currentRoom];
        touchRoom(currentRoom);
        if (data.category !== undefined) room.category = data.category;
        if (data.phrase !== undefined) room.phrase = data.phrase;
        // Reset game state for new round
        room.usedLetters = [];
        room.boardState = null;
        room.eurekaLocked = false;
        room.keyboardState = { consonants: false, vowels: false };
        io.to(currentRoom).emit('keyboard_state_updated', room.keyboardState);
        io.to(currentRoom).emit('used_letters_updated', room.usedLetters);
        io.to(currentRoom).emit('eureka_reset');
    });

    // === EUREKA! PRENOTAZIONE ===
    socket.on('eureka_press', (data) => {
        if (!currentRoom || !rooms[currentRoom]) return;
        const room = rooms[currentRoom];
        touchRoom(currentRoom);
        if (room.eurekaLocked) return; // Qualcuno si è già prenotato
        room.eurekaLocked = true;
        const { playerName } = data;
        console.log(`EUREKA! ${playerName} si è prenotato! (Room: ${currentRoom})`);
        io.to(currentRoom).emit('eureka_announced', { playerName });
    });

    socket.on('eureka_dismiss', () => {
        if (!currentRoom || !rooms[currentRoom]) return;
        const room = rooms[currentRoom];
        touchRoom(currentRoom);
        room.eurekaLocked = false;
        io.to(currentRoom).emit('eureka_reset');
    });

    // Quando l'alunno sceglie una lettera
    socket.on('guess_letter', (data) => {
        if (!currentRoom || !rooms[currentRoom]) return;
        touchRoom(currentRoom);
        const { letter, playerId } = data;
        // Invia a tutti nella stanza per processare la mossa
        io.to(currentRoom).emit('letter_guessed', { letter, playerId });
    });

    // Disconnessione
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Eureka! server listening on port ${PORT}`);
});
