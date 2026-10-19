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
- Tris privato con inviti diretti agli amici o link condiviso in chat.
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
│       ├── css/
│       │   └── styles.css
│       └── js/
│           ├── app.js
│           └── modules/
│               ├── api.js
│               ├── attachments.js
│               ├── context.js
│               ├── dom.js
│               ├── events.js
│               ├── startup.js
│               ├── state.js
│               ├── ui.js
│               └── controllers/
│                   ├── admin.js
│                   ├── bootstrapData.js
│                   ├── calls.js
│                   ├── channels.js
│                   ├── core.js
│                   ├── friends.js
│                   ├── gameBoard.js
│                   ├── gameLauncher.js
│                   ├── messageAttachments.js
│                   ├── messageViews.js
│                   ├── navigation.js
│                   ├── serverLists.js
│                   ├── settings.js
│                   ├── shell.js
│                   ├── socket.js
│                   ├── voiceRtc.js
│                   └── voiceTranscripts.js
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
- `frontend/assets/js/app.js`: entry point del client. Crea il contesto, registra i controller e avvia l'app.
- `frontend/assets/js/modules/`: moduli condivisi per stato, DOM, API, allegati, UI, eventi e startup.
- `frontend/assets/js/modules/controllers/`: logica client divisa per area funzionale: admin, impostazioni, amici, server, canali, messaggi, chiamate, voce, giochi, Socket.IO e bootstrap dati.

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
- `src/sockets/gameHandlers.js`: Tris tra amici, inviti, link e mosse.

## Avvio Iniziale

1. Copia il file `.env` di esempio se non esiste già (dalla cartella principale del progetto; in PowerShell `cp` è un alias di `Copy-Item`):

```bash
cp backend/.env.example backend/.env
```

2. Controlla `backend/.env`. Per avviare il backend direttamente dal tuo terminale deve contenere:

```env
DATABASE_URL="postgresql://unichat_user:unichat_password@localhost:5433/unichat_db?schema=public"
```

Imposta `SESSION_TOKEN_PEPPER` con un valore lungo e casuale. Per registrare il primo superadmin, sostituisci anche il segnaposto di `ADMIN_SETUP_CODE` con un codice casuale scelto da te. `ADMIN_SETUP_CODE` è opzionale se non devi effettuare il bootstrap. Non pubblicare questi valori.

### Configurazione sensibile

`DATABASE_URL` viene letta da Prisma (`backend/prisma/schema.prisma`) per collegarsi a PostgreSQL. Se cambia host, utente o database, l'app punta a una destinazione diversa; i dati e le migrazioni non vengono trasferiti automaticamente. Un esempio con segnaposto è `postgresql://<utente>:<password>@<host>:5432/<database>?schema=public`. Conserva il valore reale fuori dal repository.

`SESSION_TOKEN_PEPPER` è la chiave HMAC usata per salvare solo l'hash dei token di sessione. Sostituirla rende inutilizzabili le sessioni esistenti: gli utenti devono effettuare di nuovo l'accesso. In produzione è obbligatoria una chiave casuale di almeno 32 caratteri, diversa dai segnaposto di esempio. Un esempio di formato è `<chiave-casuale-di-almeno-32-caratteri>`.

`ADMIN_SETUP_CODE` consente di registrare il primo `SUPERADMIN` solo se non esiste alcun account privilegiato. Su installazioni con account `ADMIN` storici e senza superadmin, un admin storico autenticato può usare `POST /api/auth/bootstrap-superadmin` con `adminCode`; l'operazione è consentita una sola volta. Il codice non promuove altri account tramite la registrazione. Dopo il bootstrap, rimuovilo dall'ambiente. Cambiarlo non modifica i ruoli già assegnati. Esempio di formato: `<codice-bootstrap-casuale>`. Docker Compose legge questo valore da `backend/.env`.

Al primo avvio, se non ci sono università, registra il primo superadmin con `ADMIN_SETUP_CODE` lasciando vuota l'università. Dopo il login, il superadmin può creare le università con `POST /api/universities` usando la sua sessione Bearer; solo allora gli altri utenti possono registrarsi scegliendo un'università. La creazione anonima di università è disabilitata. Il bootstrap usa un lock transazionale PostgreSQL per evitare due promozioni concorrenti.

Il Compose fornito contiene credenziali dimostrative per PostgreSQL; non usarle in produzione. Il Dockerfile imposta `NODE_ENV=production`: `SESSION_TOKEN_PEPPER` deve essere un segreto casuale valido e `ADMIN_SETUP_CODE`, se presente, non può essere un segnaposto. Docker Compose legge entrambi da `backend/.env` senza sovrascriverli. Non modificare `DATABASE_URL` su un'istanza già in uso senza pianificare il collegamento al database corretto.

Gli allegati nuovi dei messaggi sono conservati in `backend/private_uploads/`, fuori dalla directory pubblica. Il download usa `/api/uploads/private-uploads/:filename` con token Bearer e controllo di appartenenza al server o partecipazione al DM a ogni richiesta. I vecchi allegati in `backend/uploads/` restano accessibili tramite `/api/uploads/:filename` con lo stesso controllo. Gli avatar rimangono pubblici su `/uploads/:filename`. Non esporre `backend/uploads/` o `backend/private_uploads/` come directory statiche nel reverse proxy.

Il client conserva il token di sessione in `localStorage`: riduci il rischio di XSS, servi l'app su HTTPS e non inserire codice JavaScript non affidabile nella pagina. In caso di cambio del pepper, tutte le sessioni attuali cessano di funzionare.

### Ruoli e permessi

`STUDENT` e `PROFESSOR` sono utenti ordinari. `ADMIN` è il nome storico dell'admin di piattaforma e mantiene solo i permessi di moderazione globale di `PLATFORM_ADMIN`. L'admin di server è un membro con `ServerMember.isAdmin`; il proprietario conserva gli stessi privilegi locali senza assegnazione. Le decisioni sono prese dal backend per ogni richiesta HTTP ed evento Socket.IO.

| Operazione | Utente | Admin server / proprietario | Admin piattaforma (`ADMIN` incluso) | Superadmin |
| --- | --- | --- | --- | --- |
| Chat, allegati, DM e chiamate | Sì, con appartenenza o relazione richiesta | Come utente | Come utente | Come utente |
| Canali e richieste di ingresso | No | Solo nei propri server | No | Tutti i server |
| Eliminare messaggi di canale | Solo i propri nei canali accessibili | I propri e quelli nei server amministrati | I propri e quelli in tutti i server | I propri e quelli in tutti i server |
| Eliminare messaggi privati | Solo i propri nella conversazione | Solo i propri | Solo i propri | Solo i propri |
| Eliminare un server | Solo se proprietario | Solo se proprietario | Tutti | Tutti |
| Vedere dashboard e registro | No | Solo nei propri server | Globale | Globale |
| Modificare server ed eliminare canali | No | Solo nei propri server | Globale | Globale |
| Sospendere utenti ordinari | No | No | Sì, esclusi proprietari e admin locali | Sì |
| Eliminare utenti e gestire università | No | No | No | Sì; nessuna eliminazione diretta di superadmin |
| Nominare/revocare admin server e ruoli globali | No | No | No | Sì, mai su sé stesso |

L'ultimo superadmin, e l'ultimo superadmin attivo in caso di sospensione, sono protetti. Una variazione del ruolo globale invalida le sessioni dell'utente interessato; sospensione e revoca dell'admin locale disconnettono anche i socket già aperti. La sospensione invalida tutte le sessioni e blocca nuovi login. Dopo una migrazione su un'installazione con `ADMIN` storici, esegui il bootstrap autenticato prima di rimuovere `ADMIN_SETUP_CODE`. Nessuna migrazione storica viene riscritta: la nuova migrazione aggiunge enum, colonne e indici preservando i dati.

Endpoint di gestione: `POST/DELETE /api/admin/users/:id/suspension`, `PATCH /api/admin/users/:id/role`, `PUT/DELETE /api/admin/servers/:serverId/admins/:userId` e `DELETE /api/servers/:id/messages/:messageId`. `POST /api/auth/bootstrap-superadmin` richiede una sessione di admin storico e il codice di bootstrap. Le operazioni di nomina/revoca richiedono che l'utente sia membro del server.

Il menu `⋯` dei messaggi permette all'autore di eliminarli per tutti; nei canali possono eliminare messaggi anche i moderatori autorizzati. I preferiti sono salvati per account nel database e consultabili dalla Home. L'elenco non restituisce messaggi eliminati o conversazioni cui l'utente non ha più accesso. Per attivare i preferiti su un database esistente applica anche la migrazione additiva `20261016120000_message_favorites`, poi rigenera Prisma Client e riavvia il backend. La rinomina dei canali usa `PATCH /api/admin/servers/:serverId/channels/:channelId`; non richiede una migrazione aggiuntiva.

La dashboard usa `GET /api/admin/overview?page=1&pageSize=20&q=nome` per account ricercabili e paginati, server e messaggi nel proprio ambito; `GET /api/admin/audit?page=1&pageSize=20` mostra il registro. Modifica server: `PATCH /api/admin/servers/:id`; rinomina canale: `PATCH /api/admin/servers/:serverId/channels/:channelId`; elimina canale: `DELETE /api/admin/servers/:serverId/channels/:channelId`. Il registro salva ID autore, azione, tipo e ID risorsa, server, esito e data; non salva payload, codice di bootstrap o testo dei messaggi. Le operazioni negate dopo l'autenticazione sono registrate; i tentativi anonimi non hanno un autore identificabile. La scrittura del registro avviene alla chiusura della risposta: se fallisce, l'operazione potrebbe essere stata eseguita senza voce di registro. Controlla i log applicativi prima di usare questo registro come traccia di conformità.

### Verifica in due passaggi degli amministratori

Il secondo fattore usa TOTP a 6 cifre con periodo di 30 secondi tramite `otplib` e 10 codici di recupero monouso. Le chiavi TOTP vengono cifrate con AES-256-GCM prima di essere salvate nel database; i codici di recupero sono casuali e nel database resta solo il loro hash SHA-256. `TOTP_ENCRYPTION_KEY` deve essere una chiave esadecimale casuale di 32 byte, conservata fuori dal database e uguale su tutte le istanze. Il valore di esempio in `.env.example` è solo un segnaposto commentato. La chiave è necessaria per configurare o verificare TOTP; perderla rende inutilizzabili i segreti TOTP già cifrati. I codici di recupero restano utilizzabili per accedere e disattivare il secondo fattore con la password. Non inserire la chiave nei log o nel repository.

Gli admin già presenti possono continuare ad accedere finché non attivano TOTP: non è stato imposto un obbligo globale. Nella dashboard, inseriscono la password e scelgono **Configura**, registrano la chiave nell'app di autenticazione e confermano con un codice valido. L'attivazione scade dopo 10 minuti. I codici di recupero sono mostrati solo nella risposta di attivazione o rigenerazione; salvarli offline prima di chiudere la schermata. L'attivazione invalida le altre sessioni dell'account. Le operazioni di modifica dei ruoli globali e locali, eliminazione di account e bootstrap del superadmin richiedono TOTP attivo e una verifica effettuata negli ultimi 10 minuti. Un admin storico può quindi configurare TOTP prima del bootstrap.

Dopo l'attivazione, il login con password crea una sessione incompleta che scade dopo 10 minuti. Solo `POST /api/auth/2fa/verify` e il logout possono usarla; le altre API e gli eventi Socket.IO rifiutano la sessione finché un codice TOTP o di recupero non è verificato. Dopo la verifica, la sessione assume la durata normale. `POST /api/auth/2fa/step-up` aggiorna la verifica recente per una sessione completa. `POST /api/auth/2fa/disable` e `POST /api/auth/2fa/recovery-codes` richiedono sia la password sia un codice TOTP o di recupero. I codici TOTP già usati nello stesso intervallo e i codici di recupero consumati sono rifiutati. Dopo cinque tentativi errati l'account MFA è bloccato per 15 minuti; esiste anche un limite per IP in memoria. Sincronizza l'ora del server con NTP.

Se l'admin perde l'app, usa un codice di recupero monouso; dopo l'accesso può rigenerarne altri o disattivare TOTP con password e codice. Se perde anche tutti i codici, non esiste un bypass automatico: serve una procedura operativa separata con verifica dell'identità e ripristino controllato dal database o da un backup. Preparare questa procedura e almeno un secondo superadmin con codici di recupero prima di imporre un futuro obbligo MFA. La rotazione di `TOTP_ENCRYPTION_KEY` richiede ricifratura pianificata dei segreti o nuova iscrizione; cambiarla direttamente blocca la verifica TOTP degli account già iscritti.

Per distribuire questa versione, verifica prima lo stato delle migrazioni sul database di destinazione e crea un backup. Applica le migrazioni additive `20261014190000_add_privileged_roles_and_suspensions`, `20261015120000_add_admin_audit_log`, `20261015140000_add_admin_totp`, `20261015160000_add_message_tombstones`, `20261015180000_friendship_lookup_constraints` e `20261015190000_server_invite_discovery` con `prisma migrate deploy`, rigenera Prisma Client con `npm run prisma:generate`, quindi riavvia il backend. La migrazione della ricerca crea l'estensione PostgreSQL `pg_trgm`; il ruolo che applica le migrazioni deve poterla creare. Non usare `migrate reset`. Dopo il riavvio, esegui il bootstrap del superadmin secondo la presenza o meno di admin storici e poi rimuovi `ADMIN_SETUP_CODE` dalla configurazione. Le sessioni degli utenti già esistenti continuano a funzionare; i privilegi vengono letti dal database a ogni richiesta.

### Backend Locale Con Database Docker

In Windows, apri **Docker Desktop** e attendi che il motore Linux sia in esecuzione. In PowerShell, dalla cartella principale del progetto, verifica Docker e avvia PostgreSQL:

```powershell
docker info
docker compose up -d postgres
```

Prepara le dipendenze e il database **nello stesso ambiente in cui avvierai Node.js**. Se usi PowerShell, installa le dipendenze da PowerShell: una cartella `node_modules` installata da WSL non va considerata valida per Windows. Il progetto ha `backend/package-lock.json`, quindi usa `npm ci` alla prima installazione o quando cambiano le dipendenze:

```powershell
cd backend
npm ci
npm run prisma:generate
npx prisma migrate deploy
```

Avvia il server dallo stesso terminale:

```powershell
npm run dev
```

L'app sarà disponibile su `http://localhost:5000`. Il frontend è servito dal backend Express: non occorre avviare Vite o un secondo server. Il database è esposto da Docker sulla porta `5433`, già usata dalla `DATABASE_URL` di esempio per il backend locale. Per i riavvii successivi bastano `docker compose up -d postgres` dalla cartella principale e `npm run dev` da `backend`.

Se esegui i comandi da WSL, abilita la distribuzione in **Docker Desktop → Settings → Resources → WSL Integration**. Esegui anche `npm ci` e il backend da WSL, senza riutilizzare i `node_modules` installati da PowerShell.

#### Errori comuni in PowerShell

- `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`: Docker Desktop o il suo motore Linux non è ancora in esecuzione. Avvialo, attendi che sia pronto e ripeti `docker info`, poi `docker compose up -d postgres`. Non proseguire con la migrazione finché PostgreSQL non è avviato.
- `"prisma" non è riconosciuto` oppure `"nodemon" non è riconosciuto`: mancano le dipendenze npm per l'ambiente corrente. Da `backend` esegui `npm ci`, poi ripeti `npm run prisma:generate`, `npx prisma migrate deploy` e `npm run dev`.
- `File richiesto non trovato: ...` indica che il database fa riferimento a un file assente sul disco, per esempio un vecchio avatar o allegato. Il log mostra il percorso HTTP per identificarlo; la richiesta riceve 404. Verifica che gli upload siano presenti nel volume o nella cartella usata dall'istanza corrente.
- Se hai già eseguito `cd backend`, torna alla cartella principale con `cd ..` prima di `docker compose up -d postgres`, poi rientra con `cd backend`.

### Avvio Completo Con Docker

Se vuoi avviare sia backend sia database dentro Docker, dalla cartella principale del progetto esegui:

```bash
docker compose up -d
```

In questo caso il backend usa la variabile gia configurata in `docker-compose.yml`:

```env
DATABASE_URL=postgresql://unichat_user:unichat_password@postgres:5432/unichat_db?schema=public
```

Nota: se lanci il backend fuori da Docker usa `localhost:5433`, come in `backend/.env`. Se il backend gira dentro Docker usa `postgres:5432`, come in `docker-compose.yml`.

## Comandi Utili

```bash
cd backend
npm run check
npm test
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

I codici esistenti restano validi dopo la migrazione, senza scadenza o limite, ma nessun server esistente diventa scopribile automaticamente. Il proprietario, un admin del server o un superadmin può leggere l'invito con `GET /api/servers/:id/invite`, crearne uno nuovo con `POST /api/servers/:id/invite` (`expiresAt` ISO futuro e `maxUses` da 1 a 100000, entrambi opzionali), revocarlo con `DELETE /api/servers/:id/invite` e impostare la scopribilità con `PATCH /api/servers/:id/discoverability` (`isDiscoverable` booleano). La creazione sostituisce il codice precedente e azzera gli usi. La revoca impedisce nuove richieste tramite quel codice; le richieste già inviate restano in attesa della decisione del gestore. Un uso è una nuova richiesta o il reinvio di una richiesta rifiutata; richieste ancora pendenti e membri esistenti non consumano altri usi. Il controllo e la prenotazione avvengono nella stessa transazione con aggiornamento condizionato, anche per la registrazione tramite invito.

La ricerca globale usa `GET /api/search?scope=explore|member|channels|users|friends&q=testo&page=1&limit=10`. Sono ammessi al massimo 20 risultati per pagina e 50 pagine, senza conteggio totale. I risultati `explore` includono solo server marcati scopribili della stessa università e non ancora frequentati; possedere un invito non cambia la visibilità pubblica. `member` e `channels` richiedono appartenenza al server, mentre `users` e `friends` escludono account sospesi, l'utente corrente e blocchi reciproci. La ricerca utenti richiede almeno due caratteri. Nessuna risposta di ricerca include codice invito, email, messaggi o conteggi di membri/canali. Il modello attuale non prevede canali con ACL individuali: tutti i canali di un server sono accessibili ai suoi membri. La vecchia lista `/api/servers/available` è limitata ai primi 50 server scopribili; usa la ricerca globale per paginare. I filtri sono nelle query Prisma, con indici per scopribilità e ricerca testuale. Il client interrompe le richieste precedenti e ignora risposte superate quando il testo cambia rapidamente.

### Amici

- `GET /api/friends`
- `GET /api/friends/requests`
- `GET /api/friends/search?q=testo`
- `POST /api/friends`
- `POST /api/friends/requests/:id/accept`
- `DELETE /api/friends/requests/:id`
- `DELETE /api/friends/requests/:id/cancel`
- `DELETE /api/friends/:userId`

`POST /api/friends` invia una richiesta. Una seconda richiesta identica riusa la stessa riga; se il destinatario invia una richiesta incrociata, l'amicizia viene accettata. Il destinatario può accettare o rifiutare, il mittente può annullare, ed entrambi possono rimuovere un'amicizia accettata. Non sono ammesse richieste a sé stessi, a utenti sospesi o tra utenti bloccati. Le transizioni concorrenti usano aggiornamenti condizionati; la coppia ordinata ha un vincolo univoco e nuovi vincoli impediscono coppie con lo stesso utente o autore estraneo alla coppia. L'elenco amici nella home offre l'accesso alla chat e lo stato online/offline.

La presenza Socket.IO conta le connessioni nella room dell'utente: la chiusura di una sola scheda non produce un evento offline se altre schede o dispositivi restano connessi. Snapshot ed eventi di presenza riguardano solo amicizie accettate e non bloccate. L'installazione Compose usa una sola istanza backend; per più istanze serve un adapter Socket.IO condiviso affinché il conteggio e gli eventi attraversino tutti i processi.

### Messaggi

- `GET /api/channels/:channelId/messages`
- `POST /api/channels/:channelId/messages`
- `DELETE /api/channels/:channelId/messages/:messageId`

Il `POST` accetta JSON per messaggi testuali o `multipart/form-data` con campo `content` opzionale e campo `file` per allegati.

Gli upload passano da Express e vengono salvati nel volume locale privato `backend_private_uploads`. Questa scelta riusa il backend e il volume persistente già presenti; uno storage dedicato richiederebbe integrazione e credenziali aggiuntive ed è più adatto a più istanze o a una capacità maggiore. Nessun file passa tramite WebRTC o DataChannel. Non vengono emessi URL firmati: revocare la sessione, l'appartenenza al server o eliminare il messaggio blocca i successivi download autorizzati. Un file già scaricato o una anteprima già caricata nel browser non è revocabile.

I limiti configurabili in `backend/.env` sono `MAX_ATTACHMENT_BYTES` (predefinito 26214400 byte, 25 MiB per file), `MAX_ATTACHMENT_FILES_PER_MESSAGE` (0 o 1; predefinito 1) e `MAX_ATTACHMENT_STORAGE_BYTES` (predefinito 1073741824 byte, 1 GiB totale sul volume). Il limite di spazio include anche gli upload ancora in corso e gli orfani non ancora rimossi. Le estensioni consentite sono PNG, JPG/JPEG, GIF, WebP, PDF, ZIP, TXT UTF-8, WAV, OGG, MP3, MP4 e WebM. Il server verifica la firma del contenuto e la coerenza con l'estensione, senza usare il MIME dichiarato dal client come prova. La verifica è basata su firme e validità UTF-8, non su una decodifica completa dei formati. Le anteprime sono limitate a immagini, audio e video; gli altri file si scaricano soltanto. Il download usa `attachment`, `nosniff`, CSP sandbox e `Cache-Control: private, no-store`. Non è disponibile una scansione antimalware: i file non vanno considerati sicuri solo perché ammessi.

I file hanno nomi interni casuali, senza componenti del percorso forniti dal client. Un upload rifiutato viene rimosso subito; gli allegati eliminati vengono rimossi se non più referenziati. All'avvio e ogni ora il backend rimuove i file privati orfani più vecchi di un'ora. Il volume deve restare privato e persistente; una pulizia fallita viene segnalata nei log e riprovata dal controllo periodico.

L'autore può eliminare un proprio messaggio solo in un canale a cui ha ancora accesso; un moderatore può eliminare messaggi nel proprio ambito. L'eliminazione conserva la riga e la posizione nella cronologia, ma svuota contenuto e metadati dell'allegato. L'interfaccia mostra «Messaggio eliminato». Una richiesta ripetuta da un utente ancora autorizzato restituisce successo senza propagare un secondo evento. Il file locale è rimosso solo se nessun altro messaggio o avatar lo referenzia; un errore di pulizia lascia il file non esposto tramite il messaggio eliminato e richiede intervento operativo. Non esistono ancora risposte a messaggi o anteprime persistite da aggiornare.

### Chat Private

- `GET /api/private/:userId/messages`
- `POST /api/private/:userId/messages`
- `DELETE /api/private/:userId/messages/:messageId`

Anche i messaggi privati accettano testo e file tramite `multipart/form-data`.
Solo amici attivi, non bloccati e non sospesi possono aprire o usare una conversazione privata. Alla fine dell'amicizia la cronologia resta nel database, ma lettura, invio, eliminazione e download degli allegati DM sono bloccati; una nuova amicizia ripristina l'accesso alla cronologia. Solo il mittente può eliminare un proprio messaggio privato nella coppia indicata dalla richiesta. La cronologia di entrambi i partecipanti mostra lo stesso segnaposto.

## Eventi Socket.IO

### Base E Chat

- `authenticate`: collega il socket all'utente autenticato.
- `join_channel`: entra nella stanza del canale.
- `send_message`: salva e propaga un messaggio.
- `message_created`: nuovo messaggio canale.
- `private_message_created`: nuovo messaggio privato.
- `message_deleted`: messaggio di canale eliminato; contiene ID, canale e data.
- `private_message_deleted`: messaggio privato eliminato; inviato solo alle room dei due partecipanti e contiene ID, partecipanti e data.

### Voce E Video

Le chiamate private uno-a-uno funzionano fra amici attivi, senza blocchi reciproci o sospensione. La segnalazione Socket.IO controlla sessione, partecipanti e amicizia a ogni richiesta; offer, answer e ICE sono inoltrati soltanto ai due socket scelti. Una sola chiamata per utente può essere attiva o in attesa per processo. La prima scheda del destinatario che accetta usa la chiamata; le altre chiudono l'avviso. Sono gestiti rifiuto, occupato, annullamento, timeout (predefinito 30 s), termine e disconnessione. Il server salva lo stato nello storico `PrivateCall` esistente. I controlli audio/video della chat e del pannello chiamata usano `getUserMedia` e le tracce WebRTC reali; alla chiusura vengono fermate le tracce e il peer. Gli allegati restano su HTTP autenticato e non passano tramite WebRTC.

Configurazione: `WEBRTC_STUN_URLS` contiene URL STUN separati da virgole; il predefinito è `stun:stun.l.google.com:19302`. Per TURN imposta `WEBRTC_TURN_URLS` e `WEBRTC_TURN_SHARED_SECRET` (almeno 32 caratteri), uguale al segreto `use-auth-secret`/`static-auth-secret` del server TURN. `GET /api/rtc/config` richiede la sessione e restituisce credenziali TURN temporanee di un'ora, senza cache; il segreto resta sul backend. Le chiamate terminano dopo 45 minuti per evitare l'uso di credenziali scadute; `CALL_MAX_DURATION_MS` può ridurre o aumentare il limite fino a 55 minuti. `CALL_RING_TIMEOUT_MS` accetta 10–120 secondi. Le credenziali TURN già emesse restano valide fino alla scadenza anche se una sessione UniChat viene revocata. Configura il TURN per UDP 3478 e, dove necessario, TLS/TCP 5349, con porte relay aperte e DNS/certificato validi. In produzione servi UniChat su HTTPS e inoltra WebSocket/Socket.IO dal reverse proxy (`Upgrade`/`Connection`); `getUserMedia` richiede un contesto sicuro (localhost è ammesso per sviluppo). La connettività tra reti diverse **non è stata verificata con TURN** e non va considerata affidabile finché non viene provata nell'ambiente di distribuzione.

Il registro delle chiamate è condiviso in memoria dal singolo processo Socket.IO e viene liberato su fine chiamata o disconnessione. All'avvio gli stati precedenti ancora attivi vengono chiusi nello storico. Per distribuire più processi/istanze occorrono un adapter Socket.IO condiviso e una prenotazione delle chiamate distribuita; questa versione supporta un solo processo. Docker Compose carica `backend/.env` nel servizio `backend`, incluse la chiave TOTP e le eventuali variabili TURN; i valori dichiarati esplicitamente in `environment` nel Compose hanno precedenza. Non include chiamate di gruppo, trasferimento P2P di file o ripresa della chiamata dopo la riconnessione. Lo storico non distingue ancora chiamate audio e video. Il modello `PrivateCall` esistente è sufficiente: questa modifica non aggiunge una migrazione; restano da applicare le migrazioni elencate nella sezione di distribuzione prima dell'avvio su un database non aggiornato.

- `voice_join_channel`: entra in un canale vocale.
- `voice_leave_channel`: esce dal canale vocale.
- `voice_participants`: aggiorna i partecipanti vocali.
- `voice_peer_joined`: nuovo peer audio.
- `voice_peer_left`: uscita peer audio.
- `voice_signal`: scambio offer, answer e ICE candidate audio.
- `private_video_call_request`: richiesta di chiamata privata (`mode: audio|video`).
- `private_video_call_incoming`: chiamata in arrivo.
- `private_video_call_answer`: accetta o rifiuta la chiamata.
- `private_video_call_answered`: esito della chiamata.
- `private_video_call_claimed`: la prima scheda che accetta è selezionata.
- `private_video_call_signal`: offer, answer e candidati ICE fra i due socket selezionati.
- `private_video_call_end`: termina la chiamata.
- `private_video_call_ended`: comunica termine, annullamento, rifiuto, timeout o disconnessione.

### Tris

- `private_game_request`: invita un amico a giocare.
- `private_game_accept`: accetta o rifiuta l'invito.
- `private_game_move`: registra una mossa.
- `private_game_restart`: riavvia una partita conclusa.
- `private_game_link_create`: crea un link di invito.
- `private_game_link_join`: entra in una partita tramite link.

## Sicurezza

- Le password non vengono salvate in chiaro: `User.passwordHash` usa bcrypt.
- I token di sessione non vengono salvati in chiaro: il database conserva `Session.tokenHash`, un HMAC SHA-256 basato su `SESSION_TOKEN_PEPPER`.
- I contenuti applicativi, come messaggi, profili, server, canali e metadati allegati, restano leggibili nel database.
- Gli avatar sono in `backend/uploads/`; i nuovi allegati delle chat sono in `backend/private_uploads/`.

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
- Tris privato con inviti diretti agli amici o link.
- Pannello admin.
- Socket.IO separato in moduli per leggibilita e manutenzione.
