export const state = {
  token: localStorage.getItem('unichat:token'),
  pendingInviteCode: new URLSearchParams(window.location.search).get('invite') || localStorage.getItem('unichat:pendingInviteCode'),
  pendingGameId: new URLSearchParams(window.location.search).get('game'),
  user: null,
  servers: [],
  availableServers: [],
  activeServerId: null,
  activeChannelId: null,
  activePrivateUserId: null,
  activeConversationType: 'channel',
  friends: [],
  friendPresence: {},
  friendRequests: [],
  friendsExpanded: true,
  friendSearchResults: [],
  serverJoinRequests: [],
  blockedUsers: [],
  activeOverviewPanel: 'friendSearch',
  game: null,
  selectedGameType: 'TICTACTOE',
  userDock: {
    muted: false,
    deafened: false
  },
  socket: null,
  voice: {
    channelId: null,
    localStream: null,
    peers: new Map(),
    participants: [],
    recognition: null,
    shouldTranscribe: false,
    transcriptInterim: '',
    transcripts: []
  },
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
