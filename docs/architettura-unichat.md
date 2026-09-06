# Architettura UniChat

UniChat e una web app client-server con interfaccia HTML/CSS/JavaScript e backend Node.js. L'obiettivo e mantenere le funzioni principali di una chat a server e canali, evitando notifiche, giochi complessi e sistemi secondari pesanti.

## Front-end

Il front-end si trova in `frontend` ed e composto da:

- `index.html`: struttura del documento, form di login/registrazione, liste di server e canali, area messaggi e dialog per creare server.
- `assets/css/styles.css`: layout responsive con Grid e Flexbox, box model, pseudo-classi, stati visuali e media query.
- `assets/js/app.js`: gestione DOM, eventi, array/oggetti, funzioni, async/await, fetch REST, Socket.IO client e Tris privato.

## Back-end

Il back-end espone route REST sotto `/api`:

- `authRoutes`: autenticazione e sessioni.
- `universityRoutes`: elenco, creazione ed eliminazione universita.
- `serverRoutes`: elenco e creazione server, dettaglio server e creazione canali.
- `messageRoutes`: storico e creazione messaggi per canale.

Express gestisce JSON, CORS, file statici, middleware di autenticazione, 404 ed errori applicativi.

## Database

Prisma modella le entita principali:

- `University`: contesto universitario.
- `User`: account registrato.
- `Session`: token di accesso.
- `Server`: gruppo di discussione.
- `ServerMember`: appartenenza utente-server.
- `Channel`: canale testuale o vocale.
- `Message`: messaggio persistente.

## WebSocket

Socket.IO gestisce gli aggiornamenti in tempo reale:

- `join_channel`: inserisce il socket nella stanza del canale.
- `send_message`: valida token e permessi, salva il messaggio e invia `message_created` agli utenti nella stessa stanza.
- `authenticate`: collega il socket all'utente autenticato.
- `private_game_request`: crea un invito a Tris tra due utenti dello stesso server.
- `private_game_accept`: gestisce accettazione o rifiuto.
- `private_game_move`: valida turno e casella, aggiorna la griglia e calcola vincitore o pareggio.
- `private_game_restart`: resetta una partita conclusa.

La persistenza della chat resta nel database, mentre il Tris resta in memoria per non complicare lo schema. Socket.IO sincronizza la UI senza polling continuo.
