# UniChat

UniChat e una web app di chat universitaria ispirata alle funzioni principali di Discord: server, canali, utenti, amicizie, messaggi in tempo reale, chat private, allegati, canali vocali e videochiamate private.

Il progetto evita volutamente notifiche e funzioni accessorie troppo grandi. L'obiettivo e avere una base chiara per studiare front-end, back-end, REST API, database, Socket.IO e comunicazione WebRTC audio/video.

## Struttura del progetto

```text
UniChat/
├── frontend/
│   ├── index.html
│   └── assets/
│       ├── css/
│       │   └── styles.css
│       └── js/
│           └── app.js
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── lib/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── sockets/
│   │   ├── utils/
│   │   ├── app.js
│   │   └── main.js
│   ├── uploads/
│   ├── .env.example
│   └── package.json
├── docs/
│   └── architettura-unichat.md
├── docker-compose.yml
├── Leggimi.txt
└── README.md
```

## Front-end

Il front-end e separato dal back-end nella cartella `frontend/`.

- `frontend/index.html`: struttura della pagina, form, sezioni principali e dialog.
- `frontend/assets/css/styles.css`: layout responsive con Grid, Flexbox, box model, stati e media query.
- `frontend/assets/js/app.js`: DOM, eventi, fetch, async/await, stato client, Socket.IO, upload allegati, chat private, canali vocali WebRTC, videochiamate private e Tris privato.

Express serve questi file statici, quindi non serve un server front-end separato.

## Back-end

Il back-end si trova in `backend/` ed e basato su Node.js, Express, Prisma, PostgreSQL e Socket.IO.

- `backend/src/app.js`: crea l'app Express, registra middleware, API e file statici.
- `backend/src/main.js`: avvia server HTTP e Socket.IO.
- `backend/src/config/`: configurazione tramite variabili d'ambiente.
- `backend/src/controllers/`: logica delle richieste.
- `backend/src/routes/`: definizione degli endpoint REST.
- `backend/src/middleware/`: autenticazione, 404 e gestione errori.
- `backend/src/sockets/`: eventi Socket.IO.
- `backend/src/lib/`: integrazioni condivise, come Prisma.
- `backend/src/utils/`: funzioni riutilizzabili, inclusa la gestione upload.
- `backend/prisma/`: schema e migrazioni del database.
- `backend/uploads/`: file caricati dagli utenti. La cartella e esclusa da git.

## Sicurezza dei dati nel database

Nel database non vengono salvate password in chiaro: la password utente viene salvata come hash bcrypt nel campo `User.passwordHash`.

Anche i token di sessione non vengono salvati in chiaro: il server consegna al client il token reale solo al login, mentre nel database salva un HMAC SHA-256 nel campo `Session.tokenHash`. L'HMAC usa `SESSION_TOKEN_PEPPER`, un segreto che deve restare solo nel file `.env` del server.

I dati applicativi della chat, come email, username, nomi, universita, server, canali, messaggi privati, contenuto dei messaggi e metadati degli allegati, restano invece leggibili nel database. I file caricati vengono salvati in `backend/uploads/`. Per cifrare anche questi dati serve una cifratura applicativa campo per campo e una gestione delle chiavi separata dal database.

Per creare un super user dalla web app, imposta `ADMIN_SETUP_CODE` in `backend/.env` e inserisci lo stesso codice nel campo "Codice admin" durante la registrazione. Gli account admin vedono il pulsante "Admin" e possono eliminare utenti, server e messaggi dal pannello web.

## Avvio locale

1. Copia il file di esempio:

```bash
cp backend/.env.example backend/.env
```

2. Controlla che `backend/.env` contenga `DATABASE_URL` e cambia `SESSION_TOKEN_PEPPER` con un valore lungo e casuale.

3. Avvia PostgreSQL:

```bash
docker compose up -d
```

4. Installa dipendenze e prepara Prisma:

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
```

5. Avvia il server:

```bash
npm run dev
```

L'app risponde su:

```text
http://localhost:5000
```

## Comandi utili

```bash
cd backend
npm run check
npm run dev
npm run start
npm run prisma:studio
```

## API principali

### Stato

- `GET /api/health`

### Autenticazione

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Universita

- `GET /api/universities`
- `POST /api/universities`
- `DELETE /api/universities/:id`

Il vecchio percorso `/api/university` resta disponibile per compatibilita.

### Server e canali

- `GET /api/servers`
- `POST /api/servers`
- `GET /api/servers/:id`
- `DELETE /api/servers/:id`
- `GET /api/servers/available`
- `POST /api/servers/:id/join`
- `POST /api/servers/join-by-invite`
- `POST /api/servers/:id/channels`

### Amici

- `GET /api/friends`
- `GET /api/friends/search?q=testo`
- `POST /api/friends`
- `DELETE /api/friends/:userId`

### Messaggi

- `GET /api/channels/:channelId/messages`
- `POST /api/channels/:channelId/messages`

Il `POST` dei messaggi canale accetta sia JSON per messaggi testuali sia `multipart/form-data` con campo `content` opzionale e campo `file` per allegati multimediali o documenti.

### Chat private

- `GET /api/private/:userId/messages`
- `POST /api/private/:userId/messages`

Anche i messaggi privati accettano testo, file multimediali e documenti tramite `multipart/form-data`.

## Socket.IO

Eventi principali:

- `join_channel`: entra nella stanza Socket.IO del canale.
- `send_message`: invia un messaggio, lo salva nel database e lo propaga agli utenti nel canale.
- `message_created`: evento ricevuto dal client quando arriva un nuovo messaggio.
- `private_message_created`: evento ricevuto quando arriva un messaggio privato.
- `authenticate`: collega il socket all'utente autenticato.
- `private_video_call_request`: invia una richiesta di videochiamata privata.
- `private_video_call_incoming`: notifica una videochiamata privata in arrivo.
- `private_video_call_answer`: accetta o rifiuta una videochiamata privata.
- `private_video_call_answered`: notifica al chiamante l'esito della richiesta.
- `private_video_call_signal`: scambia offer, answer e ICE candidate WebRTC per la videochiamata privata.
- `private_video_call_end`: termina una videochiamata privata.
- `voice_join_channel`: entra in un canale vocale.
- `voice_leave_channel`: esce dal canale vocale corrente.
- `voice_participants`: aggiorna la lista partecipanti del canale vocale.
- `voice_peer_joined`: notifica l'ingresso di un nuovo peer audio.
- `voice_peer_left`: notifica l'uscita di un peer audio.
- `voice_signal`: scambia offer, answer e ICE candidate WebRTC tra client.
- `private_game_request`: invita un altro utente a giocare a Tris.
- `private_game_accept`: accetta o rifiuta l'invito.
- `private_game_move`: registra una mossa del Tris.
- `private_game_restart`: riavvia una partita conclusa.

## Funzioni implementate

- Registrazione e login con token di sessione.
- Username univoco per ogni utente.
- Creazione e lista universita.
- Creazione server legati all'universita dell'utente.
- Canali testuali e vocali.
- Storico messaggi persistente nei canali.
- Chat private persistenti tra utenti.
- Sistema amici con ricerca per username, nome o email.
- Invio di immagini, audio, video e documenti in chat canale e privata.
- Chat testuale in tempo reale con Socket.IO.
- Chat vocale WebRTC nei canali vocali, con Socket.IO usato per la segnalazione.
- Videochiamate private tra amici dalla chat privata.
- Tris privato tra due utenti dello stesso server.
- UI responsive senza notifiche.
