# Guida Completa alle Funzioni e all'Architettura di UniChat

Questo documento riepiloga e spiega in dettaglio il funzionamento di tutte le componenti software del progetto **UniChat**, mappando l'intero flusso operativo passo-passo secondo la struttura numerata adottata all'interno del codice sorgente.

---

## Indice dei Flussi Operativi Principali

1. [Acquisizione Token e Stato Globale del Client](#1-acquisizione-token-e-stato-globale-del-client)
2. [Sequenza di Avvio e Bootstrap (Startup & Initialization)](#2-sequenza-di-avvio-e-bootstrap)
3. [Chiamate API Protette e Iniezione Token](#3-chiamate-api-protette-e-iniezione-token)
4. [Autenticazione e Gestione Sessioni Backend](#4-autenticazione-e-gestione-sessioni-backend)
5. [Connessione Realtime WebSocket e Presenza Online](#5-connessione-realtime-websocket-e-presenza-online)
6. [Area di Lavoro e Navigazione (Workspace & Shell)](#6-area-di-lavoro-e-navigazione)
7. [Gestione Server e Canali Universitari](#7-gestione-server-e-canali-universitari)
8. [Messaggistica e Chat Realtime](#8-messaggistica-e-chat-realtime)
9. [Gestione Allegati e File Upload](#9-gestione-allegati-e-file-upload)
10. [Relazioni Sociali e Amicizie](#10-relazioni-sociali-e-amicizie)
11. [Chiamate Private 1-to-1 WebRTC](#11-chiamate-private-1-to-1-webrtc)
12. [Stanze Vocali di Gruppo LiveKit](#12-stanze-vocali-di-gruppo-livekit)
13. [Minigiochi Interattivi Realtime (Tris & Impiccato)](#13-minigiochi-interattivi-realtime)
14. [Ricerca Globale e Preferiti](#14-ricerca-globale-e-preferiti)
15. [Amministrazione, Moderazione e Audit Log](#15-amministrazione-moderazione-e-audit-log)
16. [Impostazioni Profilo e Personalizzazione](#16-impostazioni-profilo-e-personalizzazione)
17. [Disconnessione e Logout](#17-disconnessione-e-logout)
18. [Spegnimento Controllato del Server (Graceful Shutdown)](#18-spegnimento-controllato-del-server)

---

## 1. Acquisizione Token e Stato Globale del Client

### File coinvolti:
- `frontend/assets/js/modules/state.js`
- `frontend/assets/js/modules/events.js`
- `backend/src/utils/sessionTokens.js`

### Come funziona:
1. **Recupero iniziale all'avvio**: In `state.js`, all'apertura della pagina nel browser viene eseguita la lettura di `localStorage.getItem('unichat:token')`. Se l'utente si era precedentemente autenticato e non ha effettuato il logout, il token è già disponibile in memoria.
2. **Generazione e rilascio backend**: Durante il login (`backend/src/controllers/authControllers.js -> login`), il server genera un token casuale crittografico a 32 byte esadecimali (`crypto.randomBytes(32).toString('hex')`).
3. **Memorizzazione sicura**: Nel database non viene salvato il token in chiaro, bensì il suo hash calcolato tramite HMAC-SHA256 con una chiave segreta del server (`env.sessionTokenPepper`).
4. **Conservazione client**: Nel listener di submit del form di login in `events.js`, alla ricezione della risposta HTTP positiva, il token viene assegnato a `state.token` e salvato in `localStorage.setItem('unichat:token', result.token)`.

---

## 2. Sequenza di Avvio e Bootstrap

### File coinvolti:
- `frontend/assets/js/app.js`
- `frontend/assets/js/modules/startup.js`
- `frontend/assets/js/modules/controllers/bootstrapData.js`

### Come funziona:
1. **Orchestrazione**: `app.js` importa tutti i controller e chiama `app.start()`.
2. **Splash Screen**: `startup.js` fa partire i timer per dissolvere e rimuovere la schermata di caricamento iniziale (`startSplashScreenTimers`).
3. **Setup Grafico**: Viene configurata la shell grafica (`setupShellLayout`) e agganciati tutti gli event listener del DOM (`setupEventListeners`).
4. **Bootstrap Dati**: `bootstrapData.js`:
   - Esegue `loadUniversities()` per popolare il selettore delle università nel form di registrazione.
   - Controlla se `state.token` esiste: se non esiste, mostra i form di accesso/registrazione (`setAuthenticatedUi(false)`).
   - Se esiste, effettua una GET su `/api/auth/me`: se valida, imposta la UI autenticata (`setAuthenticatedUi(true)`), apre la socket (`connectSocket()`) e carica i dati dello spazio di lavoro (`loadWorkspaceData()`).
   - Se il token è scaduto o respinto dal backend, pulisce il localStorage e resetta lo stato.

---

## 3. Chiamate API Protette e Iniezione Token

### File coinvolti:
- `frontend/assets/js/modules/api.js`
- `backend/src/middleware/authMiddleware.js`

### Come funziona:
1. **Client Fetch Wrapper**: `api(path, options)` centralizza le chiamate fetch verso `/api`:
   - Rileva se il corpo è `FormData` (upload file) o JSON.
   - Se `state.token` è presente, inietta automaticamente l'header HTTP:
     ```javascript
     Authorization: `Bearer ${state.token}`
     ```
   - Esegue il parsing JSON della risposta e converte gli status HTTP non-2xx in eccezioni JavaScript con messaggi leggibili.
2. **Middleware Backend**: `authMiddleware.js`:
   - Estrae il token dall'header `Authorization: Bearer <token>`.
   - Verifica la conformità regex (64 caratteri esadecimali).
   - Calcola l'hash HMAC e verifica la presenza del record nella tabella `Session` di Prisma.
   - Controlla che `expiresAt` sia nel futuro e che l'account utente non sia sospeso (`user.suspendedAt`).
   - Valorizza `req.user` e `req.session` per i controller successivi.

---

## 4. Autenticazione e Gestione Sessioni Backend

### File coinvolti:
- `backend/src/controllers/authControllers.js`
- `backend/src/middleware/authRateLimit.js`
- `backend/src/utils/serverInvites.js`

### Come funziona:
1. **Rate Limiting**: `authRateLimit.js` controlla il numero di richieste per IP nelle rotte di autenticazione per prevenire attacchi di forza bruta (HTTP 429).
2. **Registrazione (`register`)**:
   - Valida email universitaria, username e password (da 12 a 128 caratteri).
   - Impedisce la registrazione con credenziali riservate al Creator.
   - Crittografa la password con `bcrypt.hash` (usando `SALT_ROUNDS`).
   - Se è fornito un codice invito, valida e riscatta l'invito al server in una transazione Prisma.
3. **Login (`login`)**:
   - Confronta la password fornita con l'hash bcrypt memorizzato nel database.
   - Crea un record `Session` con scadenza configurata (`env.sessionDurationDays`).
   - Restituisce al client il token in chiaro e i metadati pubblici dell'utente.

---

## 5. Connessione Realtime WebSocket e Presenza Online

### File coinvolti:
- `frontend/assets/js/modules/controllers/socket.js`
- `backend/src/sockets/index.js`
- `backend/src/sockets/shared.js`
- `backend/src/sockets/presence.js`

### Come funziona:
1. **Connessione**: Il client inizializza la socket (`io()`) e sull'evento `connect` emette `authenticate` passando `{ token: state.token }`.
2. **Verifica Server**: Il backend riceve il token, lo valida tramite `getUserFromToken(token)` e unisce il socket alla stanza personale dell'utente `user:<userId>`.
3. **Presenza**:
   - `presence.js` tiene traccia dei socket attivi per ogni utente.
   - Invia lo snapshot delle presenze attive al nuovo utente.
   - Se l'utente era precedentemente offline, invia in broadcast agli amici l'evento `presence_changed` con `online: true`.
   - Alla disconnessione, se non rimangono socket aperti per l'utente, notifica `online: false`.

---

## 6. Area di Lavoro e Navigazione

### File coinvolti:
- `frontend/assets/js/modules/controllers/core.js`
- `frontend/assets/js/modules/controllers/navigation.js`
- `frontend/assets/js/modules/controllers/shell.js`
- `frontend/assets/js/modules/controllers/shellLayout.js`

### Come funziona:
1. **Selezione Server (`selectServer`)**: Chiude eventuali chiamate o stanze vocali aperte, imposta `activeServerId`, carica il canale testuale di default e richiede la cronologia messaggi.
2. **Selezione Canale (`selectChannel`)**: Connette il socket alla stanza del canale (`join_channel`), aggiorna l'evidenziazione grafica e recupera i messaggi (`loadMessages`).
3. **Chat Privata (`selectPrivateChat`)**: Verifica che i due utenti siano amici, reimposta l'interfaccia sulla vista diretta 1-to-1 e carica i messaggi privati.
4. **Shell Layout**: Gestisce i breakpoint responsive per smartphone e tablet, aprendo la navigazione in un drawer laterale a scomparsa.

---

## 7. Gestione Server e Canali Universitari

### File coinvolti:
- `frontend/assets/js/modules/controllers/serverLists.js`
- `frontend/assets/js/modules/controllers/channels.js`
- `backend/src/controllers/serverControllers.js`
- `backend/src/routes/serverRoutes.js`

### Come funziona:
1. **Creazione Server**: Il server crea in una singola transazione il server, assegna il creatore come membro/admin, genera un codice invito univoco e istanzia i canali predefiniti (`generale`, `materiali`, `studio-vocale`).
2. **Canali (Text / Voice)**: Possono essere creati e gestiti solo dagli amministratori del server.
3. **Scoperta Server**: Gli utenti possono sfogliare i server pubblici associati alla propria università e inviare richieste di adesione.

---

## 8. Messaggistica e Chat Realtime

### File coinvolti:
- `frontend/assets/js/modules/controllers/messageViews.js`
- `frontend/assets/js/modules/controllers/slashCommands.js`
- `backend/src/controllers/messageControllers.js`
- `backend/src/sockets/chatHandlers.js`

### Come funziona:
1. **Invio Messaggio**:
   - I messaggi solo testo nei canali possono essere inviati in tempo reale tramite Socket.IO (`send_message`).
   - I messaggi privati o contenenti allegati passano via chiamata HTTP protetta (`POST /api/channels/:id/messages` o `/api/private/:userId/messages`).
2. **Cancellazione Logica**: L'autore o un moderatore possono eliminare un messaggio: il testo e gli allegati vengono rimossi dal database e dal disco, ma rimane una traccia segnaposto con `deletedAt` e `deletedById`.
3. **Slash Commands**: I comandi che iniziano con `/` (es. `/roll`, `/shrug`) vengono intercettati localmente dal client e processati.

---

## 9. Gestione Allegati e File Upload

### File coinvolti:
- `frontend/assets/js/modules/attachments.js`
- `frontend/assets/js/modules/controllers/messageAttachments.js`
- `backend/src/utils/messageUpload.js`
- `backend/src/utils/privateAttachments.js`
- `backend/src/routes/uploadRoutes.js`

### Come funziona:
1. **Limiti**: I file sono limitati a 25 MB e alle estensioni consentite (`ALLOWED_ATTACHMENT_EXTENSIONS`: immagini, pdf, zip, audio, video).
2. **Upload Sicuro**: Il backend usa un parser streaming (`uploadParser.js`), memorizza i file in cartelle protette al di fuori della document root pubblica e salva i metadati su Prisma.
3. **Download Protetto**: L'accesso agli allegati avviene solo tramite rotte autenticate (`/api/uploads`), che verificano se l'utente appartiene al server/canale o alla conversazione privata.

---

## 10. Relazioni Sociali e Amicizie

### File coinvolti:
- `frontend/assets/js/modules/controllers/friends.js`
- `backend/src/controllers/friendControllers.js`
- `backend/src/routes/friendRoutes.js`

### Come funziona:
1. **Richieste Amicizia**: Possono essere inviate cercando un utente per username. Lo stato transiziona da `PENDING` ad `ACCEPTED`.
2. **Blocco Utente**: Inserisce una riga nella tabella `BlockedUser`. Un utente bloccato non può più inviare messaggi, avviare chiamate o vedere lo stato online dell'altro.

---

## 11. Chiamate Private 1-to-1 WebRTC

### File coinvolti:
- `frontend/assets/js/modules/controllers/calls.js`
- `backend/src/sockets/callHandlers.js`

### Come funziona:
1. **Signaling**: Gli utenti negoziano la connessione peer-to-peer scambiandosi offerte SDP, risposte SDP e candidati ICE tramite eventi Socket.IO (`private_video_call_signal`).
2. **Media Stream**: Il flusso audio/video viaggia direttamente tra i browser tramite `RTCPeerConnection`.
3. **Persistenza**: Il backend memorizza la durata e l'esito della chiamata nella tabella `PrivateCall`.

---

## 12. Stanze Vocali di Gruppo LiveKit

### File coinvolti:
- `frontend/assets/js/modules/controllers/voiceRtc.js`
- `frontend/assets/js/modules/controllers/voicePanel.js`
- `backend/src/routes/rtcRoutes.js`

### Come funziona:
1. **Token Vocale**: Prima di entrare in un canale vocale, il client richiede un token JWT temporaneo a `/api/rtc/voice-token`.
2. **Connessione SFU**: Il client utilizza l'SDK LiveKit per connettersi al server SFU (`room.connect(credentials.url, credentials.token)`), pubblicando e sottoscrivendo tracce audio/video e condivisione schermo con gestione dinamica dei parlanti attivi.

---

## 13. Minigiochi Interattivi Realtime

### File coinvolti:
- `frontend/assets/js/modules/controllers/gameBoard.js`
- `frontend/assets/js/modules/controllers/gameLauncher.js`
- `backend/src/sockets/gameHandlers.js`

### Come funziona:
1. **Stato in Memoria**: Le partite di Tris (*TicTacToe*) e Impiccato (*Hangman*) sono mantenute in memoria del processo server.
2. **Sincronizzazione**: Ogni mossa viene inviata via socket, validata dal server e ritrasmessa ai partecipanti con il nuovo stato della scacchiera o della parola.

---

## 14. Ricerca Globale e Preferiti

### File coinvolti:
- `frontend/assets/js/modules/controllers/globalSearch.js`
- `backend/src/controllers/searchControllers.js`
- `backend/src/controllers/favoriteControllers.js`

### Come funziona:
1. **Ricerca**: Permette di cercare testo nei messaggi dei canali a cui si ha accesso, nelle chat private e tra gli utenti.
2. **Preferiti**: Permette di appuntare messaggi importanti sia dai canali che dalle chat private, visualizzandoli in un pannello dedicato.

---

## 15. Amministrazione, Moderazione e Audit Log

### File coinvolti:
- `frontend/assets/js/modules/controllers/admin.js`
- `backend/src/controllers/adminControllers.js`
- `backend/src/controllers/roleControllers.js`
- `backend/src/middleware/adminAudit.js`

### Come funziona:
1. **Ruoli**: La piattaforma distingue ruoli gerarchici (`STUDENT`, `PROFESSOR`, `ADMIN`, `PLATFORM_ADMIN`, `SUPERADMIN`).
2. **Azioni**: I moderatori globali e il SuperAdmin possono sospendere account, visualizzare panoramiche globali e consultare l'audit log delle azioni eseguite.
3. **Audit**: Registra in modo non bloccante data, attore, risorsa coinvolta ed esito di ogni azione sensibile.

---

## 16. Impostazioni Profilo e Personalizzazione

### File coinvolti:
- `frontend/assets/js/modules/controllers/settings.js`
- `frontend/assets/css/theme.css`

### Come funziona:
1. **Profilo**: Permette di modificare il nome completo e caricare un nuovo avatar.
2. **Temi**: Offre temi *Chiaro*, *Scuro* e *Nero e Rame*, persistiti nel localStorage del browser e applicati prima del rendering.

---

## 17. Disconnessione e Logout

### File coinvolti:
- `frontend/assets/js/modules/events.js`
- `backend/src/controllers/authControllers.js`

### Come funziona:
1. **Terminazione Media**: Chiude eventuali stanze vocali o chiamate WebRTC attive.
2. **Invalida Sessione**: Chiama `POST /api/auth/logout`, che cancella il record sessione dal database e disconnette forzatamente tutti i socket dell'utente.
3. **Pulizia Locale**: Rimuove il token da `localStorage`, azzera lo stato dell'app e ripristina la schermata iniziale di login.

---

## 18. Spegnimento Controllato del Server

### File coinvolti:
- `backend/src/serverShutdown.js`
- `backend/src/main.js`

### Come funziona:
1. **Segnali OS**: Intercetta segnali `SIGINT` (Ctrl+C) e `SIGTERM`.
2. **Chiusura Connessioni**: Smette di accettare nuove richieste HTTP, disconnette i socket attivi e attende la conclusione delle operazioni pendenti.
3. **Disconnessione DB**: Esegue `prisma.$disconnect()` per rilasciare le connessioni al database PostgreSQL in modo pulito.

---

## Mappa di Riepilogo di Tutti i File JavaScript del Progetto

| File | Percorso | Ruolo Principale |
| :--- | :--- | :--- |
| **app.js** | `frontend/assets/js/` | Orchestrazione e registrazione di tutti i controller del frontend |
| **startup.js** | `frontend/assets/js/modules/` | Sequenza di avvio, splash screen e layout iniziale |
| **state.js** | `frontend/assets/js/modules/` | Definizione dello stato reattivo e lettura token iniziale |
| **api.js** | `frontend/assets/js/modules/` | Client HTTP fetch con iniezione automatica del Bearer token |
| **context.js** | `frontend/assets/js/modules/` | Aggregazione e iniezione delle dipendenze condivise |
| **dom.js** | `frontend/assets/js/modules/` | Selezione di tutti gli elementi DOM e timer splash |
| **events.js** | `frontend/assets/js/modules/` | Listener di submit form, click e interazioni utente |
| **attachments.js** | `frontend/assets/js/modules/` | Validazione formato, estensioni e formattazione byte |
| **ui.js** | `frontend/assets/js/modules/` | Utility rendering avatar, dialoghi di conferma, badge e toast |
| **gameButtonControllers.js** | `frontend/assets/js/modules/` | Micro-animazioni del pulsante di gioco |
| **admin.js** | `frontend/.../controllers/` | Pannello amministrativo e moderazione |
| **bootstrapData.js** | `frontend/.../controllers/` | Caricamento università e ripristino sessione utente |
| **calls.js** | `frontend/.../controllers/` | Gestione videochiamate 1-to-1 WebRTC |
| **channels.js** | `frontend/.../controllers/` | Gestione canali del server attivo |
| **core.js** | `frontend/.../controllers/` | Risoluzione entità attive e pulizia URL |
| **emojiPicker.js** | `frontend/.../controllers/` | Selettore popup delle emoji per la chat |
| **friends.js** | `frontend/.../controllers/` | Gestione lista amici, richieste e presenze |
| **gameBoard.js** | `frontend/.../controllers/` | Rendering e interazione scacchiera minigiochi |
| **gameLauncher.js** | `frontend/.../controllers/` | Apertura e inviti alle partite |
| **globalSearch.js** | `frontend/.../controllers/` | Ricerca messaggi, canali e persone |
| **messageAttachments.js** | `frontend/.../controllers/` | Upload multipart allegati con barra progresso |
| **messageViews.js** | `frontend/.../controllers/` | Rendering messaggi, menu contestuali e preferiti |
| **navigation.js** | `frontend/.../controllers/` | Cambio viste, server e caricamento chat |
| **notifications.js** | `frontend/.../controllers/` | Contatori e azzeramento messaggi non letti |
| **passwordFields.js** | `frontend/.../controllers/` | Toggle visualizzazione testo password |
| **serverLists.js** | `frontend/.../controllers/` | Rendering lista server e scoperta atenei |
| **settings.js** | `frontend/.../controllers/` | Impostazioni profilo e cambio tema |
| **shell.js** | `frontend/.../controllers/` | Gestione interfaccia autenticata e dock audio |
| **shellLayout.js** | `frontend/.../controllers/` | Adattamento responsive layout desktop/mobile |
| **slashCommands.js** | `frontend/.../controllers/` | Gestione comandi slash nella barra chat |
| **socket.js** | `frontend/.../controllers/` | Gestione eventi Socket.IO client-side |
| **voicePanel.js** | `frontend/.../controllers/` | Pannello e anteprima stanza vocale |
| **voiceRtc.js** | `frontend/.../controllers/` | Connessione e gestione media LiveKit |
| **main.js** | `backend/src/` | Avvio server HTTP, Socket.IO e pulizia chiamate orfane |
| **app.js** | `backend/src/` | Configurazione middleware Express e rotte API |
| **serverShutdown.js** | `backend/src/` | Graceful shutdown e disconnessione Prisma |
| **env.js** | `backend/src/config/` | Validazione ed esportazione variabili d'ambiente |
| **adminControllers.js** | `backend/src/controllers/` | Logica dashboard admin e sospensione utenti |
| **authControllers.js** | `backend/src/controllers/` | Registrazione, login, logout e profilo |
| **favoriteControllers.js** | `backend/src/controllers/` | Gestione salvataggio messaggi preferiti |
| **friendControllers.js** | `backend/src/controllers/` | Richieste di amicizia e blocco contatti |
| **messageControllers.js** | `backend/src/controllers/` | Scrittura, lettura ed eliminazione messaggi |
| **roleControllers.js** | `backend/src/controllers/` | Assegnazione ruoli con controlli RBAC |
| **searchControllers.js** | `backend/src/controllers/` | Ricerca full-text su messaggi e contatti |
| **serverControllers.js** | `backend/src/controllers/` | Creazione e gestione server e canali |
| **universityControllers.js**| `backend/src/controllers/` | Elenco atenei universitari supportati |
| **authMiddleware.js** | `backend/src/middleware/` | Verifica Bearer token e sessione su DB |
| **authRateLimit.js** | `backend/src/middleware/` | Prevenzione attacchi brute-force |
| **adminAudit.js** | `backend/src/middleware/` | Tracciamento asincrono azioni di moderazione |
| **errorHandler.js** | `backend/src/middleware/` | Cattura globale eccezioni HTTP 500 |
| **notFoundHandler.js** | `backend/src/middleware/` | Gestione risposte HTTP 404 |
| **index.js (sockets)** | `backend/src/sockets/` | Handshake e registrazione moduli socket |
| **callHandlers.js** | `backend/src/sockets/` | Signaling WebRTC chiamate private 1-to-1 |
| **chatHandlers.js** | `backend/src/sockets/` | Ricezione e broadcast messaggi di canale |
| **gameHandlers.js** | `backend/src/sockets/` | Gestione stato e turni dei minigiochi |
| **presence.js** | `backend/src/sockets/` | Monitoraggio stato online/offline utenti |
| **voiceHandlers.js** | `backend/src/sockets/` | Coordinamento ingressi stanze vocali |
| **sessionTokens.js** | `backend/src/utils/` | Generazione e hash HMAC dei token sessione |
| **serverInvites.js** | `backend/src/utils/` | Generazione e verifica codici invito |
| **messageUpload.js** | `backend/src/utils/` | Storage su disco protetto degli allegati |
| **privateAttachments.js**| `backend/src/utils/` | Controllo permessi accesso file privati |
| **attachmentAccess.js** | `backend/src/utils/` | Validazione diritti di download |
| **attachmentTypes.js** | `backend/src/utils/` | Whitelist estensioni e mime-type ammessi |
| **disconnectUserSockets.js**| `backend/src/utils/`| Disconnessione forzata socket utente |
| **messageDeletion.js** | `backend/src/utils/` | Logica comune cancellazione logica |
| **uploadParser.js** | `backend/src/utils/` | Parsing multipart per richieste di upload |
