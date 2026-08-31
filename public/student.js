const socket = io();

// ===== ROOM CODE from URL =====
// URL format: /join/ABC123
const pathParts = window.location.pathname.split('/');
const roomCode = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2];

if (!roomCode || roomCode === 'join' || roomCode === 'student.html') {
    document.body.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:Outfit,sans-serif;color:#f87171;font-size:1.3rem;text-align:center;padding:20px;">⚠️ Link non valido.<br>Chiedi al tuo insegnante il link corretto per entrare nel gioco.</div>';
}

// Join room AFTER socket is connected
socket.on('connect', () => {
    socket.emit('join_room', roomCode, (response) => {
        if (response && response.error) {
            document.body.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:Outfit,sans-serif;color:#f87171;font-size:1.3rem;text-align:center;padding:20px;">⚠️ Stanza non trovata.<br>Il gioco potrebbe essere terminato. Chiedi un nuovo link al tuo insegnante.</div>';
        }
    });
});

const loginScreen = document.getElementById('login-screen');
const gameScreen = document.getElementById('game-screen');
const nameInput = document.getElementById('player-name');
const joinBtn = document.getElementById('join-btn');
const statusMsg = document.getElementById('status-msg');
const keyboardEl = document.getElementById('student-keyboard');

const keyboardSelection = document.getElementById('keyboard-selection');
const btnShowConsonants = document.getElementById('btn-show-consonants');
const btnShowVowels = document.getElementById('btn-show-vowels');

// Tabellone modal elements
const btnShowBoard = document.getElementById('btn-show-board');
const boardModal = document.getElementById('board-modal');
const boardModalClose = document.getElementById('board-modal-close');
const studentBoard = document.getElementById('student-board');
const studentCategory = document.getElementById('student-category');
const localKeyboardEl = document.getElementById('local-keyboard');
const resetGuessesBtn = document.getElementById('reset-guesses-btn');

let myId = null;
let myName = '';
let isMyTurn = false;
let serverKeyboardState = { consonants: false, vowels: false };
let currentKeyboardView = ''; // 'consonants' or 'vowels'
let usedLetters = [];

// Board state ricevuto dal server
let currentBoardState = null;
// Ipotesi locali dello studente { "word-char": "A", ... }
let localGuesses = {};
// Tile selezionata corrente per inserire la lettera
let selectedTileKey = null;

const consonantsLayout = [
    ['Q', 'W', 'R', 'T', 'Y', 'P'],
    ['S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
];

const vowelsLayout = [
    ['A', 'E', 'I', 'O', 'U']
];

const qwertyLayout = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
];

// ===== KEYBOARD SELECTION BUTTONS =====

btnShowConsonants.addEventListener('click', () => {
    currentKeyboardView = 'consonants';
    renderStudentKeyboard();
});

btnShowVowels.addEventListener('click', () => {
    currentKeyboardView = 'vowels';
    renderStudentKeyboard();
});

// ===== SOCKET EVENTS =====

socket.on('keyboard_state_updated', (state) => {
    serverKeyboardState = state;
    updateKeyboardUI();
});

socket.on('used_letters_updated', (letters) => {
    usedLetters = letters;
    if (currentKeyboardView) {
        renderStudentKeyboard();
    }
});

socket.on('board_state_updated', (state) => {
    currentBoardState = state;
    // Se il modal è aperto, aggiorna il tabellone in tempo reale
    if (!boardModal.classList.contains('hidden')) {
        renderStudentBoard();
    }
});

// ===== KEYBOARD UI =====

function updateKeyboardUI() {
    if (!isMyTurn) {
        keyboardSelection.classList.add('hidden');
        keyboardEl.classList.add('disabled');
        keyboardEl.innerHTML = '';
        return;
    }
    
    keyboardSelection.classList.remove('hidden');
    
    btnShowConsonants.disabled = !serverKeyboardState.consonants;
    btnShowVowels.disabled = !serverKeyboardState.vowels;
    
    btnShowConsonants.style.opacity = btnShowConsonants.disabled ? '0.5' : '1';
    btnShowVowels.style.opacity = btnShowVowels.disabled ? '0.5' : '1';
    
    if (btnShowConsonants.disabled && currentKeyboardView === 'consonants') {
        currentKeyboardView = '';
    }
    if (btnShowVowels.disabled && currentKeyboardView === 'vowels') {
        currentKeyboardView = '';
    }
    
    renderStudentKeyboard();
}

function initStudentKeyboard() {
    currentKeyboardView = '';
    keyboardEl.innerHTML = '';
}

function renderStudentKeyboard() {
    keyboardEl.innerHTML = '';
    
    if (!currentKeyboardView) {
        keyboardEl.classList.add('disabled');
        return;
    }
    
    if (currentKeyboardView === 'consonants' && !serverKeyboardState.consonants) {
        keyboardEl.classList.add('disabled');
        return;
    }
    if (currentKeyboardView === 'vowels' && !serverKeyboardState.vowels) {
        keyboardEl.classList.add('disabled');
        return;
    }
    
    keyboardEl.classList.remove('disabled');
    
    const layout = currentKeyboardView === 'consonants' ? consonantsLayout : vowelsLayout;
    
    layout.forEach(row => {
        const rowEl = document.createElement('div');
        rowEl.className = 'keyboard-row';
        row.forEach(letter => {
            const key = document.createElement('button');
            key.className = 'key';
            key.textContent = letter;
            key.dataset.letter = letter;
            
            if (usedLetters.includes(letter)) {
                key.classList.add('used');
            } else {
                key.addEventListener('click', () => {
                    if (!isMyTurn) return;
                    key.classList.add('used');
                    socket.emit('guess_letter', { letter: letter, playerId: myId });
                    // Disabilita la tastiera e aspetta il prossimo turno per sicurezza
                    keyboardEl.classList.add('disabled');
                    statusMsg.textContent = "Hai scelto " + letter + ". Guarda la lavagna!";
                    statusMsg.style.color = "#f8fafc";
                });
            }
            rowEl.appendChild(key);
        });
        keyboardEl.appendChild(rowEl);
    });
}

// ===== TABELLONE STUDENTE =====

btnShowBoard.addEventListener('click', () => {
    boardModal.classList.remove('hidden');
    renderStudentBoard();
    renderLocalKeyboard();
});

boardModalClose.addEventListener('click', () => {
    boardModal.classList.add('hidden');
    selectedTileKey = null;
});

function calculateTileSize(boardState) {
    // Get available width (board container width minus padding)
    const boardPadding = 40; // 20px each side
    const availableWidth = Math.min(window.innerWidth * 0.95, studentBoard.parentElement?.offsetWidth || window.innerWidth) - boardPadding;

    // Find the longest word (most characters)
    let longestWordLen = 0;
    let totalChars = 0;
    let numWords = boardState.words.length;

    boardState.words.forEach(wordChars => {
        let letterCount = wordChars.length;
        if (letterCount > longestWordLen) longestWordLen = letterCount;
        totalChars += letterCount;
    });

    // Calculate tile size based on longest word fitting in one row
    // Each tile needs: tileSize + gap(5px) + border(4px)
    const gapSize = 5;
    const borderSize = 4;

    // Max tile size we'd want
    const maxTileSize = 52;
    // Min tile size for readability
    const minTileSize = 26;

    // Calculate based on longest word fitting the available width
    let tileSize = Math.floor((availableWidth - (longestWordLen - 1) * gapSize) / longestWordLen) - borderSize;

    // Clamp between min and max
    tileSize = Math.max(minTileSize, Math.min(maxTileSize, tileSize));

    // Calculate font size proportionally
    let fontSize = tileSize * 0.55;
    fontSize = Math.max(12, Math.min(24, fontSize));

    return {
        tileSize: tileSize,
        fontSize: fontSize,
        gap: gapSize,
        wordGap: Math.max(12, Math.min(20, tileSize * 0.4))
    };
}

function applyTileSizing(boardState) {
    const sizing = calculateTileSize(boardState);
    studentBoard.style.setProperty('--tile-size', sizing.tileSize + 'px');
    studentBoard.style.setProperty('--tile-font', sizing.fontSize + 'px');
    studentBoard.style.setProperty('--tile-gap', sizing.gap + 'px');
    studentBoard.style.setProperty('--word-gap', sizing.wordGap + 'px');
}

function renderStudentBoard() {
    studentBoard.innerHTML = '';
    selectedTileKey = null;

    if (!currentBoardState) {
        studentBoard.innerHTML = '<div style="color: #94a3b8; text-align: center; padding: 20px;">In attesa che l\'insegnante avvii il gioco...</div>';
        studentCategory.classList.add('hidden');
        return;
    }

    // Mostra la categoria
    if (currentBoardState.category) {
        studentCategory.textContent = currentBoardState.category;
        studentCategory.classList.remove('hidden');
    } else {
        studentCategory.classList.add('hidden');
    }

    // Calculate and apply dynamic tile sizing
    applyTileSizing(currentBoardState);

    // Render delle parole
    currentBoardState.words.forEach((wordChars, wordIdx) => {
        const wordEl = document.createElement('div');
        wordEl.className = 'student-word';

        wordChars.forEach((charData, charIdx) => {
            const tileEl = document.createElement('div');
            tileEl.className = 'student-tile';
            const tileKey = `${wordIdx}-${charIdx}`;

            if (charData.type === 'letter') {
                if (charData.revealed) {
                    // Lettera rivelata - mostrala
                    tileEl.classList.add('revealed');
                    tileEl.textContent = charData.char;
                    // Se c'era un'ipotesi su questa casella, rimuovila
                    delete localGuesses[tileKey];
                } else {
                    // Lettera nascosta - interattiva
                    tileEl.classList.add('hidden-letter');
                    tileEl.dataset.tileKey = tileKey;

                    // Se c'è un'ipotesi locale, mostrala
                    if (localGuesses[tileKey]) {
                        tileEl.textContent = localGuesses[tileKey];
                        tileEl.classList.add('has-guess');
                    }

                    // Click per selezionare questa casella
                    tileEl.addEventListener('click', () => {
                        selectTile(tileKey);
                    });
                }
            } else {
                // Punteggiatura
                tileEl.classList.add('punctuation-tile');
                tileEl.textContent = charData.char;
            }

            wordEl.appendChild(tileEl);
        });

        studentBoard.appendChild(wordEl);
    });
}

// Recalculate tile sizes on window resize
window.addEventListener('resize', () => {
    if (currentBoardState && !boardModal.classList.contains('hidden')) {
        applyTileSizing(currentBoardState);
    }
});

function selectTile(tileKey) {
    // Deseleziona la precedente
    const prevSelected = studentBoard.querySelector('.student-tile.selected');
    if (prevSelected) {
        prevSelected.classList.remove('selected');
    }

    if (selectedTileKey === tileKey) {
        // Deseleziona se cliccato di nuovo
        selectedTileKey = null;
        return;
    }

    selectedTileKey = tileKey;
    const tileEl = studentBoard.querySelector(`[data-tile-key="${tileKey}"]`);
    if (tileEl) {
        tileEl.classList.add('selected');
    }
}

function renderLocalKeyboard() {
    localKeyboardEl.innerHTML = '';

    qwertyLayout.forEach(row => {
        const rowEl = document.createElement('div');
        rowEl.className = 'keyboard-row';

        row.forEach(letter => {
            const key = document.createElement('button');
            key.className = 'local-key';
            key.textContent = letter;
            key.addEventListener('click', () => {
                insertLocalGuess(letter);
            });
            rowEl.appendChild(key);
        });

        localKeyboardEl.appendChild(rowEl);
    });

    // Riga con tasto cancella
    const eraseRow = document.createElement('div');
    eraseRow.className = 'keyboard-row';
    const eraseKey = document.createElement('button');
    eraseKey.className = 'local-key erase-key';
    eraseKey.textContent = '⌫';
    eraseKey.addEventListener('click', () => {
        eraseLocalGuess();
    });
    eraseRow.appendChild(eraseKey);
    localKeyboardEl.appendChild(eraseRow);
}

function insertLocalGuess(letter) {
    if (!selectedTileKey) return;

    // Inserisci l'ipotesi
    localGuesses[selectedTileKey] = letter;

    // Aggiorna visivamente la casella
    const tileEl = studentBoard.querySelector(`[data-tile-key="${selectedTileKey}"]`);
    if (tileEl) {
        tileEl.textContent = letter;
        tileEl.classList.add('has-guess');
        tileEl.classList.remove('selected');

        // Animazione breve
        tileEl.style.transform = 'scale(1.2)';
        setTimeout(() => { tileEl.style.transform = ''; }, 150);
    }

    // Avanza alla prossima casella nascosta senza ipotesi
    advanceToNextTile();
}

function eraseLocalGuess() {
    if (!selectedTileKey) return;

    delete localGuesses[selectedTileKey];

    const tileEl = studentBoard.querySelector(`[data-tile-key="${selectedTileKey}"]`);
    if (tileEl) {
        tileEl.textContent = '';
        tileEl.classList.remove('has-guess');
    }
}

function advanceToNextTile() {
    if (!currentBoardState) return;

    // Trova la casella corrente e avanza alla successiva nascosta senza ipotesi
    const allTiles = [];
    currentBoardState.words.forEach((wordChars, wordIdx) => {
        wordChars.forEach((charData, charIdx) => {
            if (charData.type === 'letter' && !charData.revealed) {
                allTiles.push(`${wordIdx}-${charIdx}`);
            }
        });
    });

    const currentIdx = allTiles.indexOf(selectedTileKey);
    selectedTileKey = null;

    // Cerca la prossima senza ipotesi
    for (let i = 1; i <= allTiles.length; i++) {
        const nextIdx = (currentIdx + i) % allTiles.length;
        const nextKey = allTiles[nextIdx];
        if (!localGuesses[nextKey]) {
            selectTile(nextKey);
            return;
        }
    }
}

resetGuessesBtn.addEventListener('click', () => {
    localGuesses = {};
    selectedTileKey = null;
    renderStudentBoard();
});

// ===== LOGIN =====

joinBtn.addEventListener('click', () => {
    myName = nameInput.value.trim();
    if (myName) {
        myId = socket.id;
        socket.emit('join_game', myName);
        loginScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        initStudentKeyboard();
    }
});

// ===== TURNO =====

socket.on('turn_changed', (activePlayerId) => {
    if (activePlayerId === myId) {
        isMyTurn = true;
        keyboardEl.classList.remove('disabled');
        statusMsg.textContent = "È IL TUO TURNO! Scegli una lettera.";
        statusMsg.style.color = "#60a5fa"; // Azzurro per il proprio turno
    } else {
        isMyTurn = false;
        keyboardEl.classList.add('disabled');
        statusMsg.textContent = "In attesa del tuo turno...";
        statusMsg.style.color = "#fbbf24"; // Giallo per l'attesa
    }
    updateKeyboardUI();
});

// === EUREKA! CODA PRENOTAZIONI ===
const eurekaBtnMain = document.getElementById('eureka-btn-main');
const eurekaBtnBoard = document.getElementById('eureka-btn-board');

function handleEurekaPress() {
    if (!myName) return;
    socket.emit('eureka_press', { playerName: myName });
}

function setEurekaLabel(text) {
    if (eurekaBtnMain) eurekaBtnMain.innerHTML = text;
    if (eurekaBtnBoard) eurekaBtnBoard.innerHTML = text;
}

function setEurekaDisabledState(disabled) {
    if (eurekaBtnMain) eurekaBtnMain.disabled = disabled;
    if (eurekaBtnBoard) eurekaBtnBoard.disabled = disabled;
}

eurekaBtnMain.addEventListener('click', handleEurekaPress);
eurekaBtnBoard.addEventListener('click', handleEurekaPress);

socket.on('eureka_queue_updated', (queue) => {
    if (queue.length === 0) {
        // Coda vuota - riabilita il pulsante
        setEurekaDisabledState(false);
        setEurekaLabel('💡<br>EUREKA!');
        return;
    }

    // Controlla se sono in coda
    const myPosition = queue.findIndex(e => e.playerName.toUpperCase() === myName.toUpperCase());

    if (myPosition !== -1) {
        // Sono in coda
        setEurekaDisabledState(true);
        if (myPosition === 0) {
            setEurekaLabel('🏆<br>Tocca a te!');
        } else {
            setEurekaLabel(`⏳<br>Posiz. ${myPosition + 1}`);
        }
    } else {
        // Non sono in coda, posso ancora prenotarmi
        setEurekaDisabledState(false);
        setEurekaLabel('💡<br>EUREKA!');
    }
});
