# 💡 Eureka! v5.1

Eureka! è un gioco didattico multiplayer in tempo reale, ottimizzato appositamente per l'uso in classe tramite la **LIM (Lavagna Interattiva Multimediale)** e i dispositivi degli studenti (smartphone/tablet).

## ✨ Funzionalità Principali

- 🧑‍🏫 **Pannello Docente Completo**: L'insegnante gestisce l'intera partita dalla sua postazione (o dalla LIM). Può inserire frasi segrete, gestire le categorie e avviare il gioco.
- 📱 **Accesso Studenti Immediato**: Gli studenti entrano in partita tramite un semplice link o codice, direttamente dal browser dei loro dispositivi, senza bisogno di installare nessuna app.
- ⏱️ **Sistema di Coda "EUREKA!"**: Quando gli studenti sono pronti a dare la soluzione completa, possono premere il pulsante "EUREKA!". Il sistema crea automaticamente una coda cronologica visibile al docente, evitando accavallamenti.
- 🎯 **Verifica e Punteggi Automatici**: L'insegnante inserisce la soluzione fornita dall'alunno. Se è corretta, il sistema assegna in automatico i punti allo studente e svela il tabellone con animazioni e suoni celebrativi.
- 🖥️ **Tabellone Adattivo**: L'interfaccia grafica si adatta intelligentemente per visualizzare perfettamente anche frasi molto lunghe su un'unica schermata.

## 🛠️ Tecnologie Utilizzate

- **Backend**: Node.js, Express
- **Real-Time Communication**: Socket.IO
- **Frontend**: HTML5, CSS3 (Vanilla), JavaScript
- **Styling**: Modern UI con effetti *Glassmorphism* e palette colori adattiva.

## 🚀 Come avviare il progetto in locale

1. Assicurati di avere [Node.js](https://nodejs.org/) installato sul tuo computer.
2. Clona questo repository o scarica i file.
3. Apri il terminale nella cartella del progetto e installa le dipendenze:
   ```bash
   npm install
   ```
4. Avvia il server:
   ```bash
   node server.js
   ```
5. Apri il browser all'indirizzo `http://localhost:3000` per accedere alla schermata docente.

## 🌐 Deploy (Messa online)

Questo progetto è configurato per un rilascio rapido e automatico su **Render.com**. è possibile accedere alla versione già caricata online e pronta collegandosi al sito: https://eureka-game.onrender.com/

---
*Progetto ideato e sviluppato per la didattica innovativa in classe.* 
