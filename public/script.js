const socket = io();

// ===== ROOM CODE =====
const urlParams = new URLSearchParams(window.location.search);
const roomCode = urlParams.get('room');

if (!roomCode) {
    // No room code, redirect to setup
    window.location.href = '/';
}

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
let currentPhrase = '';
let currentCategory = '';
let revealedLetters = new Set();

let players = [];
let activePlayerIndex = -1;
let serverKeyboardState = { consonants: false, vowels: false };
let usedLetters = [];

// Join the room on connect
socket.emit('join_room', roomCode, (response) => {
    if (response.error) {
        alert('Stanza non trovata! Verrai reindirizzato.');
        window.location.href = '/';
        return;
    }
    // Set initial phrase and category from room
    if (response.phrase) {
        currentPhrase = response.phrase;
        currentCategory = response.category || '';
        initKeyboard();
        renderBoard();
    }
});

function broadcastUsedLetters() {
    socket.emit('sync_used_letters', usedLetters);
}

function buildBoardState() {
    if (!currentPhrase) return null;
    const words = currentPhrase.split(' ');
    const wordsData = words.map(word => {
        const chars = [];
        for (let i = 0; i < word.length; i++) {
            const char = word[i];
            const isLetter = /[A-Z]/.test(char);
            if (isLetter) {
                if (revealedLetters.has(char)) {
                    chars.push({ type: 'letter', revealed: true, char: char });
                } else {
                    chars.push({ type: 'letter', revealed: false });
                }
            } else {
                chars.push({ type: 'punctuation', char: char });
            }
        }
        return chars;
    });
    return { category: currentCategory, words: wordsData };
}

function broadcastBoardState() {
    const state = buildBoardState();
    if (state) {
        socket.emit('sync_board_state', state);
    }
}

socket.on('players_updated', (serverPlayers) => {
    players = serverPlayers;
    renderPlayers();
});

socket.on('keyboard_state_updated', (state) => {
    serverKeyboardState = state;
    updateTeacherKeyboardBtns();
});

socket.on('letter_guessed', (data) => {
    const { letter, playerId } = data;
    const keyEl = document.querySelector(`.key[data-letter="${letter}"]`);
    if (keyEl && !keyEl.classList.contains('used')) {
        handleGuess(letter, keyEl);
        socket.emit('sync_players', players);
    }
});

// --- Gestione Audio ---
let audioCtx;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playRevealSound() {
    if (!audioCtx) initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    try {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1046.50, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    } catch(e) {}
}

function playErrorSound() {
    if (!audioCtx) initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    try {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    } catch(e) {}
}

function playWinSound() {
    if (!audioCtx) initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    try {
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.1);
            gainNode.gain.setValueAtTime(0, audioCtx.currentTime + i * 0.1);
            gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + i * 0.1 + 0.05);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.1 + 0.5);
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            osc.start(audioCtx.currentTime + i * 0.1);
            osc.stop(audioCtx.currentTime + i * 0.1 + 0.5);
        });
    } catch(e) {}
}

function playSadSound() {
    if (!audioCtx) initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    try {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = 'triangle'; 
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 1);
        gainNode.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1);
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 1);
    } catch(e) {}
}

function playGrandWinSound() {
    if (!audioCtx) initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    try {
        const notes = [
            {f: 523.25, t: 0, d: 0.15},
            {f: 523.25, t: 0.15, d: 0.15},
            {f: 523.25, t: 0.3, d: 0.15},
            {f: 659.25, t: 0.45, d: 0.4},
            {f: 783.99, t: 0.85, d: 0.6}
        ];
        notes.forEach(note => {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(note.f, audioCtx.currentTime + note.t);
            gainNode.gain.setValueAtTime(0, audioCtx.currentTime + note.t);
            gainNode.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + note.t + 0.05);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + note.t + note.d);
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            osc.start(audioCtx.currentTime + note.t);
            osc.stop(audioCtx.currentTime + note.t + note.d);
        });
    } catch(e) {}
}

const boardEl = document.getElementById('board');
const keyboardEl = document.getElementById('keyboard');
const settingsBtn = document.getElementById('settings-btn');
const modalEl = document.getElementById('teacher-modal');
const closeBtn = document.getElementById('close-modal-btn');
const saveBtn = document.getElementById('save-phrase-btn');
const phraseInput = document.getElementById('phrase-input');
const playersInput = document.getElementById('players-input');
const playersListEl = document.getElementById('players-list');
const categoryInput = document.getElementById('category-input');
const categoryDisplay = document.getElementById('category-display');

const solutionInput = document.getElementById('solution-input');
const solveBtn = document.getElementById('solve-btn');
const winScreen = document.getElementById('congratulations-screen');
const closeWinBtn = document.getElementById('close-win-btn');
const winnerText = document.getElementById('winner-text');
const toggleKeyboardBtn = document.getElementById('toggle-keyboard-btn');
const toggleConsonantsBtn = document.getElementById('toggle-consonants-btn');
const toggleVowelsBtn = document.getElementById('toggle-vowels-btn');
const resetScoresBtn = document.getElementById('reset-scores-btn');
const studentLinkEl = document.getElementById('student-link-display');

// Show student link
if (studentLinkEl && roomCode) {
    const baseUrl = window.location.origin;
    studentLinkEl.textContent = `${baseUrl}/join/${roomCode}`;
    studentLinkEl.style.cursor = 'pointer';
    studentLinkEl.title = 'Clicca per copiare';
    studentLinkEl.addEventListener('click', () => {
        navigator.clipboard.writeText(studentLinkEl.textContent).then(() => {
            const orig = studentLinkEl.textContent;
            studentLinkEl.textContent = '✅ Copiato!';
            setTimeout(() => { studentLinkEl.textContent = orig; }, 1500);
        });
    });
}

if (resetScoresBtn) {
    resetScoresBtn.addEventListener('click', () => {
        players.forEach(p => p.score = 0);
        renderPlayers();
        socket.emit('sync_players', players);
    });
}

toggleConsonantsBtn.addEventListener('click', () => {
    serverKeyboardState.consonants = !serverKeyboardState.consonants;
    updateTeacherKeyboardBtns();
    socket.emit('set_keyboard_state', serverKeyboardState);
});

toggleVowelsBtn.addEventListener('click', () => {
    serverKeyboardState.vowels = !serverKeyboardState.vowels;
    updateTeacherKeyboardBtns();
    socket.emit('set_keyboard_state', serverKeyboardState);
});

function updateTeacherKeyboardBtns() {
    if (serverKeyboardState.consonants) {
        toggleConsonantsBtn.textContent = '🔤 Consonanti ON';
        toggleConsonantsBtn.style.borderColor = '#10b981';
        toggleConsonantsBtn.style.color = '#10b981';
        toggleConsonantsBtn.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
    } else {
        toggleConsonantsBtn.textContent = '🔤 Consonanti OFF';
        toggleConsonantsBtn.style.borderColor = '#ef4444';
        toggleConsonantsBtn.style.color = '#ef4444';
        toggleConsonantsBtn.style.backgroundColor = 'transparent';
    }

    if (serverKeyboardState.vowels) {
        toggleVowelsBtn.textContent = '🅰️ Vocali ON';
        toggleVowelsBtn.style.borderColor = '#10b981';
        toggleVowelsBtn.style.color = '#10b981';
        toggleVowelsBtn.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
    } else {
        toggleVowelsBtn.textContent = '🅰️ Vocali OFF';
        toggleVowelsBtn.style.borderColor = '#ef4444';
        toggleVowelsBtn.style.color = '#ef4444';
        toggleVowelsBtn.style.backgroundColor = 'transparent';
    }
}

toggleKeyboardBtn.addEventListener('click', () => {
    keyboardEl.classList.toggle('hidden');
    if (keyboardEl.classList.contains('hidden')) {
        toggleKeyboardBtn.textContent = '⌨️ Mostra Tastiera LIM';
    } else {
        toggleKeyboardBtn.textContent = '⌨️ Nascondi Tastiera LIM';
    }
});

const qwertyLayout = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
];

function initKeyboard() {
    keyboardEl.innerHTML = '';
    qwertyLayout.forEach(row => {
        const rowEl = document.createElement('div');
        rowEl.className = 'keyboard-row';
        row.forEach(letter => {
            const key = document.createElement('button');
            key.className = 'key';
            key.textContent = letter;
            key.dataset.letter = letter;
            key.addEventListener('click', () => handleGuess(letter, key));
            rowEl.appendChild(key);
        });
        keyboardEl.appendChild(rowEl);
    });
}

function renderBoard() {
    if (!currentPhrase) {
        boardEl.innerHTML = `<div class="empty-state">Clicca sull'ingranaggio in alto a destra per iniziare!</div>`;
        return;
    }
    
    boardEl.innerHTML = '';
    
    if (currentCategory) {
        categoryDisplay.textContent = currentCategory;
        categoryDisplay.classList.remove('hidden');
    } else {
        categoryDisplay.classList.add('hidden');
    }

    const words = currentPhrase.split(' ');
    
    words.forEach((word) => {
        const wordEl = document.createElement('div');
        wordEl.className = 'word';
        
        for (let i = 0; i < word.length; i++) {
            const char = word[i];
            const isLetter = /[A-Z]/.test(char);
            
            const tileEl = document.createElement('div');
            
            if (isLetter) {
                tileEl.className = `tile ${revealedLetters.has(char) ? 'revealed' : ''}`;
                tileEl.dataset.char = char;
                tileEl.innerHTML = `
                    <div class="tile-inner">
                        <div class="tile-front"></div>
                        <div class="tile-back">${char}</div>
                    </div>
                `;
            } else {
                tileEl.className = 'tile punctuation';
                tileEl.innerHTML = `
                    <div class="tile-inner">
                        <div class="tile-front">${char}</div>
                        <div class="tile-back">${char}</div>
                    </div>
                `;
            }
            wordEl.appendChild(tileEl);
        }
        boardEl.appendChild(wordEl);
    });
    
    // Sincronizza il tabellone con gli studenti
    broadcastBoardState();
}

function renderPlayers() {
    if (players.length === 0) {
        playersListEl.innerHTML = `<div class="empty-players">Nessun giocatore.<br>Aggiungili dalle impostazioni o aspetta che si colleghino.</div>`;
        return;
    }

    playersListEl.innerHTML = '';
    players.forEach((player, index) => {
        const card = document.createElement('div');
        card.className = `player-card ${activePlayerIndex === index ? 'active' : ''}`;
        
        card.addEventListener('click', (e) => {
            if (!e.target.classList.contains('score-btn')) {
                activePlayerIndex = index;
                renderPlayers();
                if (players[index]) {
                    socket.emit('set_turn', players[index].id);
                }
            }
        });

        const infoRow = document.createElement('div');
        infoRow.className = 'player-info';
        
        const nameEl = document.createElement('div');
        nameEl.className = 'player-name';
        nameEl.textContent = player.name;
        
        const scoreEl = document.createElement('div');
        scoreEl.className = 'player-score';
        scoreEl.textContent = player.score;

        infoRow.appendChild(nameEl);
        infoRow.appendChild(scoreEl);

        const controlsRow = document.createElement('div');
        controlsRow.className = 'score-controls';

        const minusBtn = document.createElement('button');
        minusBtn.className = 'score-btn minus';
        minusBtn.textContent = '-1';
        minusBtn.title = "Sottrai 1 punto";
        minusBtn.addEventListener('click', () => {
            player.score = Math.max(0, player.score - 1);
            renderPlayers();
            socket.emit('sync_players', players);
        });

        const plusBtn = document.createElement('button');
        plusBtn.className = 'score-btn plus';
        plusBtn.textContent = '+1';
        plusBtn.title = "Aggiungi 1 punto";
        plusBtn.addEventListener('click', () => {
            player.score += 1;
            renderPlayers();
            socket.emit('sync_players', players);
        });

        const plus5Btn = document.createElement('button');
        plus5Btn.className = 'score-btn plus';
        plus5Btn.textContent = '+5';
        plus5Btn.title = "Aggiungi 5 punti";
        plus5Btn.addEventListener('click', () => {
            player.score += 5;
            renderPlayers();
            socket.emit('sync_players', players);
        });

        controlsRow.appendChild(minusBtn);
        controlsRow.appendChild(plusBtn);
        controlsRow.appendChild(plus5Btn);

        card.appendChild(infoRow);
        card.appendChild(controlsRow);
        
        playersListEl.appendChild(card);
    });
}

function handleGuess(letter, keyEl) {
    if (!currentPhrase) return;
    if (keyEl.classList.contains('used')) return;
    
    if (!usedLetters.includes(letter)) {
        usedLetters.push(letter);
        broadcastUsedLetters();
    }
    
    if (currentPhrase.includes(letter)) {
        revealedLetters.add(letter);
        keyEl.classList.add('used', 'found');
        
        const tiles = document.querySelectorAll(`.tile[data-char="${letter}"]`);
        
        if (activePlayerIndex >= 0 && players[activePlayerIndex]) {
            players[activePlayerIndex].score += tiles.length;
            renderPlayers();
        }
        
        tiles.forEach((tile, index) => {
            setTimeout(() => {
                tile.classList.add('revealed');
                playRevealSound();
                broadcastBoardState();
            }, index * 150);
        });
        
        setTimeout(checkWin, tiles.length * 150 + 600);
    } else {
        keyEl.classList.add('used', 'not-found');
        playErrorSound();
    }
}

function checkWin() {
    const lettersInPhrase = new Set([...currentPhrase].filter(char => /[A-Z]/.test(char)));
    let hasWon = true;
    lettersInPhrase.forEach(letter => {
        if (!revealedLetters.has(letter)) hasWon = false;
    });
    
    if (hasWon) {
        playWinSound();
        const tiles = document.querySelectorAll('.tile-back');
        tiles.forEach((tile, index) => {
            setTimeout(() => {
                tile.style.transition = 'all 0.3s ease';
                tile.style.backgroundColor = '#fbbf24'; 
                tile.style.color = '#000';
                tile.style.borderColor = '#f59e0b';
                tile.style.transform = 'rotateY(180deg) scale(1.1)';
                
                setTimeout(() => {
                    tile.style.backgroundColor = 'var(--tile-bg)';
                    tile.style.color = 'var(--tile-text)';
                    tile.style.borderColor = '#000';
                    tile.style.transform = 'rotateY(180deg) scale(1)';
                }, 400);
            }, index * 50);
        });
    }
}

settingsBtn.addEventListener('click', () => {
    modalEl.classList.remove('hidden');
    phraseInput.value = currentPhrase;
    categoryInput.value = currentCategory;
    playersInput.value = players.map(p => p.name).join(', ');
    phraseInput.focus();
});

closeBtn.addEventListener('click', () => {
    modalEl.classList.add('hidden');
});

saveBtn.addEventListener('click', () => {
    const newPhrase = phraseInput.value.trim().toUpperCase();
    const newCategory = categoryInput.value.trim().toUpperCase();
    
    if (newCategory !== currentCategory) {
        currentCategory = newCategory;
    }

    if (newPhrase && newPhrase !== currentPhrase) {
        currentPhrase = newPhrase;
        revealedLetters.clear();
        usedLetters = [];
        broadcastUsedLetters();
        initKeyboard();
        renderBoard();
        // Notify server about the new phrase
        socket.emit('update_room_phrase', { category: currentCategory, phrase: currentPhrase });
    } else if (newCategory !== currentCategory || currentPhrase) {
        renderBoard();
    }
    
    const namesStr = playersInput.value.trim();
    if (namesStr) {
        const names = namesStr.split(',').map(n => n.trim()).filter(n => n);
        
        const newPlayers = [];
        names.forEach(name => {
            const existing = players.find(p => p.name.toUpperCase() === name.toUpperCase());
            if (existing) {
                newPlayers.push(existing);
            } else {
                newPlayers.push({ name, score: 0 });
            }
        });
        players = newPlayers;
        
        if (players.length > 0 && activePlayerIndex === -1) {
            activePlayerIndex = 0;
        } else if (activePlayerIndex >= players.length) {
            activePlayerIndex = players.length > 0 ? 0 : -1;
        }
        
        renderPlayers();
    } else {
        players = [];
        activePlayerIndex = -1;
        renderPlayers();
    }
    
    initAudio();
    
    modalEl.classList.add('hidden');
});

modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) {
        modalEl.classList.add('hidden');
    }
});

// Gestione della soluzione
solveBtn.addEventListener('click', () => {
    initAudio();
    if (!currentPhrase) return;
    
    const cleanCurrent = currentPhrase.replace(/[^A-Z]/g, '');
    const cleanGuess = solutionInput.value.trim().toUpperCase().replace(/[^A-Z]/g, '');
    
    if (cleanGuess === cleanCurrent && cleanCurrent.length > 0) {
        playGrandWinSound();
        
        let unrevealedCount = 0;
        const allLetters = [...currentPhrase].filter(char => /[A-Z]/.test(char));
        allLetters.forEach(letter => {
            if (!revealedLetters.has(letter)) {
                unrevealedCount++;
            }
        });
        
        const lettersInPhrase = new Set([...currentPhrase].filter(char => /[A-Z]/.test(char)));
        lettersInPhrase.forEach(letter => revealedLetters.add(letter));
        
        const tiles = document.querySelectorAll('.tile:not(.punctuation)');
        tiles.forEach((tile) => {
            tile.classList.add('revealed');
        });
        
        broadcastBoardState();
        
        const keys = document.querySelectorAll('.key');
        keys.forEach(k => k.classList.add('used'));
        
        if (activePlayerIndex >= 0 && players[activePlayerIndex]) {
            winnerText.innerHTML = `Complimenti <b>${players[activePlayerIndex].name}</b>!<br>Hai dato la soluzione esatta!`;
            players[activePlayerIndex].score += unrevealedCount;
            renderPlayers();
            socket.emit('sync_players', players);
        } else {
            winnerText.textContent = "Hai indovinato la soluzione esatta!";
        }
        
        winScreen.classList.remove('hidden');
        solutionInput.value = '';
        
    } else {
        playSadSound();
        solutionInput.classList.add('error-shake');
        setTimeout(() => {
            solutionInput.classList.remove('error-shake');
        }, 500);
    }
});

solutionInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        solveBtn.click();
    }
});

closeWinBtn.addEventListener('click', () => {
    winScreen.classList.add('hidden');
});

// === EUREKA! PRENOTAZIONE ===
const eurekaBanner = document.getElementById('eureka-banner');
const eurekaPlayerName = document.getElementById('eureka-player-name');
const eurekaDismissBtn = document.getElementById('eureka-dismiss-btn');

function playEurekaSound() {
    if (!audioCtx) initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    try {
        const notes = [
            {f: 523.25, t: 0, d: 0.12},
            {f: 659.25, t: 0.08, d: 0.12},
            {f: 783.99, t: 0.16, d: 0.12},
            {f: 1046.50, t: 0.24, d: 0.12},
            {f: 1318.51, t: 0.32, d: 0.5},
        ];
        notes.forEach(note => {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(note.f, audioCtx.currentTime + note.t);
            gainNode.gain.setValueAtTime(0, audioCtx.currentTime + note.t);
            gainNode.gain.linearRampToValueAtTime(0.25, audioCtx.currentTime + note.t + 0.03);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + note.t + note.d);
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            osc.start(audioCtx.currentTime + note.t);
            osc.stop(audioCtx.currentTime + note.t + note.d);
        });
    } catch(e) {}
}

socket.on('eureka_announced', (data) => {
    initAudio();
    playEurekaSound();
    eurekaPlayerName.innerHTML = `<b>${data.playerName}</b> si è prenotato per la soluzione!`;
    eurekaBanner.classList.remove('hidden');
});

eurekaDismissBtn.addEventListener('click', () => {
    eurekaBanner.classList.add('hidden');
    socket.emit('eureka_dismiss');
});

socket.on('eureka_reset', () => {
    eurekaBanner.classList.add('hidden');
});

initKeyboard();
renderBoard();
renderPlayers();
