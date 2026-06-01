const socket = io();

// ===== ROOM CODE from URL =====
const pathParts = window.location.pathname.split('/');
const roomCode = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2];

if (!roomCode || roomCode === 'join' || roomCode === 'student.html') {
    document.body.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:Nunito,sans-serif;color:#ef4444;font-size:1.3rem;text-align:center;padding:20px;">⚠️ Link non valido.<br>Chiedi al tuo insegnante il link corretto per entrare nel gioco.</div>';
}

socket.on('connect', () => {
    socket.emit('join_room', roomCode, (response) => {
        if (response && response.error) {
            document.body.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:Nunito,sans-serif;color:#ef4444;font-size:1.3rem;text-align:center;padding:20px;">⚠️ Stanza non trovata.<br>Il gioco potrebbe essere terminato. Chiedi un nuovo link al tuo insegnante.</div>';
        }
    });
});

const loginScreen    = document.getElementById('login-screen');
const gameScreen     = document.getElementById('game-screen');
const nameInput      = document.getElementById('player-name');
const joinBtn        = document.getElementById('join-btn');
const statusMsg      = document.getElementById('status-msg');
const keyboardEl     = document.getElementById('student-keyboard');
const keyboardSelection  = document.getElementById('keyboard-selection');
const btnShowConsonants  = document.getElementById('btn-show-consonants');
const btnShowVowels      = document.getElementById('btn-show-vowels');

// Tabellone modal
const btnShowBoard    = document.getElementById('btn-show-board');
const boardModal      = document.getElementById('board-modal');
const boardModalClose = document.getElementById('board-modal-close');
const studentBoard    = document.getElementById('student-board');
const studentCategory = document.getElementById('student-category');
const resetGuessesBtn = document.getElementById('reset-guesses-btn');

// Input nativo nascosto (tastiera del dispositivo)
const nativeInput = document.getElementById('native-keyboard-input');

let myId = null;
let myName = '';
let isMyTurn = false;
let serverKeyboardState = { consonants: false, vowels: false };
let currentKeyboardView = '';
let usedLetters = [];

let currentBoardState = null;
// Ipotesi locali { "word-char": "A", ... }
let localGuesses = {};
// Casella corrente selezionata per l'input
let selectedTileKey = null;

const consonantsLayout = [
    ['Q', 'W', 'R', 'T', 'Y', 'P'],
    ['S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
];

const vowelsLayout = [
    ['A', 'E', 'I', 'O', 'U']
];

// ===== KEYBOARD SELECTION (turno - consonanti/vocali) =====

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
    if (currentKeyboardView) renderStudentKeyboard();
});

socket.on('board_state_updated', (state) => {
    currentBoardState = state;
    if (!boardModal.classList.contains('hidden')) {
        renderStudentBoard();
    }
});

// ===== KEYBOARD UI (turno) =====

function updateKeyboardUI() {
    if (!isMyTurn) {
        keyboardSelection.classList.add('hidden');
        keyboardEl.classList.add('disabled');
        keyboardEl.innerHTML = '';
        return;
    }
    keyboardSelection.classList.remove('hidden');
    btnShowConsonants.disabled = !serverKeyboardState.consonants;
    btnShowVowels.disabled    = !serverKeyboardState.vowels;
    btnShowConsonants.style.opacity = btnShowConsonants.disabled ? '0.5' : '1';
    btnShowVowels.style.opacity     = btnShowVowels.disabled    ? '0.5' : '1';
    if (btnShowConsonants.disabled && currentKeyboardView === 'consonants') currentKeyboardView = '';
    if (btnShowVowels.disabled    && currentKeyboardView === 'vowels')     currentKeyboardView = '';
    renderStudentKeyboard();
}

function renderStudentKeyboard() {
    keyboardEl.innerHTML = '';
    if (!currentKeyboardView) { keyboardEl.classList.add('disabled'); return; }
    if (currentKeyboardView === 'consonants' && !serverKeyboardState.consonants) { keyboardEl.classList.add('disabled'); return; }
    if (currentKeyboardView === 'vowels'     && !serverKeyboardState.vowels)     { keyboardEl.classList.add('disabled'); return; }

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
                    socket.emit('guess_letter', { letter, playerId: myId });
                    keyboardEl.classList.add('disabled');
                    statusMsg.textContent = "Hai scelto " + letter + ". Guarda la lavagna!";
                    statusMsg.style.color = "#0f172a";
                });
            }
            rowEl.appendChild(key);
        });
        keyboardEl.appendChild(rowEl);
    });
}

// ===== TABELLONE STUDENTE =====

btnShowBoard.addEventListener('click', () => {
    // Focus PRIMA di tutto: i browser mobile aprono la tastiera solo
    // se focus() è chiamato direttamente dentro un gestore di evento utente
    nativeInput.focus();
    boardModal.classList.remove('hidden');
    renderStudentBoard();
    // Secondo focus dopo il rendering (rafforza su browser che resettano il focus)
    requestAnimationFrame(() => nativeInput.focus());
});

boardModalClose.addEventListener('click', () => {
    boardModal.classList.add('hidden');
    selectedTileKey = null;
    nativeInput.blur();
});

// Tocco sul tabellone → tieni aperta la tastiera nativa
studentBoard.addEventListener('click', () => {
    if (!boardModal.classList.contains('hidden')) {
        nativeInput.focus();
    }
});

// ===== CALCOLO DIMENSIONI CASELLE =====

function calculateTileSize(boardState) {
    const boardPadding = 40;
    const availableWidth = Math.min(window.innerWidth * 0.95, studentBoard.parentElement?.offsetWidth || window.innerWidth) - boardPadding;

    let longestWordLen = 0;
    boardState.words.forEach(wordChars => {
        if (wordChars.length > longestWordLen) longestWordLen = wordChars.length;
    });

    const gapSize = 5;
    const borderSize = 4;
    const maxTileSize = 52;
    const minTileSize = 26;

    let tileSize = Math.floor((availableWidth - (longestWordLen - 1) * gapSize) / longestWordLen) - borderSize;
    tileSize = Math.max(minTileSize, Math.min(maxTileSize, tileSize));

    let fontSize = tileSize * 0.55;
    fontSize = Math.max(12, Math.min(24, fontSize));

    return { tileSize, fontSize, gap: gapSize, wordGap: Math.max(12, Math.min(20, tileSize * 0.4)) };
}

function applyTileSizing(boardState) {
    const s = calculateTileSize(boardState);
    studentBoard.style.setProperty('--tile-size',  s.tileSize  + 'px');
    studentBoard.style.setProperty('--tile-font',  s.fontSize  + 'px');
    studentBoard.style.setProperty('--tile-gap',   s.gap       + 'px');
    studentBoard.style.setProperty('--word-gap',   s.wordGap   + 'px');
}

window.addEventListener('resize', () => {
    if (currentBoardState && !boardModal.classList.contains('hidden')) {
        applyTileSizing(currentBoardState);
    }
});

// ===== RENDER TABELLONE =====

function renderStudentBoard() {
    const savedTileKey = selectedTileKey; // salva selezione corrente
    studentBoard.innerHTML = '';
    selectedTileKey = null;

    if (!currentBoardState) {
        studentBoard.innerHTML = '<div style="color:#64748b;text-align:center;padding:20px;">In attesa che l\'insegnante avvii il gioco...</div>';
        studentCategory.classList.add('hidden');
        return;
    }

    if (currentBoardState.category) {
        studentCategory.textContent = currentBoardState.category;
        studentCategory.classList.remove('hidden');
    } else {
        studentCategory.classList.add('hidden');
    }

    applyTileSizing(currentBoardState);

    currentBoardState.words.forEach((wordChars, wordIdx) => {
        const wordEl = document.createElement('div');
        wordEl.className = 'student-word';

        wordChars.forEach((charData, charIdx) => {
            const tileEl = document.createElement('div');
            tileEl.className = 'student-tile';
            const tileKey = `${wordIdx}-${charIdx}`;

            if (charData.type === 'letter') {
                if (charData.revealed) {
                    tileEl.classList.add('revealed');
                    tileEl.textContent = charData.char;
                    delete localGuesses[tileKey];
                } else {
                    tileEl.classList.add('hidden-letter');
                    tileEl.dataset.tileKey = tileKey;
                    if (localGuesses[tileKey]) {
                        tileEl.textContent = localGuesses[tileKey];
                        tileEl.classList.add('has-guess');
                    }
                    tileEl.addEventListener('click', () => selectTile(tileKey));
                }
            } else {
                tileEl.classList.add('punctuation-tile');
                tileEl.textContent = charData.char;
            }

            wordEl.appendChild(tileEl);
        });

        studentBoard.appendChild(wordEl);
    });

    // Ripristina la selezione precedente se ancora valida
    if (savedTileKey) {
        const tileEl = studentBoard.querySelector(`[data-tile-key="${savedTileKey}"]`);
        if (tileEl && tileEl.classList.contains('hidden-letter')) {
            selectedTileKey = savedTileKey;
            tileEl.classList.add('selected');
        } else {
            autoSelectFirstEmptyTile();
        }
    } else if (!boardModal.classList.contains('hidden')) {
        autoSelectFirstEmptyTile();
    }
}

// ===== SELEZIONE CASELLA =====

function selectTile(tileKey) {
    const prevSelected = studentBoard.querySelector('.student-tile.selected');
    if (prevSelected) prevSelected.classList.remove('selected');

    if (selectedTileKey === tileKey) {
        selectedTileKey = null;
        return;
    }

    selectedTileKey = tileKey;
    const tileEl = studentBoard.querySelector(`[data-tile-key="${tileKey}"]`);
    if (tileEl) {
        tileEl.classList.add('selected');
        tileEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Mantiene la tastiera nativa aperta
    if (!boardModal.classList.contains('hidden')) {
        nativeInput.focus();
    }
}

// Seleziona automaticamente la prima casella vuota (senza ipotesi)
function autoSelectFirstEmptyTile() {
    if (!currentBoardState) return;
    const allHidden = getAllHiddenTileKeys();
    const first = allHidden.find(k => !localGuesses[k]);
    if (first) selectTile(first);
    else if (allHidden.length) selectTile(allHidden[0]);
}

// Restituisce tutte le chiavi delle caselle nascoste in ordine
function getAllHiddenTileKeys() {
    if (!currentBoardState) return [];
    const keys = [];
    currentBoardState.words.forEach((wordChars, wordIdx) => {
        wordChars.forEach((charData, charIdx) => {
            if (charData.type === 'letter' && !charData.revealed) {
                keys.push(`${wordIdx}-${charIdx}`);
            }
        });
    });
    return keys;
}

// ===== INPUT NATIVO (tastiera del dispositivo) =====

nativeInput.addEventListener('input', () => {
    const val = nativeInput.value;
    nativeInput.value = ''; // svuota subito per il prossimo carattere
    if (!val || !selectedTileKey) return;

    // Prende l'ultimo carattere digitato, maiuscolo, rimuove accenti
    const char = val.slice(-1).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (/^[A-Z]$/.test(char)) {
        insertLocalGuess(char);
    }
});

nativeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace') {
        e.preventDefault();
        if (selectedTileKey) {
            const tileEl = studentBoard.querySelector(`[data-tile-key="${selectedTileKey}"]`);
            // Non toccare mai caselle rivelate (prive di data-tile-key o senza hidden-letter)
            if (tileEl && tileEl.classList.contains('hidden-letter') && localGuesses[selectedTileKey]) {
                delete localGuesses[selectedTileKey];
                tileEl.textContent = '';
                tileEl.classList.remove('has-guess');
            } else {
                goToPreviousTile();
            }
        } else {
            goToPreviousTile();
        }
    }
});

// ===== INSERIMENTO IPOTESI =====

function insertLocalGuess(letter) {
    if (!selectedTileKey) return;

    // Sicurezza: la casella deve esistere ed essere ancora nascosta (non rivelata)
    const tileEl = studentBoard.querySelector(`[data-tile-key="${selectedTileKey}"]`);
    if (!tileEl || !tileEl.classList.contains('hidden-letter')) {
        // La casella è stata rivelata: sposta il cursore alla prossima vuota
        autoSelectFirstEmptyTile();
        return;
    }

    localGuesses[selectedTileKey] = letter;
    tileEl.textContent = letter;
    tileEl.classList.add('has-guess');
    tileEl.classList.remove('selected');
    tileEl.style.transform = 'scale(1.2)';
    setTimeout(() => { tileEl.style.transform = ''; }, 150);

    advanceToNextTile();
}

// Avanza alla prossima casella nascosta senza ipotesi
function advanceToNextTile() {
    const allTiles = getAllHiddenTileKeys();
    const currentIdx = allTiles.indexOf(selectedTileKey);
    selectedTileKey = null;

    // Cerca linearmente dopo la posizione corrente
    for (let i = currentIdx + 1; i < allTiles.length; i++) {
        if (!localGuesses[allTiles[i]]) { selectTile(allTiles[i]); return; }
    }
    // Poi dall'inizio
    for (let i = 0; i < currentIdx; i++) {
        if (!localGuesses[allTiles[i]]) { selectTile(allTiles[i]); return; }
    }
    // Tutte le caselle hanno un'ipotesi: rimani sull'ultima
    if (allTiles.length) selectTile(allTiles[Math.min(currentIdx, allTiles.length - 1)]);
}

// Torna alla casella precedente e cancella la sua ipotesi
function goToPreviousTile() {
    const allTiles = getAllHiddenTileKeys();
    const idx = allTiles.indexOf(selectedTileKey);
    if (idx > 0) {
        const prevKey = allTiles[idx - 1];
        if (localGuesses[prevKey]) {
            delete localGuesses[prevKey];
            const tileEl = studentBoard.querySelector(`[data-tile-key="${prevKey}"]`);
            if (tileEl) { tileEl.textContent = ''; tileEl.classList.remove('has-guess'); }
        }
        selectTile(prevKey);
    }
}

// Azzera tutte le ipotesi
resetGuessesBtn.addEventListener('click', () => {
    localGuesses = {};
    selectedTileKey = null;
    renderStudentBoard();
    autoSelectFirstEmptyTile();
    setTimeout(() => nativeInput.focus(), 80);
});

// ===== LOGIN =====

joinBtn.addEventListener('click', () => {
    myName = nameInput.value.trim();
    if (myName) {
        myId = socket.id;
        socket.emit('join_game', myName);
        loginScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        currentKeyboardView = '';
        keyboardEl.innerHTML = '';
    }
});

nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') joinBtn.click();
});

// ===== TURNO =====

socket.on('turn_changed', (activePlayerId) => {
    if (activePlayerId === myId) {
        isMyTurn = true;
        keyboardEl.classList.remove('disabled');
        statusMsg.textContent = "È IL TUO TURNO! Scegli una lettera.";
        statusMsg.style.color = "#0070B8";
    } else {
        isMyTurn = false;
        keyboardEl.classList.add('disabled');
        statusMsg.textContent = "In attesa del tuo turno...";
        statusMsg.style.color = "#EF7D00";
    }
    updateKeyboardUI();
});

// ===== EUREKA! =====

const eurekaBtnMain  = document.getElementById('eureka-btn-main');
const eurekaBtnBoard = document.getElementById('eureka-btn-board');

function handleEurekaPress() {
    if (!myName) return;
    socket.emit('eureka_press', { playerName: myName });
}

function setEurekaLabel(text) {
    if (eurekaBtnMain)  eurekaBtnMain.innerHTML  = text;
    if (eurekaBtnBoard) eurekaBtnBoard.innerHTML = text;
}

function setEurekaDisabledState(disabled) {
    if (eurekaBtnMain)  eurekaBtnMain.disabled  = disabled;
    if (eurekaBtnBoard) eurekaBtnBoard.disabled = disabled;
}

eurekaBtnMain.addEventListener('click', handleEurekaPress);
eurekaBtnBoard.addEventListener('click', handleEurekaPress);

socket.on('eureka_queue_updated', (queue) => {
    if (queue.length === 0) {
        setEurekaDisabledState(false);
        setEurekaLabel('💡<br>EUREKA!');
        return;
    }
    const myPosition = queue.findIndex(e => e.playerName.toUpperCase() === myName.toUpperCase());
    if (myPosition !== -1) {
        setEurekaDisabledState(true);
        setEurekaLabel(myPosition === 0 ? '🏆<br>Tocca a te!' : `⏳<br>Posiz. ${myPosition + 1}`);
    } else {
        setEurekaDisabledState(false);
        setEurekaLabel('💡<br>EUREKA!');
    }
});
