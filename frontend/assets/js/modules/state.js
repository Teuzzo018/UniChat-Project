// 1. Oggetto di stato reattivo globale del client UniChat
export const state = {
  // 1.1 Acquisizione token: lettura del token di sessione salvato in precedenza nel localStorage
  token: localStorage.getItem('unichat:token'),
  // 1.2 Codice invito in sospeso (da query string URL '?invite=' oppure memorizzato nel localStorage)
  pendingInviteCode: new URLSearchParams(window.location.search).get('invite') || localStorage.getItem('unichat:pendingInviteCode'),
  // 1.3 Identificativo partita minigioco in sospeso (da query string URL '?game=')
  pendingGameId: new URLSearchParams(window.location.search).get('game'),
  // 1.4 Dati del profilo dell'utente autenticato (popolati da /auth/me o login)
  user: null,
  // 1.5 Server universitari di cui l'utente fa parte
  servers: [],
  // 1.6 Server universitari pubblici disponibili per la scoperta
  availableServers: [],
  // 1.7 Identificativi attivi di navigazione corrente
  activeServerId: null,
  activeChannelId: null,
  activePrivateUserId: null,
  activeConversationType: 'channel', // 'channel' oppure 'private'
  // 1.8 Gestione relazioni sociali: amici, conversazioni dirette e preferiti
  friends: [],
  privateConversations: [],
  friendPresence: {},
  favorites: [],
  friendRequests: [],
  friendsExpanded: true,
  friendSearchResults: [],
  serverJoinRequests: [],
  blockedUsers: [],
  activeOverviewPanel: 'directMessages',
  // 1.9 Minigiochi in tempo reale (tris / impiccato)
  game: null,
  selectedGameType: 'TICTACTOE',
  // 1.10 Controlli dock audio dell'utente (muto / sordo)
  userDock: {
    muted: false,
    deafened: false
  },
  // 1.11 Connessione Socket.IO attiva
  socket: null,
  // 1.12 Stato della stanza vocale di gruppo LiveKit
  voice: {
    channelId: null,
    room: null
  },
  // 1.13 Stato della videochiamata privata 1-to-1 WebRTC
  call: {
    id: null,
    peer: null,
    friend: null,
    localStream: null,
    pendingIceCandidates: [],
    incoming: false,
    active: false,
    mode: 'video',
    cameraEnabled: true
  }
};

