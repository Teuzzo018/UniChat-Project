# UniChat

UniChat e una web app di chat universitaria ispirata alle funzioni principali di Discord, pensata per studiare in modo concreto front-end, back-end, REST API, database, Socket.IO e comunicazione WebRTC.

L'app permette di creare server universitari, usare canali testuali e vocali, inviare messaggi privati, gestire amicizie tramite richieste, condividere allegati, fare videochiamate e giocare a Tris con altri utenti.

## In Evidenza

- Server universitari con canali testuali e vocali.
- Ingresso nei server tramite codice o link, con approvazione del creatore.
- Home iniziale vuota dopo il login, con pulsante `U` per tornarci dalla barra server.
- Amicizie reciproche basate su richiesta, accettazione e rifiuto.
- Chat pubbliche e private persistenti.
- Allegati in chat: immagini, audio, video e documenti.
- Canali vocali WebRTC con segnalazione Socket.IO.
- Videochiamate private.
- Tris privato con inviti diretti o link condiviso in chat.
- Pannello admin per eliminare utenti, server e messaggi.

## Stack

| Area | Tecnologie |
| --- | --- |
| Front-end | HTML, CSS, JavaScript |
| Back-end | Node.js, Express |
| Realtime | Socket.IO |
| Audio/video | WebRTC |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | Session token, bcrypt, HMAC SHA-256 |
| Dev environment | Docker Compose |

## Struttura

```text
UniChat/
├── frontend/
│   ├── index.html
│   └── assets/
│       ├── css/styles.css
│       └── js/app.js
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

## Front-End

Il front-end vive in `frontend/` ed e servito direttamente da Express.

- `frontend/index.html`: layout dell'app, dialog, form e aree principali.
- `frontend/assets/css/styles.css`: UI responsive, sidebar, rail server, chat, modali, richieste e animazioni.
- `frontend/assets/js/app.js`: stato client, fetch API, DOM, upload allegati, Socket.IO, WebRTC, amicizie, richieste server e Tris.

Non serve un server front-end separato.

## Back-End

Il back-end vive in `backend/` ed espone API REST piu Socket.IO.

- `backend/src/app.js`: crea l'app Express, registra middleware, API e file statici.
- `backend/src/main.js`: avvia HTTP server e Socket.IO.
- `backend/src/controllers/`: logica applicativa.
- `backend/src/routes/`: endpoint REST.
- `backend/src/middleware/`: auth, admin, 404 ed error handler.
- `backend/src/lib/`: integrazioni condivise, come Prisma.
- `backend/src/utils/`: helper riutilizzabili, inclusa la gestione upload.
- `backend/prisma/`: schema e migration del database.
- `backend/uploads/`: file caricati dagli utenti, esclusi da git.

### Socket.IO Modulare

Gli eventi Socket.IO sono divisi per responsabilita:

- `src/sockets/index.js`: connessione, autenticazione socket e registrazione moduli.
- `src/sockets/shared.js`: helper comuni per token, stanze e utenti.
- `src/sockets/chatHandlers.js`: canali e messaggi realtime.
- `src/sockets/voiceHandlers.js`: canali vocali e segnalazione WebRTC audio.
- `src/sockets/callHandlers.js`: videochiamate private.
- `src/sockets/gameHandlers.js`: Tris, inviti, link e mosse.

## Avvio Locale

1. Copia il file `.env` di esempio:

```bash
cp backend/.env.example backend/.env
```

2. Controlla `backend/.env`:

- `DATABASE_URL` deve puntare al database PostgreSQL.
- `SESSION_TOKEN_PEPPER` deve essere lungo, casuale e privato.
- `ADMIN_SETUP_CODE` e opzionale e abilita la creazione di account admin dalla registrazione.

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

L'app sara disponibile su:

```text
http://localhost:5000
```

## Comandi Utili

```bash
cd backend
npm run check
npm run dev
npm run start
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio
```

## API Principali

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

### Server E Canali

- `GET /api/servers`
- `POST /api/servers`
- `GET /api/servers/:id`
- `DELETE /api/servers/:id`
- `GET /api/servers/available`
- `POST /api/servers/:id/join`
- `POST /api/servers/join-by-invite`
- `GET /api/servers/join-requests`
- `POST /api/servers/join-requests/:requestId/accept`
- `DELETE /api/servers/join-requests/:requestId`
- `POST /api/servers/:id/channels`

Il join a un server tramite lista, codice o link non aggiunge subito l'utente. Viene creata una richiesta pendente che il creatore del server puo accettare o rifiutare.

### Amici

- `GET /api/friends`
- `GET /api/friends/requests`
- `GET /api/friends/search?q=testo`
- `POST /api/friends`
- `POST /api/friends/requests/:id/accept`
- `DELETE /api/friends/requests/:id`
- `DELETE /api/friends/:userId`

`POST /api/friends` invia una richiesta. L'amicizia diventa reciproca solo quando il destinatario accetta.

### Messaggi

- `GET /api/channels/:channelId/messages`
- `POST /api/channels/:channelId/messages`

Il `POST` accetta JSON per messaggi testuali o `multipart/form-data` con campo `content` opzionale e campo `file` per allegati.

### Chat Private

- `GET /api/private/:userId/messages`
- `POST /api/private/:userId/messages`

Anche i messaggi privati accettano testo e file tramite `multipart/form-data`.

## Eventi Socket.IO

### Base E Chat

- `authenticate`: collega il socket all'utente autenticato.
- `join_channel`: entra nella stanza del canale.
- `send_message`: salva e propaga un messaggio.
- `message_created`: nuovo messaggio canale.
- `private_message_created`: nuovo messaggio privato.

### Voce E Video

- `voice_join_channel`: entra in un canale vocale.
- `voice_leave_channel`: esce dal canale vocale.
- `voice_participants`: aggiorna i partecipanti vocali.
- `voice_peer_joined`: nuovo peer audio.
- `voice_peer_left`: uscita peer audio.
- `voice_signal`: scambio offer, answer e ICE candidate audio.
- `private_video_call_request`: richiesta di videochiamata privata.
- `private_video_call_incoming`: chiamata in arrivo.
- `private_video_call_answer`: accetta o rifiuta la chiamata.
- `private_video_call_answered`: esito della chiamata.
- `private_video_call_signal`: segnalazione WebRTC video.
- `private_video_call_end`: termina la chiamata.

### Tris

- `private_game_request`: invita un utente a giocare.
- `private_game_accept`: accetta o rifiuta l'invito.
- `private_game_move`: registra una mossa.
- `private_game_restart`: riavvia una partita conclusa.
- `private_game_link_create`: crea un link di invito.
- `private_game_link_join`: entra in una partita tramite link.

## Sicurezza

- Le password non vengono salvate in chiaro: `User.passwordHash` usa bcrypt.
- I token di sessione non vengono salvati in chiaro: il database conserva `Session.tokenHash`, un HMAC SHA-256 basato su `SESSION_TOKEN_PEPPER`.
- I contenuti applicativi, come messaggi, profili, server, canali e metadati allegati, restano leggibili nel database.
- I file caricati vengono salvati in `backend/uploads/`.

Per cifrare anche messaggi e allegati serve una cifratura applicativa campo per campo con gestione chiavi separata dal database.

## Funzioni Implementate

- Registrazione e login con token di sessione.
- Username univoco.
- Universita e server legati all'universita.
- Home iniziale e ritorno alla home dal pulsante `U`.
- Server con accesso tramite richiesta approvata dal proprietario.
- Inviti server tramite codice o link.
- Canali testuali e vocali.
- Storico messaggi persistente.
- Chat private persistenti.
- Amicizie con richiesta pendente, accettazione/rifiuto e relazione reciproca.
- Upload di immagini, audio, video e documenti.
- Chat realtime con Socket.IO.
- Canali vocali WebRTC.
- Videochiamate private WebRTC.
- Tris privato con inviti diretti o link.
- Pannello admin.
- Socket.IO separato in moduli per leggibilita e manutenzione.
