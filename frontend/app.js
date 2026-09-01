/**
 * Kiki's Spotify Mixer - Client Application
 */

const state = {
  // Main Panel (Active Queue)
  tracks: [],
  selectedIds: new Set(),
  lastSelectedId: null,
  lastClickedIndex: 0,
  searchQuery: '',
  activeView: 'liked_songs',
  
  userCustomOrderIds: [],
  sortState: { column: 'order_index', direction: 'asc', isTemporary: false },
  isOrderLocked: false,
  isTrueShuffleActive: false,
  undoStack: [],
  
  // Right Panel (Dual Browser & Discovery)
  rightTab: 'search', // 'search', 'playlist', or 'discovery'
  searchModifier: 'all', // 'all', 'track', 'artist', 'album'
  rightTracks: [],
  rightSelectedIds: new Set(),
  rightLastSelectedId: null,
  rightLastClickedIndex: 0,
  allPlaylists: [],
  
  // "🎲 Surprise Me!" Discovery Matrix State
  discovery: {
    artists: [], // [{ value: 'Daft Punk', id: '...', modifier: 'AND' }]
    genres: [],  // [{ value: 'indie', modifier: 'AND' }]
    decades: [], // [{ value: '90s', modifier: 'AND' }]
    tracks: [],  // [{ value: 'Get Lucky', id: '...', modifier: 'AND' }]
    keywords: [],
    useActiveVibe: false,
    notLikedSongs: true,
    notInPlaylists: true,
    notRecentlyPlayedDays: 30,
    notLive: true,
    notRemix: true,
    lowPopularityOnly: false,
    hiddenGemTarget: 'artist',
    targetCount: 30,
    trueShuffle: true,
    avoidConsecutiveArtists: true,
    artistMod: 'AND',
    genreMod: 'AND',
    trackMod: 'AND',
    selectedGenreCategory: 'Popular',
    discoveredTracks: [],
    isGenerating: false
  },
  
  // Player state
  playerState: null,
  currentPlayingTrackId: null,
  currentPlayingTrackTitle: null,
  autoScrollLocked: true,
  isMac: false,
  authenticated: false,
  isSyncing: false,
  hasSyncedTracks: false,
  currentLang: localStorage.getItem('kiki_spotify_lang') || 'es'
};

const DOM = {
  langToggleGroup: document.getElementById('lang-toggle-group'),
  langBtnEn: document.getElementById('lang-btn-en'),
  langBtnEs: document.getElementById('lang-btn-es'),
  searchInput: document.getElementById('search-input'),
  clearSearchBtn: document.getElementById('clear-search-btn'),
  topSyncBtn: document.getElementById('top-sync-btn'),
  sidebarSyncBtn: document.getElementById('sidebar-sync-btn'),
  loginBtn: document.getElementById('login-btn'),
  modal1ClickLoginBtn: document.getElementById('modal-1click-login-btn'),
  settingsBtn: document.getElementById('settings-btn'),
  connectionBadge: document.getElementById('connection-status-badge'),
  statusText: document.getElementById('status-text'),
  
  // Sidebar & Resizers
  sidebar: document.getElementById('sidebar'),
  sidebarResizer: document.getElementById('sidebar-resizer'),
  mainContent: document.getElementById('main-content'),
  rightPanelResizer: document.getElementById('right-panel-resizer'),
  rightPanel: document.getElementById('right-panel'),
  
  navItems: document.querySelectorAll('.nav-item'),
  playlistsList: document.getElementById('playlists-list'),
  remoteUrlDisplay: document.getElementById('remote-url-display'),
  
  // Main Table & Toolbar
  tracksTbody: document.getElementById('tracks-tbody'),
  tracksTable: document.getElementById('tracks-table'),
  selectAllCheckbox: document.getElementById('select-all-checkbox'),
  trackCountBadge: document.getElementById('track-count-badge'),
  playActiveListBtn: document.getElementById('play-active-list-btn'),
  shuffleActiveListBtn: document.getElementById('shuffle-active-list-btn'),
  saveAsPlaylistBtn: document.getElementById('save-as-playlist-btn'),
  resetOrderBtn: document.getElementById('reset-order-btn'),
  saveOrderBtn: document.getElementById('save-order-btn'),
  lockOrderBtn: document.getElementById('lock-order-btn'),
  reloadViewBtn: document.getElementById('reload-view-btn'),
  clearQueueBtn: document.getElementById('clear-queue-btn'),
  emptyState: document.getElementById('empty-state'),
  connectWelcomeHero: document.getElementById('connect-welcome-hero'),
  heroLoginBtn: document.getElementById('hero-login-btn'),
  syncLoadingHero: document.getElementById('sync-loading-hero'),
  syncStatusTitle: document.getElementById('sync-status-title'),
  syncStatusDesc: document.getElementById('sync-status-desc'),
  syncProgressFill: document.getElementById('sync-progress-fill'),
  syncStageBadge: document.getElementById('sync-stage-badge'),
  syncStageText: document.getElementById('sync-stage-text'),
  logoutBtn: document.getElementById('logout-btn'),
  tableContainer: document.getElementById('table-container'),
  
  // Floating Batch Action Bar
  selectionActionBar: document.getElementById('selection-action-bar'),
  selectedCountText: document.getElementById('selected-count-text'),
  batchCreatePlaylistBtn: document.getElementById('batch-create-playlist-btn'),
  batchShuffleBtn: document.getElementById('batch-shuffle-btn'),
  clearSelectionBtn: document.getElementById('clear-selection-btn'),
  
  // Right Panel: Dual Source Browser & Spotify Search & Surprise Me
  tabRightSearch: document.getElementById('tab-right-search'),
  tabRightPlaylist: document.getElementById('tab-right-playlist'),
  tabRightDiscovery: document.getElementById('tab-right-discovery'),
  rightSearchControls: document.getElementById('right-search-controls'),
  rightPlaylistControls: document.getElementById('right-playlist-controls'),
  rightDiscoveryControls: document.getElementById('right-discovery-controls'),
  rightSearchInput: document.getElementById('right-search-input'),
  rightSearchSubmitBtn: document.getElementById('right-search-submit-btn'),
  searchModPills: document.querySelectorAll('.search-mod-pill'),
  rightPlaylistPicker: document.getElementById('right-playlist-picker'),
  rightStandardActionHeader: document.getElementById('right-standard-action-header'),
  rightSelectedText: document.getElementById('right-selected-text'),
  rightAddSelectedBtn: document.getElementById('right-add-selected-btn'),
  rightItemsContainer: document.getElementById('right-items-container'),
  
  // Discovery Studio DOM
  discoveryPanelHeading: document.getElementById('discovery-panel-heading'),
  discoveryHelpBtn: document.getElementById('discovery-help-btn'),
  discArtistModBtn: document.getElementById('disc-artist-mod-btn'),
  discoveryArtistInput: document.getElementById('discovery-artist-input'),
  discoveryArtistSuggestions: document.getElementById('discovery-artist-suggestions'),
  discoveryAddArtistBtn: document.getElementById('discovery-add-artist-btn'),
  discoveryArtistChips: document.getElementById('discovery-artist-chips'),
  
  discGenreModBtn: document.getElementById('disc-genre-mod-btn'),
  discoveryGenreInput: document.getElementById('discovery-genre-input'),
  discoveryGenreSuggestions: document.getElementById('discovery-genre-suggestions'),
  discoveryAddGenreBtn: document.getElementById('discovery-add-genre-btn'),
  discoveryGenrePills: document.getElementById('discovery-genre-pills'),
  genreCatPills: document.querySelectorAll('.genre-cat-pill'),
  discoveryGenreChips: document.getElementById('discovery-genre-chips'),
  
  discoveryDecadePills: document.getElementById('discovery-decade-pills'),
  
  discTrackModBtn: document.getElementById('disc-track-mod-btn'),
  discoveryTrackInput: document.getElementById('discovery-track-input'),
  discoveryTrackSuggestions: document.getElementById('discovery-track-suggestions'),
  discoveryTrackChips: document.getElementById('discovery-track-chips'),
  discoveryActiveVibeBtn: document.getElementById('discovery-active-vibe-btn'),
  
  discNotLiked: document.getElementById('disc-not-liked'),
  discNotPlaylists: document.getElementById('disc-not-playlists'),
  discRecentDaysRadios: document.querySelectorAll('input[name="disc-recent-days"]'),
  discNotLive: document.getElementById('disc-not-live'),
  discNotRemix: document.getElementById('disc-not-remix'),
  discLowPopularity: document.getElementById('disc-low-popularity'),
  discLowPopLabel: document.getElementById('disc-low-pop-label'),
  hiddenGemTargetWrap: document.getElementById('hidden-gem-target-wrap'),
  discHiddenGemTargetRadios: document.querySelectorAll('input[name="disc-hidden-gem-target"]'),
  
  discTargetCountRadios: document.querySelectorAll('input[name="disc-target-count"]'),
  discTrueShuffle: document.getElementById('disc-true-shuffle'),
  discoveryGenerateBtn: document.getElementById('discovery-generate-btn'),
  
  discoveryResultsSection: document.getElementById('discovery-results-section'),
  discoveryItemsContainer: document.getElementById('discovery-items-container'),
  discoveryResultCountBadge: document.getElementById('discovery-result-count-badge'),
  discPlayDirectBtn: document.getElementById('disc-play-direct-btn'),
  discSelectAllBtn: document.getElementById('disc-select-all-btn'),
  discReplaceQueueBtn: document.getElementById('disc-replace-queue-btn'),
  discReplacePlayBtn: document.getElementById('disc-replace-play-btn'),
  discAppendQueueBtn: document.getElementById('disc-append-queue-btn'),
  discAppendSelectedBtn: document.getElementById('disc-append-selected-btn'),
  
  // Bottom Player Bar
  playerTitle: document.getElementById('player-title'),
  playerArtist: document.getElementById('player-artist'),
  ctrlPrev: document.getElementById('ctrl-prev'),
  ctrlPlaypause: document.getElementById('ctrl-playpause'),
  ctrlNext: document.getElementById('ctrl-next'),
  ctrlTrueShuffle: document.getElementById('ctrl-true-shuffle'),
  progressBarWrap: document.getElementById('progress-bar-wrap'),
  progressBarFill: document.getElementById('progress-bar-fill'),
  volumeSlider: document.getElementById('volume-slider'),
  deviceSelect: document.getElementById('device-select'),
  
  // Modals
  createPlaylistModal: document.getElementById('create-playlist-modal'),
  closeCreatePlaylistModal: document.getElementById('close-create-playlist-modal'),
  cancelCreatePlaylistModal: document.getElementById('cancel-create-playlist-modal'),
  confirmCreatePlaylistModal: document.getElementById('confirm-create-playlist-modal'),
  newPlaylistName: document.getElementById('new-playlist-name'),
  newPlaylistDesc: document.getElementById('new-playlist-desc'),
  createPlaylistCountHint: document.getElementById('create-playlist-count-hint'),
  
  settingsModal: document.getElementById('settings-modal'),
  closeSettingsModal: document.getElementById('close-settings-modal'),
  closeSettingsBtnBottom: document.getElementById('close-settings-btn-bottom'),
  saveCredentialsBtn: document.getElementById('save-credentials-btn'),
  settingsClientId: document.getElementById('settings-client-id'),
  settingsClientSecret: document.getElementById('settings-client-secret'),
  
  // Confirmation / Rename Dialog Modal
  confirmModal: document.getElementById('confirm-modal'),
  closeConfirmModal: document.getElementById('close-confirm-modal'),
  confirmModalTitle: document.getElementById('confirm-modal-title'),
  confirmModalMessage: document.getElementById('confirm-modal-message'),
  confirmModalInputGroup: document.getElementById('confirm-modal-input-group'),
  confirmModalInputLabel: document.getElementById('confirm-modal-input-label'),
  confirmModalInput: document.getElementById('confirm-modal-input'),
  confirmModalCancelBtn: document.getElementById('confirm-modal-cancel-btn'),
  confirmModalSubmitBtn: document.getElementById('confirm-modal-submit-btn'),
  
  // Context Menus
  customContextMenu: document.getElementById('custom-context-menu'),
  playlistContextMenu: document.getElementById('playlist-context-menu'),
  toastContainer: document.getElementById('toast-container')
};

let activeContextMenuPlaylist = null;
let confirmModalCallback = null;

// --- Internationalization (i18n) System: English & Spanish ---
const I18N = {
  en: {
    appSubBadge: 'Queue & Mix Studio',
    filterPlaceholder: 'Filter active list... (Keyboard shortcut: /)',
    clearFilter: 'Clear Filter',
    loginBtn: 'Log in with Spotify',
    loginNeeded: 'Login Needed',
    syncBtn: 'Sync Library',
    syncingBtn: 'Syncing...',
    syncHeroTitle: 'Syncing your Spotify Library...',
    syncHeroDesc: 'Connecting to Spotify and downloading your Liked Songs and playlists. Please wait a moment...',
    syncStageFetchingLiked: 'Fetching Liked Songs from Spotify...',
    syncStageSavingLiked: 'Saving Liked Songs to library...',
    syncStageFetchingPlaylists: 'Fetching your Spotify playlists...',
    syncStageDone: '✅ Library synced successfully!',
    connectHeroTitle: "Welcome to Kiki's Spotify Mixer",
    connectHeroDesc: 'Connect your Spotify account with 1 click to load your liked songs, browse your playlists, and use True Shuffle.',
    connectHeroBtn: '🟢 1-Click Connect with Spotify',
    connectPromptPlaylists: 'Connect Spotify to load your playlists.',
    settingsBtn: 'Settings & Setup',
    checking: 'Checking...',
    connected: 'Connected',
    offline: 'Offline',
    
    // Sidebar
    libraryTitle: 'LIBRARY',
    likedSongs: 'Liked Songs',
    allTracks: 'All Tracks',
    yourPlaylists: 'YOUR PLAYLISTS',
    androidAccess: '📱 Android Phone Access',
    androidCardDesc: 'Open this URL on your phone browser on the same Wi-Fi to control playback remotely.',
    
    // Main Toolbar & Table
    activeQueue: 'Active Listening Queue',
    queueInfoBadge: 'ℹ️ Info',
    queueSubtextDefault: 'These are the songs you will hear when you hit play.',
    queueSubtextWithCount: 'These {count} tracks will play in order when you click Play.',
    playListBtn: '▶ Play List',
    trueShuffleBtn: '🔀 True Shuffle',
    saveAsPlaylistBtn: '💾 Save as Playlist',
    unlockedBtn: '🔓 Unlocked',
    lockedBtn: '🔒 Locked',
    resetOrderBtn: '🔄 Reset to User Order',
    saveOrderBtn: '💾 Save as User Order',
    
    // Floating Bar
    selectedCount: '🟢 {count} track{s} selected',
    makePlaylistBtn: '➕ Make Spotify Playlist',
    shuffleSelectedBtn: '🔀 Shuffle Selected',
    clearEsc: 'Clear (Esc)',
    
    // Headers
    colNumber: '#',
    colTitle: 'Title',
    colArtist: 'Artist',
    colAlbum: 'Album',
    colDuration: '⏱️',
    
    // Right Panel
    tabSpotifySearch: '🔍 Spotify Search',
    tabBrowseList: '📑 Browse Playlists',
    tabDiscovery: '🎲 Surprise Me!',
    searchCatalogPlaceholder: 'Search Spotify catalog...',
    searchBtn: 'Search',
    modAll: 'All',
    modSong: '🎵 Song',
    modArtist: '🎤 Artist',
    modLyrics: '📜 Lyrics',
    selectPlaylistOption: 'Select Playlist to Browse...',
    addSelectedBtn: '➕ Add to Main List',
    rightSearchPlaceholder: 'Type above to search Spotify or choose a playlist to browse songs.',
    
    // Player
    notPlaying: 'Not Playing',
    openSpotifyPrompt: 'Open Spotify on Mac or Android',
    selectDevicePrompt: '📱 Select Device',
    
    // Context Menu
    ctxPlayFromHere: '▶ Play from Here',
    ctxTrueShuffleSelected: '🔀 True Shuffle Selected',
    ctxMakePlaylist: '➕ Make Spotify Playlist...',
    ctxRemoveFromList: '🗑️ Remove Selected from List',
    ctxKeepOnlySelected: '🎯 Keep Only Selected (Remove Others)',
    toastRemovedFromList: '🗑️ Removed {count} track{s} from active list (Cmd+Z to undo)',
    toastKeptOnlySelected: '🎯 Kept {kept} track{s}, removed {removed} other{s} (Cmd+Z to undo)',
    ctxRenamePlaylist: '✏️ Rename Playlist',
    ctxDeletePlaylist: '🗑️ Delete Playlist',
    
    // Tooltips
    tipSearchInputTitle: 'Filter Tracklist',
    tipSearchInput: "Press the '/' key anytime to immediately search and filter visible tracks without clicking.",
    tipClearFilterTitle: 'Clear Filter',
    tipClearFilter: 'Reset search filter and show all tracks.',
    tipLoginTitle: 'Spotify Login',
    tipLogin: 'Connect your Spotify account to load playlists and control playback.',
    tipSyncTitle: 'Sync Library',
    tipSync: 'Fetch latest liked songs, playlists, and track metadata from Spotify.',
    tipSettingsTitle: 'Settings & Setup',
    tipSettings: 'Spotify account settings, developer credentials, and anti-clumping options.',
    tipConnectionTitle: 'Spotify Connection',
    tipConnection: 'Displays connection state to Spotify Web API and local desktop app.',
    tipLikedSongsTitle: 'Liked Songs',
    tipLikedSongs: 'All songs saved to your Spotify Liked Songs library.',
    tipAllTracksTitle: 'All Tracks',
    tipAllTracks: 'Consolidated master list of all synced songs across your library.',
    tipResizeSidebarTitle: 'Resize Sidebar',
    tipResizeSidebar: 'Click and drag horizontally to resize sidebar width.',
    tipPlayListTitle: 'Play Active List',
    tipPlayList: 'Starts continuous playback from the first track in this active list.',
    tipShuffleTitle: 'Real Random Shuffle',
    tipShuffle: 'This is a real random shuffle. It generates a completely new random order every time you activate it.',
    reloadViewBtn: '🔄 Reload',
    tipReloadTitle: 'Reload Original List',
    tipReload: 'Reload the clean, complete list from your library/playlist, resetting temporary workspace changes.',
    clearQueueBtn: '🗑️ Clear',
    tipClearQueueTitle: 'Clear Workspace',
    tipClearQueue: 'Empties the active workspace list without deleting songs from your library. Undoable with Cmd+Z.',
    discPlayDirectBtn: '▶ Play Mix',
    tipDiscPlayDirectTitle: 'Play Discovery Mix',
    tipDiscPlayDirect: 'Plays all discovered tracks directly in Spotify without modifying your main workspace queue.',
    tipLockOrderTitle: 'Order Lock',
    tipLockOrder: 'Toggle locking to prevent accidental drag reordering or shuffling.',
    tipResetOrderTitle: 'Reset Sequence',
    tipResetOrder: 'Revert temporary column header sorting back to your saved custom order.',
    tipSaveOrderTitle: 'Save Sequence',
    tipSaveOrder: 'Save the current column-sorted list as your permanent custom order.',
    tipSaveAsPlaylistTitle: 'Save as Playlist',
    tipSaveAsPlaylistActive: 'Save this unique list of {count} songs as a new Spotify playlist.',
    tipSaveAsPlaylistExistsTitle: 'Playlist Already Exists',
    tipSaveAsPlaylistExists: 'This exact list and song order matches "{name}".',
    tipSaveAsPlaylistEmpty: 'The active list has no songs to save.',
    tipQueueInfoTitle: 'Active Listening Queue',
    tipQueueInfo: 'When you click ▶ Play List or press Space, Spotify plays these songs in the order they are shown below.',
    tipSelectAllTitle: 'Select All',
    tipSelectAll: 'Toggle selection of all visible tracks in the list.',
    tipSortNumTitle: 'Sort by Number',
    tipSortNum: 'Sort tracks by custom sequence order.',
    tipSortTitleTitle: 'Sort by Title',
    tipSortTitle: 'Sort tracks alphabetically by song title.',
    tipSortArtistTitle: 'Sort by Artist',
    tipSortArtist: 'Sort tracks alphabetically by primary artist name.',
    tipSortAlbumTitle: 'Sort by Album',
    tipSortAlbum: 'Sort tracks alphabetically by album name.',
    tipSortDurationTitle: 'Sort by Duration',
    tipSortDuration: 'Sort tracks from shortest to longest duration.',
    tipCreatePlaylistTitle: 'Create Spotify Playlist',
    tipCreatePlaylist: 'Export all currently selected tracks to a brand new Spotify playlist.',
    tipShuffleSelectedTitle: 'Shuffle Selection',
    tipShuffleSelected: 'This is a real random shuffle. It randomizes the selected songs every time you activate it.',
    tipDeselectAllTitle: 'Deselect All',
    tipDeselectAll: 'Clear track selection.',
    tipResizeRightTitle: 'Resize Right Panel',
    tipResizeRight: 'Click and drag horizontally to resize right panel width.',
    tipSearchTabTitle: 'Spotify Search',
    tipSearchTab: "Search and preview millions of tracks from Spotify's global catalog.",
    tipBrowseTabTitle: 'Browse Playlists',
    tipBrowseTab: 'Browse tracks from your other Spotify playlists to drag into your queue.',
    tipSearchCatalogTitle: 'Search Catalog',
    tipSearchCatalog: 'Enter song titles, artist names, or lyrics to search Spotify.',
    tipRunSearchTitle: 'Run Search',
    tipRunSearch: 'Query Spotify for matching tracks.',
    tipModAllTitle: 'All Fields',
    tipModAll: 'Search across track titles, artists, and albums simultaneously.',
    tipModSongTitle: 'Song Titles Only',
    tipModSong: 'Filter query results strictly by song title.',
    tipModArtistTitle: 'Artists Only',
    tipModArtist: 'Filter query results strictly by artist name.',
    tipModLyricsTitle: 'Lyric Search',
    tipModLyrics: 'Search Spotify catalog by lyrics and spoken phrases.',
    tipSelectPlaylistTitle: 'Select Playlist',
    tipSelectPlaylist: 'Choose one of your Spotify playlists to view and drag tracks from.',
    tipAddSelectedTitle: 'Add to Main List',
    tipAddSelected: 'Append selected songs from the right panel directly into your active list.',
    tipNowPlayingTitle: 'Now Playing',
    tipNowPlaying: 'Shows the currently playing track and artist on Spotify.',
    tipPrevTitle: 'Previous Track',
    tipPrev: 'Play the previous song in queue.',
    tipPlayPauseTitle: 'Play / Pause',
    tipPlayPause: 'Toggle playback on Spotify.',
    tipNextTitle: 'Next Track',
    tipNext: 'Skip to the next song in queue.',
    tipVolumeTitle: 'Volume',
    tipVolume: 'Adjust Spotify streaming volume level.',
    tipDeviceTitle: 'Playback Device',
    tipDevice: 'Select active Spotify Connect output device (Mac, Phone, Speaker).',
    
    // Discovery Engine
    discoveryPanelHeading: 'Discovery Engine',
    discoveryHelpTitle: 'Discovery Engine Guide',
    discoveryHelp: 'Combine artists, genres, decades and tracks with [+ AND] (include) and [- NOT] (exclude) modifiers. Strict filters guarantee you will not hear songs already in your Liked Songs or Playlists.',
    artistModLabel: '🎤 Artists (AND / NOT):',
    artistPlaceholder: 'Type artist name (e.g. Daft Punk)...',
    genreModLabel: '🎸 Genres (AND / NOT):',
    genrePlaceholder: 'Search genres (e.g. indie, synth-pop)...',
    genreCatHint: '📂 Category Tabs (switches genre pills below):',
    decadeModLabel: '📅 Decades (AND / NOT):',
    songSeedModLabel: '🎵 Song Seed & Queue Vibe:',
    songSeedPlaceholder: 'Type song title (e.g. Get Lucky)...',
    blendQueueVibeBtn: '🔮 Blend Active Queue Vibe',
    strictExclusionsTitle: '🚫 STRICT EXCLUSION FILTERS',
    notLikedSongsLabel: 'NOT in Liked Songs (Genuinely New)',
    notInPlaylistsLabel: 'NOT in Any of My Playlists',
    notRecentlyPlayedLabel: 'NOT Recently Played:',
    notRecentlyPlayedTitle: '🕒 NOT Recently Played:',
    notRecentOff: 'Off',
    notRecent7d: 'Past 7 Days',
    notRecent30d: 'Past 30 Days',
    notLiveLabel: 'NOT Live',
    notRemixLabel: 'NOT Remix',
    lowPopularityLabel: '💎 Low Popularity Only (Hidden Gems)',
    targetTracksLabel: 'Target Tracks:',
    trueShuffleAntiClumpLabel: '🔀 True Shuffle + Anti-Clumping',
    generateDiscoveryBtn: 'Generate Discovery Mix',
    generatingDiscoveryBtn: 'Generating Mix...',
    replaceMainQueueBtn: '🔄 Replace Main Queue',
    replacePlayBtn: '▶ Replace & Play Now',
    appendMainQueueBtn: '➕ Append to Main Queue',
    appendSelectedBtn: '➕ Append Selected',
    discoveredCountBadge: '{count} discovered',
    discoveryToastSuccess: '🎲 Generated {count} fresh discovery tracks!',
    discoveryToastReplaced: '🔄 Replaced active listening queue with {count} discovery tracks',
    discoveryToastAppended: '➕ Added {count} discovery tracks to the bottom of the active queue',
    tipDiscoveryTabTitle: 'Surprise Me!',
    tipDiscoveryTab: 'Generate a smart discovery mix with multi-criteria AND/NOT seeds, strict negative exclusion filters, and true shuffle.',
    tipArtistModTitle: 'Artist Modifier',
    tipArtistMod: 'Toggle between [+ AND] (include artists) and [- NOT] (exclude artists).',
    tipGenreModTitle: 'Genre Modifier',
    tipGenreMod: 'Toggle between [+ AND] (include genre) and [- NOT] (exclude genre).',
    tipTrackModTitle: 'Song Seed Modifier',
    tipTrackMod: 'Toggle between [+ AND] (similar to song) and [- NOT] (dissimilar).',
    tipTriStateGenreTitle: '3-State Genre Pills',
    tipTriStateGenre: 'Click once for [+ AND] (Include), click again for [- NOT] (Exclude), click third time for Off.',
    tipTriStateDecadeTitle: '3-State Decade Pills',
    tipTriStateDecade: 'Click once for [+ AND] (Include), click again for [- NOT] (Exclude), click third time for Off.',
    tipActiveVibeTitle: 'Active Queue Vibe',
    tipActiveVibe: 'Analyzes the top artists and genres from your currently loaded main listening queue and blends them into this discovery mix.',
    tipNotLikedTitle: 'NOT in Liked Songs',
    tipNotLiked: 'Guarantees 100% brand new music by excluding every song in your Liked Songs library.',
    tipNotInPlaylistsTitle: 'NOT in Any Playlist',
    tipNotInPlaylists: 'Excludes any song that is already saved in any of your Spotify playlists.',
    tipNotRecentTitle: 'NOT Recently Played',
    tipNotRecent: 'Excludes songs played within the last 7 or 30 days.',
    tipNotLiveTitle: 'NOT Live',
    tipNotLive: 'Filters out concert recordings, live albums, and en vivo tracks.',
    tipNotRemixTitle: 'NOT Remix',
    tipNotRemix: 'Filters out club edits, remixes, VIP mixes, and dub edits.',
    tipReplaceQueueTitle: 'Replace Main Queue',
    tipReplaceQueue: 'Clears all songs currently in your active listening queue and loads all newly discovered tracks.',
    tipReplacePlayTitle: 'Replace & Play Immediately',
    tipReplacePlay: 'Clears current main queue, loads discovered tracks, and starts playback instantly with True Shuffle.',
    tipAppendQueueTitle: 'Append to Main Queue',
    tipAppendQueue: 'Adds all discovered tracks to the bottom of the main queue without removing existing songs.',
    tipAppendSelectedTitle: 'Append Selected Tracks',
    tipAppendSelected: 'Adds only the checked tracks to the bottom of the main queue.'
  },
  es: {
    appSubBadge: 'Estudio de Mezcla y Cola',
    filterPlaceholder: 'Filtrar lista activa... (Atajo de teclado: /)',
    clearFilter: 'Borrar filtro',
    loginBtn: 'Iniciar sesión con Spotify',
    loginNeeded: 'Iniciar sesión',
    syncBtn: 'Sincronizar biblioteca',
    syncingBtn: 'Sincronizando...',
    syncHeroTitle: 'Sincronizando tu biblioteca de Spotify...',
    syncHeroDesc: 'Conectando a Spotify y descargando tus canciones guardadas y playlists. Por favor espera un momento...',
    syncStageFetchingLiked: 'Obteniendo canciones guardadas de Spotify...',
    syncStageSavingLiked: 'Guardando canciones en la biblioteca local...',
    syncStageFetchingPlaylists: 'Obteniendo tus playlists de Spotify...',
    syncStageDone: '✅ ¡Biblioteca sincronizada con éxito!',
    connectHeroTitle: "Bienvenido a Kiki's Spotify Mixer",
    connectHeroDesc: 'Conecta tu cuenta de Spotify con 1 clic para cargar tus canciones guardadas, explorar tus playlists y usar Aleatorio Real.',
    connectHeroBtn: '🟢 Conectar con Spotify en 1 clic',
    connectPromptPlaylists: 'Conecta Spotify para cargar tus playlists.',
    settingsBtn: 'Configuración',
    checking: 'Comprobando...',
    connected: 'Conectado',
    offline: 'Desconectado',
    
    // Sidebar
    libraryTitle: 'BIBLIOTECA',
    likedSongs: 'Canciones que te gustan',
    allTracks: 'Todas las canciones',
    yourPlaylists: 'TUS PLAYLISTS',
    androidAccess: '📱 Acceso desde Android',
    androidCardDesc: 'Abre esta URL en el navegador de tu teléfono en la misma red Wi-Fi para control remoto.',
    
    // Main Toolbar & Table
    activeQueue: 'Cola de reproducción activa',
    queueInfoBadge: 'ℹ️ Info',
    queueSubtextDefault: 'Estas son las canciones que escucharás al darle a Reproducir.',
    queueSubtextWithCount: 'Estas {count} canciones se reproducirán en orden al hacer clic en Reproducir.',
    playListBtn: '▶ Reproducir lista',
    trueShuffleBtn: '🔀 Aleatorio Real',
    saveAsPlaylistBtn: '💾 Guardar como lista',
    unlockedBtn: '🔓 Desbloqueado',
    lockedBtn: '🔒 Bloqueado',
    resetOrderBtn: '🔄 Restaurar orden',
    saveOrderBtn: '💾 Guardar orden',
    
    // Floating Bar
    selectedCount: '🟢 {count} canción{es} seleccionada{s}',
    makePlaylistBtn: '➕ Crear playlist en Spotify',
    shuffleSelectedBtn: '🔀 Mezclar selección',
    clearEsc: 'Deseleccionar (Esc)',
    
    // Headers
    colNumber: '#',
    colTitle: 'Título',
    colArtist: 'Artista',
    colAlbum: 'Álbum',
    colDuration: '⏱️',
    
    // Right Panel
    tabSpotifySearch: '🔍 Buscar',
    tabBrowseList: '📑 Playlists',
    tabDiscovery: '🎲 ¡Sorpréndeme!',
    searchCatalogPlaceholder: 'Buscar en el catálogo de Spotify...',
    searchBtn: 'Buscar',
    modAll: 'Todos',
    modSong: '🎵 Canción',
    modArtist: '🎤 Artista',
    modLyrics: '📜 Letras',
    selectPlaylistOption: 'Selecciona una playlist para explorar...',
    addSelectedBtn: '➕ Añadir a lista principal',
    rightSearchPlaceholder: 'Escribe arriba para buscar en Spotify o elige una playlist para explorar.',
    
    // Player
    notPlaying: 'Sin reproducción activa',
    openSpotifyPrompt: 'Abre Spotify en tu Mac o teléfono Android',
    selectDevicePrompt: '📱 Seleccionar dispositivo',
    
    // Context Menu
    ctxPlayFromHere: '▶ Reproducir desde aquí',
    ctxTrueShuffleSelected: '🔀 Aleatorio Real de seleccionadas',
    ctxMakePlaylist: '➕ Crear playlist en Spotify...',
    ctxRemoveFromList: '🗑️ Quitar seleccionadas de la lista',
    ctxKeepOnlySelected: '🎯 Mantener solo seleccionadas (Quitar las demás)',
    toastRemovedFromList: '🗑️ Se quitaron {count} canción{s} de la lista activa (Cmd+Z para deshacer)',
    toastKeptOnlySelected: '🎯 Se mantuvieron {kept} canción{es}, se quitaron {removed} restante{s} (Cmd+Z para deshacer)',
    ctxRenamePlaylist: '✏️ Renombrar playlist',
    ctxDeletePlaylist: '🗑️ Eliminar playlist',
    
    // Tooltips
    tipSearchInputTitle: 'Filtrar lista',
    tipSearchInput: "Pulsa la tecla '/' en cualquier momento para buscar y filtrar canciones sin necesidad del ratón.",
    tipClearFilterTitle: 'Borrar filtro',
    tipClearFilter: 'Restablecer filtro y mostrar todas las canciones.',
    tipLoginTitle: 'Iniciar sesión',
    tipLogin: 'Conecta tu cuenta de Spotify para cargar tus playlists y controlar la música.',
    tipSyncTitle: 'Sincronizar biblioteca',
    tipSync: 'Obtener las últimas canciones guardadas, playlists y metadatos de Spotify.',
    tipSettingsTitle: 'Configuración',
    tipSettings: 'Ajustes de cuenta, claves de desarrollador y opciones de reproducción.',
    tipConnectionTitle: 'Conexión con Spotify',
    tipConnection: 'Muestra el estado de conexión con la API de Spotify y la app de escritorio.',
    tipLikedSongsTitle: 'Canciones que te gustan',
    tipLikedSongs: 'Todas las canciones guardadas en tu biblioteca de Canciones que te gustan.',
    tipAllTracksTitle: 'Todas las canciones',
    tipAllTracks: 'Lista maestra consolidada de todas las canciones sincronizadas.',
    tipResizeSidebarTitle: 'Redimensionar barra lateral',
    tipResizeSidebar: 'Haz clic y arrastra horizontalmente para cambiar el ancho de la barra lateral.',
    tipPlayListTitle: 'Reproducir lista activa',
    tipPlayList: 'Inicia la reproducción continua desde la primera canción de esta lista activa.',
    tipShuffleTitle: 'Aleatorio real',
    tipShuffle: 'Este es un modo aleatorio real. Genera un orden aleatorio totalmente nuevo cada vez que lo activas.',
    reloadViewBtn: '🔄 Recargar',
    tipReloadTitle: 'Recargar Lista Original',
    tipReload: 'Recarga la lista limpia y completa desde tu biblioteca o playlist, descartando cambios temporales.',
    clearQueueBtn: '🗑️ Limpiar',
    tipClearQueueTitle: 'Limpiar Espacio de Trabajo',
    tipClearQueue: 'Vacía la lista activa de trabajo sin borrar canciones de tu biblioteca. Puedes deshacer con Cmd+Z.',
    discPlayDirectBtn: '▶ Reproducir Mix',
    tipDiscPlayDirectTitle: 'Reproducir Mix Descubierto',
    tipDiscPlayDirect: 'Reproduce todas las canciones descubiertas directamente en Spotify sin modificar tu lista activa.',
    tipLockOrderTitle: 'Bloqueo de orden',
    tipLockOrder: 'Bloquea o desbloquea el arrastre para evitar reordenamientos accidentales.',
    tipResetOrderTitle: 'Restaurar orden',
    tipResetOrder: 'Vuelve al orden personalizado guardado deshaciendo la ordenación por columnas.',
    tipSaveOrderTitle: 'Guardar orden',
    tipSaveOrder: 'Guarda el orden actual de columnas como tu orden personalizado definitivo.',
    tipSaveAsPlaylistTitle: 'Guardar como lista',
    tipSaveAsPlaylistActive: 'Guarda esta lista única de {count} canciones como una nueva playlist en Spotify.',
    tipSaveAsPlaylistExistsTitle: 'La playlist ya existe',
    tipSaveAsPlaylistExists: 'Esta lista y orden exacto coincide con "{name}".',
    tipSaveAsPlaylistEmpty: 'La lista activa no tiene canciones para guardar.',
    tipQueueInfoTitle: 'Cola de reproducción activa',
    tipQueueInfo: 'Al hacer clic en ▶ Reproducir lista o pulsar Espacio, Spotify reproduce estas canciones en el orden que se muestra abajo.',
    tipSelectAllTitle: 'Seleccionar todo',
    tipSelectAll: 'Selecciona o deselecciona todas las canciones visibles de la lista.',
    tipSortNumTitle: 'Ordenar por número',
    tipSortNum: 'Ordena las canciones según la secuencia personalizada.',
    tipSortTitleTitle: 'Ordenar por título',
    tipSortTitle: 'Ordena las canciones alfabéticamente por título.',
    tipSortArtistTitle: 'Ordenar por artista',
    tipSortArtist: 'Ordena las canciones alfabéticamente por nombre del artista principal.',
    tipSortAlbumTitle: 'Ordenar por álbum',
    tipSortAlbum: 'Ordena las canciones alfabéticamente por nombre de álbum.',
    tipSortDurationTitle: 'Ordenar por duración',
    tipSortDuration: 'Ordena las canciones de menor a mayor duración.',
    tipCreatePlaylistTitle: 'Crear playlist en Spotify',
    tipCreatePlaylist: 'Exporta todas las canciones seleccionadas a una nueva playlist en tu cuenta de Spotify.',
    tipShuffleSelectedTitle: 'Mezclar selección',
    tipShuffleSelected: 'Este es un modo aleatorio real. Mezcla las canciones seleccionadas cada vez que lo activas.',
    tipDeselectAllTitle: 'Deseleccionar todo',
    tipDeselectAll: 'Borra la selección de canciones.',
    tipResizeRightTitle: 'Redimensionar panel derecho',
    tipResizeRight: 'Haz clic y arrastra horizontalmente para cambiar el ancho del panel derecho.',
    tipSearchTabTitle: 'Buscar en Spotify',
    tipSearchTab: 'Busca y previsualiza millones de canciones en el catálogo mundial de Spotify.',
    tipBrowseTabTitle: 'Explorar playlists',
    tipBrowseTab: 'Explora canciones de tus otras playlists para arrastrarlas a tu cola de reproducción.',
    tipSearchCatalogTitle: 'Buscar en el catálogo',
    tipSearchCatalog: 'Escribe títulos de canciones, artistas o letras para buscar en Spotify.',
    tipRunSearchTitle: 'Ejecutar búsqueda',
    tipRunSearch: 'Consulta a Spotify por canciones coincidentes.',
    tipModAllTitle: 'Todos los campos',
    tipModAll: 'Busca simultáneamente en títulos de canciones, artistas y álbumes.',
    tipModSongTitle: 'Solo títulos de canción',
    tipModSong: 'Filtra los resultados estrictamente por el título de la canción.',
    tipModArtistTitle: 'Solo artistas',
    tipModArtist: 'Filtra los resultados estrictamente por el nombre del artista.',
    tipModLyricsTitle: 'Búsqueda por letra',
    tipModLyrics: 'Busca canciones en el catálogo de Spotify por fragmentos de su letra.',
    tipSelectPlaylistTitle: 'Seleccionar playlist',
    tipSelectPlaylist: 'Elige una de tus playlists de Spotify para ver y arrastrar canciones.',
    tipAddSelectedTitle: 'Añadir a lista principal',
    tipAddSelected: 'Agrega las canciones seleccionadas del panel derecho directamente a tu lista activa.',
    tipNowPlayingTitle: 'En reproducción',
    tipNowPlaying: 'Muestra la canción y el artista que se están reproduciendo actualmente en Spotify.',
    tipPrevTitle: 'Canción anterior',
    tipPrev: 'Reproduce la canción anterior en la cola.',
    tipPlayPauseTitle: 'Reproducir / Pausar',
    tipPlayPause: 'Alterna la reproducción en Spotify.',
    tipNextTitle: 'Siguiente canción',
    tipNext: 'Salta a la siguiente canción en la cola.',
    tipVolumeTitle: 'Volumen',
    tipVolume: 'Ajusta el nivel de volumen de Spotify.',
    tipDeviceTitle: 'Dispositivo de reproducción',
    tipDevice: 'Selecciona el dispositivo activo de Spotify Connect (Mac, Teléfono, Altavoz).',
    
    // Discovery Engine
    discoveryPanelHeading: 'Motor de Descubrimiento',
    discoveryHelpTitle: 'Guía del Motor de Descubrimiento',
    discoveryHelp: 'Combina artistas, géneros, décadas y temas con modificadores [+ Y] (incluir) y [- NO] (excluir). Los filtros estrictos garantizan que no escucharás canciones que ya tengas guardadas en tus Likes o Playlists.',
    artistModLabel: '🎤 Artistas (Y / NO):',
    artistPlaceholder: 'Escribe nombre del artista (ej. Daft Punk)...',
    genreModLabel: '🎸 Géneros (Y / NO):',
    genrePlaceholder: 'Buscar géneros (ej. indie, synth-pop)...',
    genreCatHint: '📂 Pestañas de categoría (cambia las opciones abajo):',
    decadeModLabel: '📅 Décadas (Y / NO):',
    songSeedModLabel: '🎵 Canción Semilla y Vibe:',
    songSeedPlaceholder: 'Escribe título de canción (ej. Get Lucky)...',
    blendQueueVibeBtn: '🔮 Combinar Vibe de la Cola Activa',
    strictExclusionsTitle: '🚫 FILTROS DE EXCLUSIÓN ESTRICTOS',
    notLikedSongsLabel: 'NO en Canciones que te gustan (100% Nuevo)',
    notInPlaylistsLabel: 'NO en Ninguna de mis Playlists',
    notRecentlyPlayedLabel: 'NO reproducidas recientemente:',
    notRecentlyPlayedTitle: '🕒 NO reproducidas recientemente:',
    notRecentOff: 'Desactivado',
    notRecent7d: 'Últimos 7 días',
    notRecent30d: 'Últimos 30 días',
    notLiveLabel: 'NO En Vivo',
    notRemixLabel: 'NO Remix',
    lowPopularityLabel: '💎 Solo baja popularidad (Joyas ocultas)',
    targetTracksLabel: 'Canciones Objetivo:',
    trueShuffleAntiClumpLabel: '🔀 Aleatorio Real + Anti-Repetición',
    generateDiscoveryBtn: 'Generar Mezcla de Descubrimiento',
    generatingDiscoveryBtn: 'Generando Mezcla...',
    replaceMainQueueBtn: '🔄 Reemplazar Cola Principal',
    replacePlayBtn: '▶ Reemplazar y Reproducir Ya',
    appendMainQueueBtn: '➕ Agregar a la Cola Principal',
    appendSelectedBtn: '➕ Agregar Seleccionadas',
    discoveredCountBadge: '{count} descubiertas',
    discoveryToastSuccess: '🎲 ¡Se generaron {count} canciones nuevas!',
    discoveryToastReplaced: '🔄 Se reemplazó la cola activa con {count} canciones de descubrimiento',
    discoveryToastAppended: '➕ Se agregaron {count} canciones de descubrimiento al final de la cola',
    tipDiscoveryTabTitle: '¡Sorpréndeme!',
    tipDiscoveryTab: 'Genera una mezcla inteligente de descubrimiento con semillas AND/NOT, filtros estrictos de exclusión y aleatorio real.',
    tipArtistModTitle: 'Modificador de Artista',
    tipArtistMod: 'Alterna entre [+ Y] (incluir artistas) y [- NO] (excluir artistas).',
    tipGenreModTitle: 'Modificador de Género',
    tipGenreMod: 'Alterna entre [+ Y] (incluir género) y [- NO] (excluir género).',
    tipTrackModTitle: 'Modificador de Canción Semilla',
    tipTrackMod: 'Alterna entre [+ Y] (similar a la canción) y [- NO] (disimilar).',
    tipTriStateGenreTitle: 'Botones de Género de 3 Estados',
    tipTriStateGenre: 'Haz clic una vez para [+ Y] (Incluir), otra vez para [- NO] (Excluir), y una tercera para Apagar.',
    tipTriStateDecadeTitle: 'Botones de Década de 3 Estados',
    tipTriStateDecade: 'Haz clic una vez para [+ Y] (Incluir), otra vez para [- NO] (Excluir), y una tercera para Apagar.',
    tipActiveVibeTitle: 'Vibe de la Cola Activa',
    tipActiveVibe: 'Analiza los principales artistas y géneros de tu cola de escucha activa y los combina en esta mezcla de descubrimiento.',
    tipNotLikedTitle: 'NO en Canciones que te gustan',
    tipNotLiked: 'Garantiza música 100% nueva excluyendo todas las canciones guardadas en tu biblioteca.',
    tipNotInPlaylistsTitle: 'NO en Ninguna Playlist',
    tipNotInPlaylists: 'Excluye cualquier canción que ya esté guardada en cualquiera de tus playlists de Spotify.',
    tipNotRecentTitle: 'NO Reproducidas Recientemente',
    tipNotRecent: 'Excluye canciones reproducidas en los últimos 7 o 30 días.',
    tipNotLiveTitle: 'NO En Vivo',
    tipNotLive: 'Filtra grabaciones de conciertos, álbumes en directo y versiones en vivo.',
    tipNotRemixTitle: 'NO Remix',
    tipNotRemix: 'Filtra ediciones de club, remixes, mezclas VIP y dub edits.',
    tipReplaceQueueTitle: 'Reemplazar Cola Principal',
    tipReplaceQueue: 'Borra todas las canciones de tu cola activa y carga todas las canciones recién descubiertas.',
    tipReplacePlayTitle: 'Reemplazar y Reproducir Inmediatamente',
    tipReplacePlay: 'Borra la cola principal, carga las canciones descubiertas e inicia la reproducción al instante con Aleatorio Real.',
    tipAppendQueueTitle: 'Agregar a la Cola Principal',
    tipAppendQueue: 'Agrega todas las canciones descubiertas al final de la cola principal sin borrar las existentes.',
    tipAppendSelectedTitle: 'Agregar Canciones Seleccionadas',
    tipAppendSelected: 'Agrega únicamente las canciones marcadas al final de la cola principal.'
  }
};

function t(key, params = {}) {
  const dict = I18N[state.currentLang] || I18N.es;
  let val = dict[key] || I18N.en[key] || key;
  Object.keys(params).forEach(p => {
    val = val.replace(new RegExp(`\\{${p}\\}`, 'g'), params[p]);
  });
  return val;
}

function applyLanguage(lang) {
  state.currentLang = lang;
  localStorage.setItem('kiki_spotify_lang', lang);

  // Update language toggle button visual states
  if (DOM.langBtnEn) DOM.langBtnEn.classList.toggle('active', lang === 'en');
  if (DOM.langBtnEs) DOM.langBtnEs.classList.toggle('active', lang === 'es');

  // Subtitle badge
  const subBadge = document.querySelector('.app-sub-badge');
  if (subBadge) subBadge.textContent = t('appSubBadge');

  // Search input
  if (DOM.searchInput) {
    DOM.searchInput.placeholder = t('filterPlaceholder');
    DOM.searchInput.setAttribute('data-tooltip-title', t('tipSearchInputTitle'));
    DOM.searchInput.setAttribute('data-tooltip', t('tipSearchInput'));
  }
  if (DOM.clearSearchBtn) {
    DOM.clearSearchBtn.setAttribute('data-tooltip-title', t('tipClearFilterTitle'));
    DOM.clearSearchBtn.setAttribute('data-tooltip', t('tipClearFilter'));
  }

  // Header buttons
  if (DOM.topSyncBtn) {
    const txt = DOM.topSyncBtn.querySelector('.btn-text');
    if (txt) txt.textContent = t('syncBtn');
    DOM.topSyncBtn.setAttribute('data-tooltip-title', t('tipSyncTitle'));
    DOM.topSyncBtn.setAttribute('data-tooltip', t('tipSync'));
  }
  if (DOM.sidebarSyncBtn) {
    DOM.sidebarSyncBtn.textContent = '🔄 ' + (state.currentLang === 'es' ? 'Sincronizar' : 'Sync');
    DOM.sidebarSyncBtn.setAttribute('data-tooltip-title', t('tipSyncTitle'));
    DOM.sidebarSyncBtn.setAttribute('data-tooltip', t('tipSync'));
  }

  const loginText = DOM.loginBtn?.querySelector('.btn-text');
  if (loginText) loginText.textContent = t('loginBtn');
  DOM.loginBtn?.setAttribute('data-tooltip-title', t('tipLoginTitle'));
  DOM.loginBtn?.setAttribute('data-tooltip', t('tipLogin'));

  DOM.settingsBtn?.setAttribute('data-tooltip-title', t('tipSettingsTitle'));
  DOM.settingsBtn?.setAttribute('data-tooltip', t('tipSettings'));

  DOM.connectionBadge?.setAttribute('data-tooltip-title', t('tipConnectionTitle'));
  DOM.connectionBadge?.setAttribute('data-tooltip', t('tipConnection'));

  // Sidebar Sections
  const sidebarTitles = document.querySelectorAll('#sidebar .section-title');
  if (sidebarTitles[0]) sidebarTitles[0].textContent = t('libraryTitle');
  if (sidebarTitles[1]) sidebarTitles[1].textContent = t('yourPlaylists');

  // Sidebar Nav Items
  const navLiked = document.querySelector('.nav-item[data-view="liked_songs"]');
  if (navLiked) {
    const lbl = navLiked.querySelector('.nav-label');
    if (lbl) lbl.textContent = t('likedSongs');
    navLiked.setAttribute('data-tooltip-title', t('tipLikedSongsTitle'));
    navLiked.setAttribute('data-tooltip', t('tipLikedSongs'));
  }
  const navAll = document.querySelector('.nav-item[data-view="all"]');
  if (navAll) {
    const lbl = navAll.querySelector('.nav-label');
    if (lbl) lbl.textContent = t('allTracks');
    navAll.setAttribute('data-tooltip-title', t('tipAllTracksTitle'));
    navAll.setAttribute('data-tooltip', t('tipAllTracks'));
  }

  const remoteHeader = document.querySelector('.remote-header');
  if (remoteHeader) remoteHeader.textContent = t('androidAccess');
  const remoteCard = document.querySelector('.remote-info-card');
  if (remoteCard) {
    remoteCard.setAttribute('data-tooltip-title', t('androidAccess'));
    remoteCard.setAttribute('data-tooltip', t('androidCardDesc'));
  }

  // Sidebar resizer
  if (DOM.sidebarResizer) {
    DOM.sidebarResizer.setAttribute('data-tooltip-title', t('tipResizeSidebarTitle'));
    DOM.sidebarResizer.setAttribute('data-tooltip', t('tipResizeSidebar'));
  }

  // Toolbar & Queue
  const queueHelpBadge = document.querySelector('.queue-help-badge');
  if (queueHelpBadge) {
    queueHelpBadge.textContent = t('queueInfoBadge');
    queueHelpBadge.setAttribute('data-tooltip-title', t('tipQueueInfoTitle'));
    queueHelpBadge.setAttribute('data-tooltip', t('tipQueueInfo'));
  }

  if (DOM.playActiveListBtn) {
    DOM.playActiveListBtn.textContent = t('playListBtn');
    DOM.playActiveListBtn.setAttribute('data-tooltip-title', t('tipPlayListTitle'));
    DOM.playActiveListBtn.setAttribute('data-tooltip', t('tipPlayList'));
  }
  if (DOM.shuffleActiveListBtn) {
    DOM.shuffleActiveListBtn.textContent = t('trueShuffleBtn');
    DOM.shuffleActiveListBtn.setAttribute('data-tooltip-title', t('tipShuffleTitle'));
    DOM.shuffleActiveListBtn.setAttribute('data-tooltip', t('tipShuffle'));
  }
  if (DOM.reloadViewBtn) {
    DOM.reloadViewBtn.textContent = t('reloadViewBtn');
    DOM.reloadViewBtn.setAttribute('data-tooltip-title', t('tipReloadTitle'));
    DOM.reloadViewBtn.setAttribute('data-tooltip', t('tipReload'));
  }
  if (DOM.clearQueueBtn) {
    DOM.clearQueueBtn.textContent = t('clearQueueBtn');
    DOM.clearQueueBtn.setAttribute('data-tooltip-title', t('tipClearQueueTitle'));
    DOM.clearQueueBtn.setAttribute('data-tooltip', t('tipClearQueue'));
  }
  if (DOM.discPlayDirectBtn) {
    DOM.discPlayDirectBtn.textContent = t('discPlayDirectBtn');
    DOM.discPlayDirectBtn.setAttribute('data-tooltip-title', t('tipDiscPlayDirectTitle'));
    DOM.discPlayDirectBtn.setAttribute('data-tooltip', t('tipDiscPlayDirect'));
  }
  if (DOM.saveAsPlaylistBtn) {
    DOM.saveAsPlaylistBtn.textContent = t('saveAsPlaylistBtn');
  }
  if (DOM.lockOrderBtn) {
    DOM.lockOrderBtn.textContent = state.isOrderLocked ? t('lockedBtn') : t('unlockedBtn');
    DOM.lockOrderBtn.setAttribute('data-tooltip-title', t('tipLockOrderTitle'));
    DOM.lockOrderBtn.setAttribute('data-tooltip', t('tipLockOrder'));
  }
  if (DOM.resetOrderBtn) {
    DOM.resetOrderBtn.textContent = t('resetOrderBtn');
    DOM.resetOrderBtn.setAttribute('data-tooltip-title', t('tipResetOrderTitle'));
    DOM.resetOrderBtn.setAttribute('data-tooltip', t('tipResetOrder'));
  }
  if (DOM.saveOrderBtn) {
    DOM.saveOrderBtn.textContent = t('saveOrderBtn');
    DOM.saveOrderBtn.setAttribute('data-tooltip-title', t('tipSaveOrderTitle'));
    DOM.saveOrderBtn.setAttribute('data-tooltip', t('tipSaveOrder'));
  }

  // Table Column Headers
  const thNum = document.querySelector('th[data-sort="order_index"]');
  if (thNum) {
    thNum.setAttribute('data-tooltip-title', t('tipSortNumTitle'));
    thNum.setAttribute('data-tooltip', t('tipSortNum'));
  }
  const thTitle = document.querySelector('th[data-sort="title"]');
  if (thTitle) {
    thTitle.textContent = t('colTitle');
    thTitle.setAttribute('data-tooltip-title', t('tipSortTitleTitle'));
    thTitle.setAttribute('data-tooltip', t('tipSortTitle'));
  }
  const thArtist = document.querySelector('th[data-sort="artist"]');
  if (thArtist) {
    thArtist.textContent = t('colArtist');
    thArtist.setAttribute('data-tooltip-title', t('tipSortArtistTitle'));
    thArtist.setAttribute('data-tooltip', t('tipSortArtist'));
  }
  const thAlbum = document.querySelector('th[data-sort="album"]');
  if (thAlbum) {
    thAlbum.textContent = t('colAlbum');
    thAlbum.setAttribute('data-tooltip-title', t('tipSortAlbumTitle'));
    thAlbum.setAttribute('data-tooltip', t('tipSortAlbum'));
  }
  const thDur = document.querySelector('th[data-sort="duration_ms"]');
  if (thDur) {
    thDur.setAttribute('data-tooltip-title', t('tipSortDurationTitle'));
    thDur.setAttribute('data-tooltip', t('tipSortDuration'));
  }

  // Floating Batch Action Bar
  if (DOM.batchCreatePlaylistBtn) {
    DOM.batchCreatePlaylistBtn.textContent = t('makePlaylistBtn');
    DOM.batchCreatePlaylistBtn.setAttribute('data-tooltip-title', t('tipCreatePlaylistTitle'));
    DOM.batchCreatePlaylistBtn.setAttribute('data-tooltip', t('tipCreatePlaylist'));
  }
  if (DOM.batchShuffleBtn) {
    DOM.batchShuffleBtn.textContent = t('shuffleSelectedBtn');
    DOM.batchShuffleBtn.setAttribute('data-tooltip-title', t('tipShuffleSelectedTitle'));
    DOM.batchShuffleBtn.setAttribute('data-tooltip', t('tipShuffleSelected'));
  }
  if (DOM.clearSelectionBtn) {
    DOM.clearSelectionBtn.textContent = t('clearEsc');
    DOM.clearSelectionBtn.setAttribute('data-tooltip-title', t('tipDeselectAllTitle'));
    DOM.clearSelectionBtn.setAttribute('data-tooltip', t('tipDeselectAll'));
  }

  // Right Panel
  if (DOM.tabRightSearch) {
    DOM.tabRightSearch.textContent = t('tabSpotifySearch');
    DOM.tabRightSearch.setAttribute('data-tooltip-title', t('tipSearchTabTitle'));
    DOM.tabRightSearch.setAttribute('data-tooltip', t('tipSearchTab'));
  }
  if (DOM.tabRightPlaylist) {
    DOM.tabRightPlaylist.textContent = t('tabBrowseList');
    DOM.tabRightPlaylist.setAttribute('data-tooltip-title', t('tipBrowseTabTitle'));
    DOM.tabRightPlaylist.setAttribute('data-tooltip', t('tipBrowseTab'));
  }
  if (DOM.rightSearchInput) {
    DOM.rightSearchInput.placeholder = t('searchCatalogPlaceholder');
    DOM.rightSearchInput.setAttribute('data-tooltip-title', t('tipSearchCatalogTitle'));
    DOM.rightSearchInput.setAttribute('data-tooltip', t('tipSearchCatalog'));
  }
  if (DOM.rightSearchSubmitBtn) {
    DOM.rightSearchSubmitBtn.textContent = t('searchBtn');
    DOM.rightSearchSubmitBtn.setAttribute('data-tooltip-title', t('tipRunSearchTitle'));
    DOM.rightSearchSubmitBtn.setAttribute('data-tooltip', t('tipRunSearch'));
  }
  const pillAll = document.querySelector('.search-mod-pill[data-mod="all"]');
  if (pillAll) {
    pillAll.textContent = t('modAll');
    pillAll.setAttribute('data-tooltip-title', t('tipModAllTitle'));
    pillAll.setAttribute('data-tooltip', t('tipModAll'));
  }
  const pillTrack = document.querySelector('.search-mod-pill[data-mod="track"]');
  if (pillTrack) {
    pillTrack.textContent = t('modSong');
    pillTrack.setAttribute('data-tooltip-title', t('tipModSongTitle'));
    pillTrack.setAttribute('data-tooltip', t('tipModSong'));
  }
  const pillArtist = document.querySelector('.search-mod-pill[data-mod="artist"]');
  if (pillArtist) {
    pillArtist.textContent = t('modArtist');
    pillArtist.setAttribute('data-tooltip-title', t('tipModArtistTitle'));
    pillArtist.setAttribute('data-tooltip', t('tipModArtist'));
  }
  const pillLyrics = document.querySelector('.search-mod-pill[data-mod="lyrics"]');
  if (pillLyrics) {
    pillLyrics.textContent = t('modLyrics');
    pillLyrics.setAttribute('data-tooltip-title', t('tipModLyricsTitle'));
    pillLyrics.setAttribute('data-tooltip', t('tipModLyrics'));
  }
  if (DOM.rightAddSelectedBtn) {
    DOM.rightAddSelectedBtn.textContent = t('addSelectedBtn');
    DOM.rightAddSelectedBtn.setAttribute('data-tooltip-title', t('tipAddSelectedTitle'));
    DOM.rightAddSelectedBtn.setAttribute('data-tooltip', t('tipAddSelected'));
  }

  // "🎲 Surprise Me!" Discovery Tab Translations
  if (DOM.tabRightDiscovery) {
    DOM.tabRightDiscovery.textContent = t('tabDiscovery');
    DOM.tabRightDiscovery.setAttribute('data-tooltip-title', t('tipDiscoveryTabTitle'));
    DOM.tabRightDiscovery.setAttribute('data-tooltip', t('tipDiscoveryTab'));
  }
  if (DOM.discoveryPanelHeading) {
    DOM.discoveryPanelHeading.textContent = t('discoveryPanelHeading');
  }
  if (DOM.discoveryHelpBtn) {
    DOM.discoveryHelpBtn.textContent = t('discoveryHelpBtn');
    DOM.discoveryHelpBtn.setAttribute('data-tooltip-title', t('discoveryHelpTitle'));
    DOM.discoveryHelpBtn.setAttribute('data-tooltip', t('discoveryHelp'));
  }

  const fieldLabels = document.querySelectorAll('.discovery-field-label');
  if (fieldLabels[0]) fieldLabels[0].textContent = t('artistModLabel');
  if (fieldLabels[1]) fieldLabels[1].textContent = t('genreModLabel');
  if (fieldLabels[2]) fieldLabels[2].textContent = t('decadeModLabel');
  if (fieldLabels[3]) fieldLabels[3].textContent = t('songSeedModLabel');

  if (DOM.discoveryArtistInput) DOM.discoveryArtistInput.placeholder = t('artistPlaceholder');
  if (DOM.discoveryGenreInput) DOM.discoveryGenreInput.placeholder = t('genrePlaceholder');
  if (DOM.discoveryTrackInput) DOM.discoveryTrackInput.placeholder = t('songSeedPlaceholder');
  const catHint = document.getElementById('genre-cat-hint-label');
  if (catHint) catHint.textContent = t('genreCatHint');

  if (DOM.discArtistModBtn) {
    DOM.discArtistModBtn.setAttribute('data-tooltip-title', t('tipArtistModTitle'));
    DOM.discArtistModBtn.setAttribute('data-tooltip', t('tipArtistMod'));
  }
  if (DOM.discGenreModBtn) {
    DOM.discGenreModBtn.setAttribute('data-tooltip-title', t('tipGenreModTitle'));
    DOM.discGenreModBtn.setAttribute('data-tooltip', t('tipGenreMod'));
  }
  if (DOM.discTrackModBtn) {
    DOM.discTrackModBtn.setAttribute('data-tooltip-title', t('tipTrackModTitle'));
    DOM.discTrackModBtn.setAttribute('data-tooltip', t('tipTrackMod'));
  }

  if (DOM.discoveryActiveVibeBtn) {
    DOM.discoveryActiveVibeBtn.textContent = state.discovery.useActiveVibe ? '🔮 Vibe Active' : t('blendQueueVibeBtn');
    DOM.discoveryActiveVibeBtn.setAttribute('data-tooltip-title', t('tipActiveVibeTitle'));
    DOM.discoveryActiveVibeBtn.setAttribute('data-tooltip', t('tipActiveVibe'));
  }

  const exclTitle = document.querySelector('.exclusions-card-title');
  if (exclTitle) exclTitle.textContent = t('strictExclusionsTitle');

  const notLikedLabel = DOM.discNotLiked?.parentElement?.querySelector('.switch-label');
  if (notLikedLabel) notLikedLabel.textContent = t('notLikedSongsLabel');
  DOM.discNotLiked?.parentElement?.setAttribute('data-tooltip-title', t('tipNotLikedTitle'));
  DOM.discNotLiked?.parentElement?.setAttribute('data-tooltip', t('tipNotLiked'));

  const notPlLabel = DOM.discNotPlaylists?.parentElement?.querySelector('.switch-label');
  if (notPlLabel) notPlLabel.textContent = t('notInPlaylistsLabel');
  DOM.discNotPlaylists?.parentElement?.setAttribute('data-tooltip-title', t('tipNotInPlaylistsTitle'));
  DOM.discNotPlaylists?.parentElement?.setAttribute('data-tooltip', t('tipNotInPlaylists'));

  const discRecentTitle = document.getElementById('disc-recent-title');
  if (discRecentTitle) discRecentTitle.textContent = t('notRecentlyPlayedTitle');
  const discRecentOff = document.getElementById('disc-recent-off-label');
  if (discRecentOff) discRecentOff.textContent = t('notRecentOff');
  const discRecent7d = document.getElementById('disc-recent-7d-label');
  if (discRecent7d) discRecent7d.textContent = t('notRecent7d');
  const discRecent30d = document.getElementById('disc-recent-30d-label');
  if (discRecent30d) discRecent30d.textContent = t('notRecent30d');
  document.querySelector('.discovery-sub-block')?.setAttribute('data-tooltip-title', t('tipNotRecentTitle'));
  document.querySelector('.discovery-sub-block')?.setAttribute('data-tooltip', t('tipNotRecent'));

  const notLiveLabel = DOM.discNotLive?.parentElement?.querySelector('.switch-label');
  if (notLiveLabel) notLiveLabel.textContent = t('notLiveLabel');
  DOM.discNotLive?.parentElement?.setAttribute('data-tooltip-title', t('tipNotLiveTitle'));
  DOM.discNotLive?.parentElement?.setAttribute('data-tooltip', t('tipNotLive'));

  const notRemixLabel = DOM.discNotRemix?.parentElement?.querySelector('.switch-label');
  if (notRemixLabel) notRemixLabel.textContent = t('notRemixLabel');
  DOM.discNotRemix?.parentElement?.setAttribute('data-tooltip-title', t('tipNotRemixTitle'));
  DOM.discNotRemix?.parentElement?.setAttribute('data-tooltip', t('tipNotRemix'));

  if (DOM.discLowPopLabel) DOM.discLowPopLabel.textContent = t('lowPopularityLabel');

  const queueSizeLbl = document.querySelector('.queue-size-label');
  if (queueSizeLbl) queueSizeLbl.textContent = t('targetTracksLabel');

  const shuffleLbl = DOM.discTrueShuffle?.parentElement?.querySelector('.switch-label');
  if (shuffleLbl) shuffleLbl.textContent = t('trueShuffleAntiClumpLabel');

  const genBtnText = DOM.discoveryGenerateBtn?.querySelector('.btn-text');
  if (genBtnText) genBtnText.textContent = state.discovery.isGenerating ? t('generatingDiscoveryBtn') : t('generateDiscoveryBtn');

  if (DOM.discReplaceQueueBtn) {
    DOM.discReplaceQueueBtn.textContent = t('replaceMainQueueBtn');
    DOM.discReplaceQueueBtn.setAttribute('data-tooltip-title', t('tipReplaceQueueTitle'));
    DOM.discReplaceQueueBtn.setAttribute('data-tooltip', t('tipReplaceQueue'));
  }
  if (DOM.discReplacePlayBtn) {
    DOM.discReplacePlayBtn.textContent = t('replacePlayBtn');
    DOM.discReplacePlayBtn.setAttribute('data-tooltip-title', t('tipReplacePlayTitle'));
    DOM.discReplacePlayBtn.setAttribute('data-tooltip', t('tipReplacePlay'));
  }
  if (DOM.discAppendQueueBtn) {
    DOM.discAppendQueueBtn.textContent = t('appendMainQueueBtn');
    DOM.discAppendQueueBtn.setAttribute('data-tooltip-title', t('tipAppendQueueTitle'));
    DOM.discAppendQueueBtn.setAttribute('data-tooltip', t('tipAppendQueue'));
  }
  if (DOM.discAppendSelectedBtn) {
    DOM.discAppendSelectedBtn.textContent = t('appendSelectedBtn');
    DOM.discAppendSelectedBtn.setAttribute('data-tooltip-title', t('tipAppendSelectedTitle'));
    DOM.discAppendSelectedBtn.setAttribute('data-tooltip', t('tipAppendSelected'));
  }

  // Player controls
  DOM.ctrlPrev?.setAttribute('data-tooltip-title', t('tipPrevTitle'));
  DOM.ctrlPrev?.setAttribute('data-tooltip', t('tipPrev'));
  DOM.ctrlPlaypause?.setAttribute('data-tooltip-title', t('tipPlayPauseTitle'));
  DOM.ctrlPlaypause?.setAttribute('data-tooltip', t('tipPlayPause'));
  DOM.ctrlNext?.setAttribute('data-tooltip-title', t('tipNextTitle'));
  DOM.ctrlNext?.setAttribute('data-tooltip', t('tipNext'));
  DOM.ctrlTrueShuffle?.setAttribute('data-tooltip-title', t('tipShuffleTitle'));
  DOM.ctrlTrueShuffle?.setAttribute('data-tooltip', t('tipShuffle'));
  if (DOM.ctrlTrueShuffle) DOM.ctrlTrueShuffle.textContent = t('trueShuffleBtn');

  // Context Menus
  const ctxPlay = document.getElementById('ctx-play-now');
  if (ctxPlay) ctxPlay.textContent = t('ctxPlayFromHere');
  const ctxShuffle = document.getElementById('ctx-true-shuffle');
  if (ctxShuffle) ctxShuffle.textContent = t('ctxTrueShuffleSelected');
  const ctxPl = document.getElementById('ctx-make-playlist');
  if (ctxPl) ctxPl.textContent = t('ctxMakePlaylist');
  const ctxRemFromList = document.getElementById('ctx-remove-from-list');
  if (ctxRemFromList) ctxRemFromList.textContent = t('ctxRemoveFromList');
  const ctxKeepOnly = document.getElementById('ctx-keep-only-selected');
  if (ctxKeepOnly) ctxKeepOnly.textContent = t('ctxKeepOnlySelected');

  const ctxPlRename = document.getElementById('ctx-playlist-rename');
  if (ctxPlRename) ctxPlRename.textContent = t('ctxRenamePlaylist');
  const ctxPlDelete = document.getElementById('ctx-playlist-delete');
  if (ctxPlDelete) ctxPlDelete.textContent = t('ctxDeletePlaylist');

  // Sync loading hero & connect welcome hero
  if (DOM.syncStatusTitle) DOM.syncStatusTitle.textContent = t('syncHeroTitle');
  if (DOM.syncStatusDesc) DOM.syncStatusDesc.textContent = t('syncHeroDesc');
  if (DOM.syncStageText && (!state.isSyncing || DOM.syncStageText.textContent.includes('Fetching') || DOM.syncStageText.textContent.includes('Obteniendo'))) {
    DOM.syncStageText.textContent = t('syncStageFetchingLiked');
  }
  const heroTitle = DOM.connectWelcomeHero?.querySelector('h2');
  if (heroTitle) heroTitle.textContent = t('connectHeroTitle');
  const heroDesc = DOM.connectWelcomeHero?.querySelector('p');
  if (heroDesc) heroDesc.textContent = t('connectHeroDesc');
  const heroBtn = DOM.heroLoginBtn;
  if (heroBtn) heroBtn.textContent = t('connectHeroBtn');

  // Dynamic UI re-render
  updateCounts(state.tracks.length);
  updateSelectionUI();
}

// --- Sync State & Auto-Sync Management ---
function showSyncState(stageText) {
  state.isSyncing = true;
  if (DOM.syncLoadingHero) {
    DOM.syncLoadingHero.classList.remove('hidden');
  }
  DOM.connectWelcomeHero?.classList.add('hidden');
  DOM.emptyState?.classList.add('hidden');
  DOM.tracksTable?.classList.add('hidden');
  if (DOM.syncStageText && stageText) {
    DOM.syncStageText.textContent = stageText;
  }
}

function hideSyncState() {
  state.isSyncing = false;
  DOM.syncLoadingHero?.classList.add('hidden');
  if (state.authenticated) {
    DOM.connectWelcomeHero?.classList.add('hidden');
    DOM.tracksTable?.classList.remove('hidden');
  } else {
    DOM.connectWelcomeHero?.classList.remove('hidden');
    DOM.tracksTable?.classList.add('hidden');
  }
}

let isSyncInProgress = false;
async function triggerAutoSync(silent = false) {
  if (isSyncInProgress) return;
  isSyncInProgress = true;

  if (!silent) {
    showSyncState(t('syncStageFetchingLiked'));
  } else {
    state.isSyncing = true;
  }

  let poller = setInterval(async () => {
    try {
      const syncStatus = await api('/api/sync/status');
      if (syncStatus && syncStatus.is_syncing && syncStatus.status_message) {
        if (DOM.syncStageText) {
          DOM.syncStageText.textContent = syncStatus.status_message;
        }
      }
    } catch (e) {}
  }, 700);

  try {
    const res = await api('/api/sync', { method: 'POST' });
    clearInterval(poller);

    if (res.warning) {
      showToast('⚠️ ' + res.warning, 'error');
    } else {
      const likedCount = res.liked_count || 0;
      const plCount = res.playlists_count || 0;
      const isEs = state.currentLang === 'es';
      const msg = isEs 
        ? `✅ ¡Sincronizadas ${likedCount} canciones y ${plCount} playlists!` 
        : `✅ Synced ${likedCount} Liked Songs and ${plCount} playlists!`;
      showToast(msg);
    }
    await checkStatus();
    await loadPlaylists();
    await loadTracks();
  } catch (e) {
    clearInterval(poller);
    showToast('Sync error: ' + e.message, 'error');
  } finally {
    isSyncInProgress = false;
    hideSyncState();
  }
}

// --- Background Auth Poller (for external browser login) ---
let authPollerTimer = null;
function startAuthPoller() {
  if (authPollerTimer) return;
  authPollerTimer = setInterval(async () => {
    if (state.authenticated || state.isSyncing) return;
    try {
      const data = await api('/api/status');
      if (data && data.authenticated) {
        stopAuthPoller();
        await checkStatus();
        await loadPlaylists();
        await loadTracks();
        triggerAutoSync();
      }
    } catch (e) {}
  }, 2500);
}

function stopAuthPoller() {
  if (authPollerTimer) {
    clearInterval(authPollerTimer);
    authPollerTimer = null;
  }
}

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
  try { applyLanguage(state.currentLang); } catch (e) { console.error('applyLanguage error:', e); }
  try { TooltipManager.init(); } catch (e) { console.error('TooltipManager error:', e); }
  try { initEventListeners(); } catch (e) { console.error('initEventListeners error:', e); }
  try { initRightPanel(); } catch (e) { console.error('initRightPanel error:', e); }
  try { initPanelResizers(); } catch (e) { console.error('initPanelResizers error:', e); }
  try { initWorkspaceContainerDrop(); } catch (e) { console.error('initWorkspaceContainerDrop error:', e); }

  const isAuthRedirect = window.location.search.includes('auth=success');
  if (isAuthRedirect) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  const statusData = await checkStatus();
  if (state.authenticated) {
    try { await loadPlaylists(); } catch (e) {}
    try { await loadTracks(); } catch (e) {}
    
    // If just authorized or library has 0 synced tracks, automatically trigger sync!
    if (isAuthRedirect || !statusData?.has_synced_tracks || (state.tracks.length === 0 && state.allPlaylists.length === 0)) {
      triggerAutoSync();
    }
  }
  try { startPlayerStatePoller(); } catch (e) {}
});

// --- API Helper ---
async function api(endpoint, options = {}) {
  try {
    const res = await fetch(endpoint, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(errData.detail || 'API request failed');
    }
    return await res.json();
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}

// --- Draggable Panel Resizers ---
function initPanelResizers() {
  if (DOM.sidebarResizer && DOM.sidebar) {
    let isDragging = false;
    DOM.sidebarResizer.addEventListener('mousedown', (e) => {
      isDragging = true;
      DOM.sidebarResizer.classList.add('resizing');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const newWidth = Math.max(140, Math.min(420, e.clientX));
      DOM.sidebar.style.width = `${newWidth}px`;
      DOM.sidebar.style.minWidth = `${newWidth}px`;
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        DOM.sidebarResizer.classList.remove('resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
  }

  if (DOM.rightPanelResizer && DOM.rightPanel) {
    let isDragging = false;
    DOM.rightPanelResizer.addEventListener('mousedown', (e) => {
      isDragging = true;
      DOM.rightPanelResizer.classList.add('resizing');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const newWidth = Math.max(220, Math.min(550, window.innerWidth - e.clientX));
      DOM.rightPanel.style.width = `${newWidth}px`;
      DOM.rightPanel.style.minWidth = `${newWidth}px`;
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        DOM.rightPanelResizer.classList.remove('resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
  }
}

// --- Check Status ---
async function checkStatus() {
  try {
    const data = await api('/api/status');
    state.authenticated = data.authenticated;
    state.isMac = data.is_mac;
    state.hasSyncedTracks = !!data.has_synced_tracks;
    
    if (DOM.remoteUrlDisplay) {
      DOM.remoteUrlDisplay.textContent = data.access_url;
    }
    
    if (data.authenticated) {
      DOM.connectionBadge.className = 'status-badge status-online';
      DOM.statusText.textContent = t('connected') || 'Spotify Online';
      DOM.loginBtn?.classList.add('hidden');
      DOM.connectWelcomeHero?.classList.add('hidden');
      if (!state.isSyncing) {
        DOM.tracksTable?.classList.remove('hidden');
      }
      if (data.total_tracks !== undefined) {
        const countAll = document.getElementById('count-all');
        if (countAll) countAll.textContent = data.total_tracks;
      }
      if (data.liked_tracks !== undefined) {
        const countLiked = document.getElementById('count-liked');
        if (countLiked) countLiked.textContent = data.liked_tracks;
      }
      loadDevices();
      stopAuthPoller();
    } else {
      DOM.connectionBadge.className = 'status-badge status-offline';
      DOM.statusText.textContent = t('loginNeeded') || 'Login Needed';
      DOM.loginBtn?.classList.remove('hidden');
      if (!state.isSyncing) {
        DOM.connectWelcomeHero?.classList.remove('hidden');
        DOM.tracksTable?.classList.add('hidden');
        DOM.emptyState?.classList.add('hidden');
      }
      DOM.tracksTbody.innerHTML = '';
      DOM.playlistsList.innerHTML = `<div style="padding:12px 16px; font-size:11px; color:#888;">${t('connectPromptPlaylists') || 'Connect Spotify to load your playlists.'}</div>`;
      startAuthPoller();
    }
    return data;
  } catch (e) {
    DOM.connectionBadge.className = 'status-badge status-offline';
    DOM.statusText.textContent = t('offline') || 'Offline';
    startAuthPoller();
    return null;
  }
}

async function loadDevices() {
  try {
    const data = await api('/api/player/devices');
    const select = DOM.deviceSelect;
    if (!select) return;
    select.innerHTML = '<option value="">📱 Select Device</option>';
    (data.devices || []).forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = `${d.is_active ? '🟢 ' : ''}${d.name} (${d.type})`;
      if (d.is_active) opt.selected = true;
      select.appendChild(opt);
    });
  } catch (e) {}
}

function openPlaylistContextMenu(x, y, playlist) {
  activeContextMenuPlaylist = playlist;
  hideAllContextMenus();
  const menu = DOM.playlistContextMenu;
  menu.style.left = `${Math.min(x, window.innerWidth - 190)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - 180)}px`;
  menu.classList.remove('hidden');
}

// --- Interactive Confirmation & Rename Modal ---
function showConfirmModal({ title, message, showInput = false, inputValue = '', inputLabel = 'Name:', confirmText = 'Confirm', onConfirm }) {
  DOM.confirmModalTitle.textContent = title;
  DOM.confirmModalMessage.textContent = message || '';
  
  if (showInput) {
    DOM.confirmModalInputGroup.classList.remove('hidden');
    DOM.confirmModalInputLabel.textContent = inputLabel;
    DOM.confirmModalInput.value = inputValue;
  } else {
    DOM.confirmModalInputGroup.classList.add('hidden');
  }

  DOM.confirmModalSubmitBtn.textContent = confirmText;
  confirmModalCallback = onConfirm;
  DOM.confirmModal.classList.remove('hidden');
  if (showInput) DOM.confirmModalInput.focus();
}

// --- Playlists Operations ---
async function loadPlaylists() {
  try {
    const data = await api('/api/playlists');
    state.allPlaylists = data.playlists || [];
    DOM.playlistsList.innerHTML = '';
    
    // Update Liked Songs count from the liked_songs playlist record
    const likedPl = state.allPlaylists.find(p => p.id === 'liked_songs');
    if (likedPl) {
      const countLiked = document.getElementById('count-liked');
      if (countLiked) {
        countLiked.textContent = likedPl.total_tracks || (likedPl.track_ids ? likedPl.track_ids.length : 0);
      }
    }

    if (DOM.rightPlaylistPicker) {
      DOM.rightPlaylistPicker.innerHTML = `<option value="">${t('selectPlaylistOption')}</option>`;
    }

    state.allPlaylists.forEach(p => {
      if (DOM.rightPlaylistPicker) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.name} (${p.total_tracks} ${state.currentLang === 'es' ? 'canciones' : 'songs'})`;
        DOM.rightPlaylistPicker.appendChild(opt);
      }

      if (p.id === 'liked_songs') return;

      const item = document.createElement('div');
      item.className = `nav-item ${state.activeView === p.id ? 'active' : ''}`;
      item.dataset.playlistId = p.id;
      item.innerHTML = `
        <span class="nav-icon">📑</span>
        <span class="nav-label">${escapeHtml(p.name)}</span>
        <span class="nav-count">${p.total_tracks}</span>
      `;

      item.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        state.activeView = p.id;
        loadTracks();
      });

      // Right-Click Context Menu for Playlists (Rename, Delete)
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openPlaylistContextMenu(e.clientX, e.clientY, p);
      });

      DOM.playlistsList.appendChild(item);
    });
    updateSaveAsPlaylistButtonState();
  } catch (e) {}
}

// --- Load Tracks for Current View (Main Center Panel) ---
async function loadTracks() {
  try {
    let url = '/api/tracks?';
    const params = new URLSearchParams();
    
    if (state.activeView === 'liked_songs') {
      params.append('playlist_id', 'liked_songs');
    } else if (state.activeView !== 'all') {
      params.append('playlist_id', state.activeView);
    }

    if (state.searchQuery.trim()) {
      params.append('search', state.searchQuery.trim());
    }

    params.append('sort_by', state.sortState.column);
    params.append('sort_direction', state.sortState.direction);

    const data = await api(`${url}${params.toString()}`);
    state.tracks = data.tracks || [];

    if (state.sortState.column === 'order_index' && !state.sortState.isTemporary) {
      state.userCustomOrderIds = state.tracks.map(t => t.id);
    }

    renderTracksTable();
    updateCounts(data.count);
  } catch (e) {
    showToast('Error loading tracks: ' + e.message, 'error');
  }
}

function updateCounts(count) {
  const isEs = state.currentLang === 'es';
  DOM.trackCountBadge.textContent = isEs 
    ? `${count} canción${count === 1 ? '' : 'es'} en la cola` 
    : `${count} track${count === 1 ? '' : 's'} in queue`;

  const headingEl = document.getElementById('active-queue-heading');
  const subtextEl = document.getElementById('queue-subtext-desc');

  if (headingEl) {
    let viewName = t('likedSongs');
    if (state.activeView === 'all') viewName = t('allTracks');
    else {
      const pl = state.allPlaylists.find(p => p.id === state.activeView);
      if (pl) viewName = pl.name;
    }

    const queuePrefix = isEs ? 'Cola activa' : 'Active Queue';
    headingEl.textContent = `${queuePrefix}: ${viewName}`;
  }

  if (subtextEl) {
    subtextEl.textContent = t('queueSubtextWithCount', { count });
  }

  const countLiked = document.getElementById('count-liked');
  const countAll = document.getElementById('count-all');
  if (countLiked && state.activeView === 'liked_songs' && !state.searchQuery) {
    countLiked.textContent = count;
  }
  if (countAll && state.activeView === 'all' && !state.searchQuery) {
    countAll.textContent = count;
  }
}

// --- Render Table: Check | Num | Title | Artist | Album | Dur ---
function renderTracksTable() {
  DOM.tracksTbody.innerHTML = '';
  
  if (state.tracks.length === 0) {
    if (state.authenticated && !state.isSyncing) {
      DOM.connectWelcomeHero?.classList.add('hidden');
      DOM.tracksTable?.classList.add('hidden');
      DOM.emptyState?.classList.remove('hidden');
    }
    updateSaveAsPlaylistButtonState();
    return;
  } else {
    DOM.emptyState?.classList.add('hidden');
    DOM.connectWelcomeHero?.classList.add('hidden');
    DOM.syncLoadingHero?.classList.add('hidden');
    DOM.tracksTable?.classList.remove('hidden');
  }

  const fragment = document.createDocumentFragment();

  state.tracks.forEach((track, index) => {
    const isSelected = state.selectedIds.has(track.id);
    
    // Match by ID, URI, or Title
    const isNowPlaying = (
      (state.currentPlayingTrackId && (track.id === state.currentPlayingTrackId || track.uri === state.currentPlayingTrackId)) ||
      (state.currentPlayingTrackTitle && track.title && track.title.toLowerCase().trim() === state.currentPlayingTrackTitle.toLowerCase().trim())
    );

    const tr = document.createElement('tr');
    tr.className = `track-row ${isSelected ? 'selected' : ''} ${isNowPlaying ? 'now-playing-row' : ''}`;
    tr.dataset.trackId = track.id;
    tr.dataset.trackUri = track.uri;
    tr.dataset.trackTitle = track.title;
    tr.dataset.index = index;
    tr.draggable = !state.isOrderLocked;

    // Col 1: Checkbox
    const tdCheck = document.createElement('td');
    tdCheck.className = 'col-check';
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = isSelected;
    chk.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTrackSelection(track.id, e.shiftKey, index);
    });
    tdCheck.appendChild(chk);
    tr.appendChild(tdCheck);

    // Col 2: Number / Playing Indicator / Play Button
    const tdNum = document.createElement('td');
    tdNum.className = 'col-num track-num-cell';
    const numDisplay = isNowPlaying ? '🔊' : (index + 1);
    tdNum.innerHTML = `
      <span class="track-num-text">${numDisplay}</span>
      <button class="row-play-btn" title="Play from this song">▶</button>
    `;
    tdNum.querySelector('.row-play-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      playFromIndex(index);
    });
    tr.appendChild(tdNum);

    // Col 3: Title + Small Album Art Icon
    const tdTitle = document.createElement('td');
    tdTitle.className = 'col-title';
    const titleGroup = document.createElement('div');
    titleGroup.className = 'track-title-cell';
    
    if (track.album_art_url) {
      const img = document.createElement('img');
      img.className = 'track-album-art';
      img.src = track.album_art_url;
      img.alt = '';
      img.loading = 'lazy';
      titleGroup.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'track-album-art-placeholder';
      placeholder.textContent = '🎵';
      titleGroup.appendChild(placeholder);
    }

    const textGrp = document.createElement('div');
    textGrp.className = 'track-text-group';
    textGrp.innerHTML = `<span class="track-title">${escapeHtml(track.title)}</span>`;
    titleGroup.appendChild(textGrp);
    tdTitle.appendChild(titleGroup);
    tr.appendChild(tdTitle);

    // Col 4: Artist
    const tdArtist = document.createElement('td');
    tdArtist.className = 'col-artist';
    tdArtist.innerHTML = `<span class="track-artist">${escapeHtml(track.artist)}</span>`;
    tr.appendChild(tdArtist);

    // Col 5: Album
    const tdAlbum = document.createElement('td');
    tdAlbum.className = 'col-album';
    tdAlbum.innerHTML = `<span class="track-album">${escapeHtml(track.album)}</span>`;
    tr.appendChild(tdAlbum);

    // Col 6: Duration
    const tdDur = document.createElement('td');
    tdDur.className = 'col-duration';
    tdDur.textContent = formatDuration(track.duration_ms);
    tr.appendChild(tdDur);

    // Prevent native text selection on Shift/Cmd/Ctrl click
    tr.addEventListener('mousedown', (e) => {
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        e.preventDefault();
      }
    });

    // Click Handlers (Cmd+Click, Shift+Click, normal click saves anchor)
    tr.addEventListener('click', (e) => {
      handleRowClick(e, track.id, index);
    });

    // Double click: Plays from this song
    tr.addEventListener('dblclick', () => {
      playFromIndex(index);
    });

    // Right-Click Context Menu for Track
    tr.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!state.selectedIds.has(track.id)) {
        state.selectedIds.clear();
        state.selectedIds.add(track.id);
        updateSelectionUI();
      }
      openContextMenu(e.clientX, e.clientY, index);
    });

    attachDragAndDropHandlers(tr, track.id, index);
    fragment.appendChild(tr);
  });

  DOM.tracksTbody.appendChild(fragment);
  updateSelectionUI();
  updateSaveAsPlaylistButtonState();
}

// --- Active List & Direct Track Playback ---
async function playTrackUris(uris, startingTitle = '') {
  if (!uris || uris.length === 0) return;
  try {
    await api('/api/player/play', {
      method: 'POST',
      body: JSON.stringify({
        uris: uris,
        true_shuffle: false,
        device_id: DOM.deviceSelect?.value || null
      })
    });
    if (startingTitle) {
      showToast(`▶ Playing "${startingTitle}" from Surprise Me`);
    } else {
      showToast(`▶ Playing ${uris.length} song${uris.length === 1 ? '' : 's'} directly`);
    }
    pollPlayerState();
  } catch (e) {
    showToast('Playback error: ' + e.message, 'error');
  }
}

async function playFromIndex(startIndex) {
  if (startIndex < 0 || startIndex >= state.tracks.length) return;
  const queueUris = state.tracks.slice(startIndex).map(t => t.uri);
  
  try {
    await api('/api/player/play', {
      method: 'POST',
      body: JSON.stringify({
        uris: queueUris,
        true_shuffle: false,
        device_id: DOM.deviceSelect?.value || null
      })
    });
    const startingTrack = state.tracks[startIndex];
    showToast(`▶ Playing "${startingTrack.title}" & queuing next songs`);
    pollPlayerState();
  } catch (e) {
    showToast('Playback error: ' + e.message, 'error');
  }
}

async function playNextInActiveList() {
  if (state.tracks.length === 0) return;
  let currIdx = -1;
  if (state.currentPlayingTrackTitle) {
    currIdx = state.tracks.findIndex(t => t.title.toLowerCase().trim() === state.currentPlayingTrackTitle.toLowerCase().trim());
  }
  const nextIdx = currIdx + 1;
  if (nextIdx < state.tracks.length) {
    playFromIndex(nextIdx);
  } else {
    playFromIndex(0);
  }
}

async function playPrevInActiveList() {
  if (state.tracks.length === 0) return;
  let currIdx = 0;
  if (state.currentPlayingTrackTitle) {
    currIdx = state.tracks.findIndex(t => t.title.toLowerCase().trim() === state.currentPlayingTrackTitle.toLowerCase().trim());
  }
  const prevIdx = Math.max(0, currIdx - 1);
  playFromIndex(prevIdx);
}

// --- True Mathematical Shuffle (Always generates a fresh random order!) ---
function toggleTrueShuffle() {
  if (state.isOrderLocked) {
    showToast('🔒 Active list order is locked. Unlock it to shuffle!', 'error');
    return;
  }

  state.isTrueShuffleActive = true;
  DOM.shuffleActiveListBtn?.classList.add('active');
  DOM.ctrlTrueShuffle?.classList.add('active');

  if (state.tracks.length === 0) {
    showToast('No tracks in active list to shuffle', 'error');
    return;
  }

  // Find currently playing track
  let currentIdx = -1;
  if (state.currentPlayingTrackTitle) {
    currentIdx = state.tracks.findIndex(t => t.title.toLowerCase().trim() === state.currentPlayingTrackTitle.toLowerCase().trim());
  }

  const tracksToShuffle = (currentIdx !== -1)
    ? state.tracks.filter((_, idx) => idx !== currentIdx)
    : [...state.tracks];

  // Mathematical Anti-Clumping Shuffle
  const shuffled = antiClumpShuffle(tracksToShuffle);

  if (currentIdx !== -1) {
    const currentTrack = state.tracks[currentIdx];
    state.tracks = [currentTrack, ...shuffled];
  } else {
    state.tracks = shuffled;
  }

  renderTracksTable();
  showToast('🔀 Shuffled! New random order generated (current song kept playing)');

  if (currentIdx === -1) {
    playFromIndex(0);
  }
}

function antiClumpShuffle(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  // Anti-consecutive artist smoothing
  for (let i = 0; i < result.length - 1; i++) {
    if (result[i].artist && result[i].artist === result[i + 1].artist) {
      for (let k = i + 2; k < result.length; k++) {
        if (result[k].artist !== result[i].artist) {
          [result[i + 1], result[k]] = [result[k], result[i + 1]];
          break;
        }
      }
    }
  }
  return result;
}

// --- Selection Engine (Main Panel) ---
function handleRowClick(e, trackId, index) {
  if (e.metaKey || e.ctrlKey || e.shiftKey) {
    window.getSelection()?.removeAllRanges();
  }
  if (e.metaKey || e.ctrlKey) {
    if (state.selectedIds.has(trackId)) {
      state.selectedIds.delete(trackId);
    } else {
      state.selectedIds.add(trackId);
    }
    state.lastSelectedId = trackId;
    state.lastClickedIndex = index;
    updateSelectionUI();
  } else if (e.shiftKey) {
    const start = Math.min(state.lastClickedIndex, index);
    const end = Math.max(state.lastClickedIndex, index);
    for (let i = start; i <= end; i++) {
      state.selectedIds.add(state.tracks[i].id);
    }
    state.lastSelectedId = trackId;
    updateSelectionUI();
  } else {
    // Normal click: select and highlight this row
    state.selectedIds.clear();
    state.selectedIds.add(trackId);
    state.lastClickedIndex = index;
    state.lastSelectedId = trackId;
    updateSelectionUI();
  }
}

function toggleTrackSelection(trackId, isShift, index) {
  if (state.selectedIds.has(trackId)) {
    state.selectedIds.delete(trackId);
  } else {
    state.selectedIds.add(trackId);
  }
  state.lastSelectedId = trackId;
  state.lastClickedIndex = index;
  updateSelectionUI();
}

function updateSelectionUI() {
  const rows = DOM.tracksTbody.querySelectorAll('.track-row');
  rows.forEach(row => {
    const id = row.dataset.trackId;
    const isSel = state.selectedIds.has(id);
    row.classList.toggle('selected', isSel);
    const chk = row.querySelector('.col-check input');
    if (chk) chk.checked = isSel;
  });

  const count = state.selectedIds.size;
  if (count > 0) {
    DOM.selectionActionBar.classList.remove('hidden');
    DOM.selectedCountText.textContent = t('selectedCount', { count, s: count === 1 ? '' : (state.currentLang === 'es' ? 'es' : 's') });
  } else {
    DOM.selectionActionBar.classList.add('hidden');
  }

  DOM.selectAllCheckbox.checked = count > 0 && count === state.tracks.length;
}

// --- Drag & Drop (Supports Reordering Main List + Dropping from Right Panel!) ---
let draggedTrackData = [];

function attachDragAndDropHandlers(tr, trackId, index) {
  tr.addEventListener('dragstart', (e) => {
    if (state.isOrderLocked) {
      e.preventDefault();
      showToast('🔒 Active list order is locked. Unlock it to reorder!', 'error');
      return;
    }
    let movedTracks = [];
    if (state.selectedIds.has(trackId)) {
      movedTracks = state.tracks.filter(t => state.selectedIds.has(t.id));
    } else {
      const single = state.tracks.find(t => t.id === trackId);
      if (single) movedTracks = [single];
    }
    draggedTrackData = movedTracks;
    tr.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData('application/json', JSON.stringify({ source: 'main', tracks: movedTracks }));
  });

  tr.addEventListener('dragend', () => {
    tr.classList.remove('dragging');
    document.querySelectorAll('.track-row').forEach(r => {
      r.classList.remove('drop-target-above', 'drop-target-below');
    });
  });

  tr.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';

    const rect = tr.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    if (relY < rect.height / 2) {
      tr.classList.add('drop-target-above');
      tr.classList.remove('drop-target-below');
    } else {
      tr.classList.add('drop-target-below');
      tr.classList.remove('drop-target-above');
    }

    handleDragAutoScroll(e.clientY);
  });

  tr.addEventListener('dragleave', () => {
    tr.classList.remove('drop-target-above', 'drop-target-below');
  });

  tr.addEventListener('drop', async (e) => {
    e.preventDefault();
    tr.classList.remove('drop-target-above', 'drop-target-below');

    try {
      let payload = null;
      try {
        const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
        payload = raw ? JSON.parse(raw) : null;
      } catch (err) {}

      if (!payload && window.__draggedTracksFromRight) {
        payload = { source: 'right', tracks: window.__draggedTracksFromRight };
      }

      // Case 1: Songs dropped from right browser / Discovery studio
      if (payload && payload.source === 'right' && payload.tracks && payload.tracks.length > 0) {
        insertTracksIntoMainPanel(payload.tracks, index);
        return;
      }

      // Case 2: Reordering main list
      if (payload && payload.tracks && payload.source === 'main') {
        const movedIds = payload.tracks.map(t => t.id);
        executeReorder(movedIds, index);
      } else if (draggedTrackData.length > 0) {
        executeReorder(draggedTrackData.map(t => t.id), index);
      }
    } catch (err) {
      if (draggedTrackData.length > 0) {
        executeReorder(draggedTrackData.map(t => t.id), index);
      }
    }
  });
}

function initWorkspaceContainerDrop() {
  const targets = [DOM.tableContainer, DOM.emptyState, DOM.tracksTbody, document.getElementById('main-content')].filter(Boolean);
  targets.forEach(el => {
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    el.addEventListener('drop', (e) => {
      if (e.target.closest('.track-row')) return; // Row drop handled by row listener
      e.preventDefault();
      let payload = null;
      try {
        const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
        payload = raw ? JSON.parse(raw) : null;
      } catch (err) {}
      if (!payload && window.__draggedTracksFromRight) {
        payload = { source: 'right', tracks: window.__draggedTracksFromRight };
      }
      if (payload && payload.source === 'right' && payload.tracks && payload.tracks.length > 0) {
        insertTracksIntoMainPanel(payload.tracks, state.tracks.length);
      }
    });
  });
}

function handleDragAutoScroll(clientY) {
  const container = DOM.tableContainer;
  const rect = container.getBoundingClientRect();
  const topEdge = rect.top;
  const bottomEdge = rect.bottom;
  const threshold = 60;

  if (clientY < topEdge + threshold) {
    const speed = Math.max(2, Math.round(((topEdge + threshold - clientY) / threshold) * 16));
    container.scrollTop -= speed;
  } else if (clientY > bottomEdge - threshold) {
    const speed = Math.max(2, Math.round(((clientY - (bottomEdge - threshold)) / threshold) * 16));
    container.scrollTop += speed;
  }
}

async function executeReorder(movedIds, targetIndex) {
  if (state.isOrderLocked) {
    showToast('🔒 Active list order is locked. Unlock it to reorder!', 'error');
    return;
  }
  state.undoStack.push([...state.tracks]);

  const remaining = state.tracks.filter(t => !movedIds.includes(t.id));
  const movedTracks = state.tracks.filter(t => movedIds.includes(t.id));
  const insertIdx = Math.min(targetIndex, remaining.length);
  remaining.splice(insertIdx, 0, ...movedTracks);
  state.tracks = remaining;

  state.userCustomOrderIds = state.tracks.map(t => t.id);
  renderTracksTable();

  // Only persist reorder to DB if editing a custom playlist
  if (state.activeView && state.activeView.startsWith('custom_')) {
    try {
      await api('/api/playlists/reorder', {
        method: 'POST',
        body: JSON.stringify({
          playlist_id: state.activeView,
          track_ids: state.userCustomOrderIds
        })
      });
    } catch (e) {}
  }
}

async function insertTracksIntoMainPanel(newTracks, targetIndex) {
  if (!newTracks || newTracks.length === 0) return;
  state.undoStack.push([...state.tracks]);

  const insertIdx = (targetIndex !== undefined && targetIndex !== null) ? targetIndex : state.tracks.length;
  state.tracks.splice(insertIdx, 0, ...newTracks);
  state.userCustomOrderIds = state.tracks.map(t => t.id);
  renderTracksTable();

  // Only persist to DB if editing a custom playlist
  if (state.activeView && state.activeView.startsWith('custom_')) {
    for (const t of newTracks) {
      try {
        await api(`/api/playlists/${state.activeView}/add-track`, {
          method: 'POST',
          body: JSON.stringify({ track_id: t.id })
        });
      } catch (e) {}
    }
  }
  showToast(`➕ Added ${newTracks.length} song${newTracks.length === 1 ? '' : 's'} to workspace queue`);
}

async function handleRemoveSelectedFromList() {
  if (!state.selectedIds || state.selectedIds.size === 0) {
    showToast('Select songs in the main list first', 'error');
    return;
  }

  const removedCount = state.selectedIds.size;
  // Save to undo stack for Cmd+Z recovery
  state.undoStack.push([...state.tracks]);

  // Filter active queue in workspace
  state.tracks = state.tracks.filter(t => !state.selectedIds.has(t.id));
  state.userCustomOrderIds = state.tracks.map(t => t.id);
  state.selectedIds.clear();

  // Only sync to DB if editing an explicit custom playlist
  if (state.activeView && state.activeView.startsWith('custom_')) {
    try {
      await api('/api/playlists/reorder', {
        method: 'POST',
        body: JSON.stringify({
          playlist_id: state.activeView,
          track_ids: state.userCustomOrderIds
        })
      });
    } catch (e) {}
  }

  renderTracksTable();
  updateSelectionUI();
  showToast(t('toastRemovedFromList', { count: removedCount, s: removedCount === 1 ? '' : (state.currentLang === 'es' ? 'es' : 's') }));
}

async function handleKeepOnlySelectedInList() {
  if (!state.selectedIds || state.selectedIds.size === 0) {
    showToast('Select songs in the main list first', 'error');
    return;
  }

  const keptCount = state.selectedIds.size;
  const removedCount = state.tracks.length - keptCount;
  if (removedCount === 0) {
    showToast('All songs in the list are already selected');
    return;
  }

  // Save to undo stack for Cmd+Z recovery
  state.undoStack.push([...state.tracks]);

  // Keep only selected in workspace
  state.tracks = state.tracks.filter(t => state.selectedIds.has(t.id));
  state.userCustomOrderIds = state.tracks.map(t => t.id);
  state.selectedIds.clear();

  // Only sync to DB if editing an explicit custom playlist
  if (state.activeView && state.activeView.startsWith('custom_')) {
    try {
      await api('/api/playlists/reorder', {
        method: 'POST',
        body: JSON.stringify({
          playlist_id: state.activeView,
          track_ids: state.userCustomOrderIds
        })
      });
    } catch (e) {}
  }

  renderTracksTable();
  updateSelectionUI();
  showToast(t('toastKeptOnlySelected', { kept: keptCount, removed: removedCount }));
}

// --- User Order vs Column Sorting ---
function applyColumnSort(column) {
  let direction = 'asc';
  if (state.sortState.column === column && state.sortState.direction === 'asc') {
    direction = 'desc';
  }

  state.sortState = { column, direction, isTemporary: true };

  state.tracks.sort((a, b) => {
    let valA = a[column];
    let valB = b[column];
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    if (valA < valB) return direction === 'asc' ? -1 : 1;
    if (valA > valB) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  DOM.resetOrderBtn.classList.remove('hidden');
  DOM.saveOrderBtn.classList.remove('hidden');
  renderTracksTable();
}

function resetToUserOrder() {
  state.sortState = { column: 'order_index', direction: 'asc', isTemporary: false };
  DOM.resetOrderBtn.classList.add('hidden');
  DOM.saveOrderBtn.classList.add('hidden');
  loadTracks();
}

async function saveAsUserOrder() {
  state.userCustomOrderIds = state.tracks.map(t => t.id);
  state.sortState.isTemporary = false;
  DOM.resetOrderBtn.classList.add('hidden');
  DOM.saveOrderBtn.classList.add('hidden');

  if (state.activeView && state.activeView.startsWith('custom_')) {
    await api('/api/playlists/reorder', {
      method: 'POST',
      body: JSON.stringify({
        playlist_id: state.activeView,
        track_ids: state.userCustomOrderIds
      })
    });
    showToast('💾 Saved sequence to playlist');
  } else {
    showToast('💾 Workspace sequence updated. Click "💾 Save as Playlist" to create a playlist.');
  }
}

// --- Right Panel: Dual Source Browser & Spotify Search ---
let rightSearchTimeout = null;

function initRightPanel() {
  if (!DOM.tabRightSearch || !DOM.tabRightPlaylist) return;

  DOM.tabRightSearch.addEventListener('click', () => {
    state.rightTab = 'search';
    DOM.tabRightSearch.classList.add('active');
    DOM.tabRightPlaylist.classList.remove('active');
    DOM.tabRightDiscovery?.classList.remove('active');
    DOM.rightSearchControls.classList.remove('hidden');
    DOM.rightPlaylistControls.classList.add('hidden');
    DOM.rightDiscoveryControls?.classList.add('hidden');
    DOM.rightStandardActionHeader?.classList.remove('hidden');
    DOM.rightItemsContainer?.classList.remove('hidden');
    DOM.rightSearchInput.focus();
  });

  DOM.tabRightPlaylist.addEventListener('click', () => {
    state.rightTab = 'playlist';
    DOM.tabRightPlaylist.classList.add('active');
    DOM.tabRightSearch.classList.remove('active');
    DOM.tabRightDiscovery?.classList.remove('active');
    DOM.rightPlaylistControls.classList.remove('hidden');
    DOM.rightSearchControls.classList.add('hidden');
    DOM.rightDiscoveryControls?.classList.add('hidden');
    DOM.rightStandardActionHeader?.classList.remove('hidden');
    DOM.rightItemsContainer?.classList.remove('hidden');
    if (DOM.rightPlaylistPicker.value) {
      loadRightPlaylistTracks(DOM.rightPlaylistPicker.value);
    }
  });

  DOM.tabRightDiscovery?.addEventListener('click', () => {
    state.rightTab = 'discovery';
    DOM.tabRightDiscovery.classList.add('active');
    DOM.tabRightSearch.classList.remove('active');
    DOM.tabRightPlaylist.classList.remove('active');
    DOM.rightDiscoveryControls?.classList.remove('hidden');
    DOM.rightSearchControls.classList.add('hidden');
    DOM.rightPlaylistControls.classList.add('hidden');
    DOM.rightStandardActionHeader?.classList.add('hidden');
    DOM.rightItemsContainer?.classList.add('hidden');

    if (state.discovery.discoveredTracks.length > 0) {
      DOM.discoveryResultsSection?.classList.remove('hidden');
      renderDiscoveryResultsItems(state.discovery.discoveredTracks);
    }
  });

  // Search Modifiers Pills
  DOM.searchModPills?.forEach(pill => {
    pill.addEventListener('click', () => {
      DOM.searchModPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.searchModifier = pill.dataset.mod || 'all';
      if (DOM.rightSearchInput.value.trim()) {
        executeRightSearch(DOM.rightSearchInput.value.trim());
      }
    });
  });

  // Search Submit button & Enter key
  DOM.rightSearchSubmitBtn?.addEventListener('click', () => {
    const q = DOM.rightSearchInput.value.trim();
    if (q) executeRightSearch(q);
  });

  DOM.rightSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = DOM.rightSearchInput.value.trim();
      if (q) executeRightSearch(q);
    }
  });

  DOM.rightSearchInput.addEventListener('input', (e) => {
    const q = e.target.value.trim();
    if (rightSearchTimeout) clearTimeout(rightSearchTimeout);
    if (!q) {
      DOM.rightItemsContainer.innerHTML = '<div class="search-placeholder-text">Type above to search Spotify.</div>';
      return;
    }
    rightSearchTimeout = setTimeout(() => executeRightSearch(q), 350);
  });

  // Right Playlist dropdown
  DOM.rightPlaylistPicker?.addEventListener('change', (e) => {
    const pId = e.target.value;
    if (pId) {
      loadRightPlaylistTracks(pId);
    } else {
      DOM.rightItemsContainer.innerHTML = '<div class="search-placeholder-text">Choose a playlist to browse.</div>';
    }
  });

  DOM.rightAddSelectedBtn?.addEventListener('click', () => {
    const selectedTracks = state.rightTracks.filter(t => state.rightSelectedIds.has(t.id));
    if (selectedTracks.length > 0) {
      insertTracksIntoMainPanel(selectedTracks, state.tracks.length);
      state.rightSelectedIds.clear();
      updateRightSelectionUI();
    } else {
      showToast('Select songs in the right panel first', 'error');
    }
  });

  // Initialize the Discovery Studio
  initDiscoveryPanel();
}

async function executeRightSearch(query) {
  DOM.rightItemsContainer.innerHTML = '<div class="search-placeholder-text">🔍 Searching Spotify...</div>';
  try {
    const endpoint = `/api/search?q=${encodeURIComponent(query)}&type=${state.searchModifier}`;
    const data = await api(endpoint);
    let results = data.results || [];
    
    // Strict client-side verification
    const rawQ = query.trim().toLowerCase();
    if (state.searchModifier === 'track') {
      results = results.filter(t => t.title && t.title.toLowerCase().includes(rawQ));
    } else if (state.searchModifier === 'artist') {
      results = results.filter(t => t.artist && t.artist.toLowerCase().includes(rawQ));
    }
    
    state.rightTracks = results;
    renderRightItems();
  } catch (e) {
    DOM.rightItemsContainer.innerHTML = '<div class="search-placeholder-text">Search failed.</div>';
  }
}

async function loadRightPlaylistTracks(playlistId) {
  DOM.rightItemsContainer.innerHTML = '<div class="search-placeholder-text">Loading playlist songs...</div>';
  try {
    const data = await api(`/api/tracks?playlist_id=${playlistId}`);
    state.rightTracks = data.tracks || [];
    renderRightItems();
  } catch (e) {
    DOM.rightItemsContainer.innerHTML = '<div class="search-placeholder-text">Error loading playlist.</div>';
  }
}

function renderRightItems() {
  DOM.rightItemsContainer.innerHTML = '';
  state.rightSelectedIds.clear();
  updateRightSelectionUI();

  if (state.rightTracks.length === 0) {
    DOM.rightItemsContainer.innerHTML = '<div class="search-placeholder-text">No tracks found.</div>';
    return;
  }

  state.rightTracks.forEach((track, index) => {
    const row = document.createElement('div');
    row.className = 'right-item-row';
    row.dataset.trackId = track.id;
    row.dataset.index = index;
    row.draggable = true;

    // Small Album Art
    const imgHtml = track.album_art_url
      ? `<img class="track-album-art" style="width:24px;height:24px;" src="${track.album_art_url}" alt="" loading="lazy">`
      : `<div class="track-album-art-placeholder" style="width:24px;height:24px;font-size:10px;">🎵</div>`;

    row.innerHTML = `
      ${imgHtml}
      <div class="right-item-meta">
        <div class="right-item-title">${escapeHtml(track.title)}</div>
        <div class="right-item-subtitle-row">
          <span class="right-item-artist">${escapeHtml(track.artist)}</span>
        </div>
      </div>
      <span class="right-item-dur">${formatDuration(track.duration_ms)}</span>
      <button class="right-item-add-btn" title="Add to main list">+ Add</button>
    `;

    row.addEventListener('mousedown', (e) => {
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        e.preventDefault();
      }
    });

    row.addEventListener('click', (e) => {
      if (e.target.classList.contains('right-item-add-btn')) return;
      handleRightRowClick(e, track.id, index);
    });

    row.querySelector('.right-item-add-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      insertTracksIntoMainPanel([track], state.tracks.length);
    });

    row.addEventListener('dragstart', (e) => {
      let moved = [];
      if (state.rightSelectedIds.has(track.id)) {
        moved = state.rightTracks.filter(t => state.rightSelectedIds.has(t.id));
      } else {
        moved = [track];
        state.rightSelectedIds.clear();
        state.rightSelectedIds.add(track.id);
        updateRightSelectionUI();
      }
      window.__draggedTracksFromRight = moved;
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'copy';
      try { e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'right', tracks: moved })); } catch (err) {}
      try { e.dataTransfer.setData('application/json', JSON.stringify({ source: 'right', tracks: moved })); } catch (err) {}
    });

    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      window.__draggedTracksFromRight = null;
    });

    DOM.rightItemsContainer.appendChild(row);
  });
}

function handleRightRowClick(e, trackId, index) {
  if (e.metaKey || e.ctrlKey || e.shiftKey) {
    window.getSelection()?.removeAllRanges();
  }
  if (e.metaKey || e.ctrlKey) {
    if (state.rightSelectedIds.has(trackId)) {
      state.rightSelectedIds.delete(trackId);
    } else {
      state.rightSelectedIds.add(trackId);
    }
    state.rightLastSelectedId = trackId;
    state.rightLastClickedIndex = index;
    updateRightSelectionUI();
  } else if (e.shiftKey) {
    const start = Math.min(state.rightLastClickedIndex, index);
    const end = Math.max(state.rightLastClickedIndex, index);
    for (let i = start; i <= end; i++) {
      state.rightSelectedIds.add(state.rightTracks[i].id);
    }
    state.rightLastSelectedId = trackId;
    updateRightSelectionUI();
  } else {
    if (state.rightSelectedIds.has(trackId) && state.rightSelectedIds.size === 1) {
      state.rightSelectedIds.clear();
    } else {
      state.rightSelectedIds.clear();
      state.rightSelectedIds.add(trackId);
    }
    state.rightLastClickedIndex = index;
    state.rightLastSelectedId = trackId;
    updateRightSelectionUI();
  }
}

function toggleRightSelection(trackId, isShift, index) {
  if (state.rightSelectedIds.has(trackId)) {
    state.rightSelectedIds.delete(trackId);
  } else {
    state.rightSelectedIds.add(trackId);
  }
  state.rightLastSelectedId = trackId;
  state.rightLastClickedIndex = index;
  updateRightSelectionUI();
}

function updateRightSelectionUI() {
  const rows1 = DOM.rightItemsContainer ? Array.from(DOM.rightItemsContainer.querySelectorAll('.right-item-row')) : [];
  const rows2 = DOM.discoveryItemsContainer ? Array.from(DOM.discoveryItemsContainer.querySelectorAll('.right-item-row')) : [];
  [...rows1, ...rows2].forEach(row => {
    const isSel = state.rightSelectedIds.has(row.dataset.trackId);
    row.classList.toggle('selected', isSel);
    const chk = row.querySelector('.right-item-checkbox');
    if (chk) chk.checked = isSel;
  });
  const count = state.rightSelectedIds.size;
  if (DOM.rightSelectedText) {
    DOM.rightSelectedText.textContent = `${count} selected`;
  }
  if (DOM.discoveryResultCountBadge) {
    DOM.discoveryResultCountBadge.textContent = t('discoveredCountBadge', { count: state.discovery.discoveredTracks.length });
  }
}

// ==========================================
// --- "🎲 Surprise Me!" Discovery Studio Engine ---
// ==========================================

function initDiscoveryPanel() {
  if (!DOM.discoveryGenerateBtn) return;

  // 1. Modifier Toggles (+ AND / - NOT)
  const setupModToggle = (btnEl, fieldKey) => {
    if (!btnEl) return;
    btnEl.addEventListener('click', (e) => {
      e.preventDefault();
      const current = state.discovery[fieldKey];
      const next = current === 'AND' ? 'NOT' : 'AND';
      state.discovery[fieldKey] = next;
      btnEl.classList.toggle('mod-and', next === 'AND');
      btnEl.classList.toggle('mod-not', next === 'NOT');
      btnEl.textContent = next === 'AND' ? '+ AND' : '- NOT';
    });
  };

  setupModToggle(DOM.discArtistModBtn, 'artistMod');
  setupModToggle(DOM.discGenreModBtn, 'genreMod');
  setupModToggle(DOM.discTrackModBtn, 'trackMod');

  // 2. Typeahead Inputs Setup
  setupDiscoveryTypeahead(DOM.discoveryArtistInput, DOM.discoveryArtistSuggestions, 'artist', (item) => {
    addDiscoveryChip('artists', item.name, item.id, state.discovery.artistMod);
    DOM.discoveryArtistInput.value = '';
    DOM.discoveryArtistSuggestions.classList.add('hidden');
  });

  setupDiscoveryTypeahead(DOM.discoveryGenreInput, DOM.discoveryGenreSuggestions, 'genre', (item) => {
    addDiscoveryChip('genres', item.id || item.name, null, state.discovery.genreMod);
    DOM.discoveryGenreInput.value = '';
    DOM.discoveryGenreSuggestions.classList.add('hidden');
    syncGenrePillsUI();
  });

  setupDiscoveryTypeahead(DOM.discoveryTrackInput, DOM.discoveryTrackSuggestions, 'track', (item) => {
    const trackName = item.name || item.title || 'Unknown Track';
    const artistName = item.artist || '';
    const label = artistName ? `${trackName} - ${artistName}` : trackName;
    addDiscoveryChip('tracks', label, item.id, state.discovery.trackMod);
    DOM.discoveryTrackInput.value = '';
    DOM.discoveryTrackSuggestions.classList.add('hidden');
  });

  // Add Button Click / Enter fallback for custom text
  DOM.discoveryAddArtistBtn?.addEventListener('click', () => {
    const val = DOM.discoveryArtistInput.value.trim();
    if (val) {
      addDiscoveryChip('artists', val, null, state.discovery.artistMod);
      DOM.discoveryArtistInput.value = '';
      DOM.discoveryArtistSuggestions.classList.add('hidden');
    }
  });

  DOM.discoveryAddGenreBtn?.addEventListener('click', () => {
    const val = DOM.discoveryGenreInput.value.trim().toLowerCase();
    if (val) {
      addDiscoveryChip('genres', val, null, state.discovery.genreMod);
      DOM.discoveryGenreInput.value = '';
      DOM.discoveryGenreSuggestions.classList.add('hidden');
      syncGenrePillsUI();
    }
  });

  // 3. Categorized Quick Genre Cloud
  DOM.genreCatPills?.forEach(pill => {
    pill.addEventListener('click', () => {
      DOM.genreCatPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const cat = pill.dataset.category || pill.dataset.cat || pill.getAttribute('data-cat') || pill.textContent.trim() || 'Popular';
      state.discovery.selectedGenreCategory = cat;
      loadGenreCategoryPills(cat);
    });
  });
  loadGenreCategoryPills('Popular');

  // 4. 3-State Decade Pills
  const decadePills = DOM.discoveryDecadePills?.querySelectorAll('.tri-state-pill') || [];
  decadePills.forEach(pill => {
    pill.addEventListener('click', () => {
      const decadeVal = pill.dataset.decade;
      toggleTriStatePill(pill, 'decades', decadeVal);
    });
  });

  // 5. Active Queue Vibe Button
  DOM.discoveryActiveVibeBtn?.addEventListener('click', () => {
    state.discovery.useActiveVibe = !state.discovery.useActiveVibe;
    DOM.discoveryActiveVibeBtn.classList.toggle('active', state.discovery.useActiveVibe);
    DOM.discoveryActiveVibeBtn.textContent = state.discovery.useActiveVibe ? '🔮 Vibe Active' : t('blendQueueVibeBtn');
    if (state.discovery.useActiveVibe) {
      showToast('🔮 Active queue vibe blending enabled!');
    }
  });

  // 6. Strict Negative Exclusions & Switches
  DOM.discNotLiked?.addEventListener('change', (e) => {
    state.discovery.notLikedSongs = e.target.checked;
  });
  DOM.discNotPlaylists?.addEventListener('change', (e) => {
    state.discovery.notInPlaylists = e.target.checked;
  });
  DOM.discRecentDaysRadios?.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        state.discovery.notRecentlyPlayedDays = parseInt(e.target.value, 10);
      }
    });
  });
  DOM.discNotLive?.addEventListener('change', (e) => {
    state.discovery.notLive = e.target.checked;
  });
  DOM.discNotRemix?.addEventListener('change', (e) => {
    state.discovery.notRemix = e.target.checked;
  });
  DOM.discLowPopularity?.addEventListener('change', (e) => {
    state.discovery.lowPopularityOnly = e.target.checked;
    DOM.hiddenGemTargetWrap?.classList.toggle('hidden', !e.target.checked);
  });
  DOM.discHiddenGemTargetRadios?.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        state.discovery.hiddenGemTarget = e.target.value;
      }
    });
  });

  // 7. Target Queue Size & Shuffle
  DOM.discTargetCountRadios?.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        state.discovery.targetCount = parseInt(e.target.value, 10);
      }
    });
  });
  DOM.discTrueShuffle?.addEventListener('change', (e) => {
    state.discovery.trueShuffle = e.target.checked;
  });

  // 8. Help Button
  DOM.discoveryHelpBtn?.addEventListener('click', () => {
    showConfirmModal({
      title: t('discoveryHelpTitle'),
      message: `${t('discoveryHelp')}\n\n• [+ AND]: Songs MUST match this seed\n• [- NOT]: Songs matching this will be STRICTLY EXCLUDED\n• 3-State Pills: Click to cycle Off ➔ [+ AND] ➔ [- NOT] ➔ Off\n• Strict filters guarantee 100% genuine new music discovery.`,
      confirmText: 'Got It!',
      onConfirm: () => DOM.confirmModal.classList.add('hidden')
    });
  });

  // 9. Generate Mix Button
  DOM.discoveryGenerateBtn?.addEventListener('click', generateDiscoveryMix);

  // 10. Transfer & Play Action Buttons
  DOM.discPlayDirectBtn?.addEventListener('click', () => {
    if (!state.discovery.discoveredTracks || state.discovery.discoveredTracks.length === 0) {
      showToast('No discovery tracks to play. Click "Generate Discovery Mix" first!', 'error');
      return;
    }
    const uris = state.discovery.discoveredTracks.map(t => t.uri);
    playTrackUris(uris, state.discovery.discoveredTracks[0].title);
  });
  DOM.discReplaceQueueBtn?.addEventListener('click', () => replaceMainQueue(false));
  DOM.discReplacePlayBtn?.addEventListener('click', () => replaceMainQueue(true));
  DOM.discAppendQueueBtn?.addEventListener('click', () => appendDiscoveryToMainQueue(false));
  DOM.discAppendSelectedBtn?.addEventListener('click', () => appendDiscoveryToMainQueue(true));
  DOM.discSelectAllBtn?.addEventListener('click', toggleSelectAllDiscovery);
}

// --- Typeahead Auto-Suggest Helper ---
let typeaheadDebounce = null;
function setupDiscoveryTypeahead(inputEl, dropdownEl, type, onSelect) {
  if (!inputEl || !dropdownEl) return;

  const fetchAndShow = () => {
    const q = inputEl.value.trim();
    if (typeaheadDebounce) clearTimeout(typeaheadDebounce);
    if (!q || q.length < 1) {
      dropdownEl.classList.add('hidden');
      dropdownEl.innerHTML = '';
      return;
    }

    typeaheadDebounce = setTimeout(async () => {
      try {
        const data = await api(`/api/discovery/suggest?type=${type}&q=${encodeURIComponent(q)}`);
        const suggestions = data.suggestions || data.results || [];
        renderTypeaheadDropdown(dropdownEl, suggestions, type, onSelect);
      } catch (err) {
        dropdownEl.classList.add('hidden');
      }
    }, 200);
  };

  inputEl.addEventListener('input', fetchAndShow);
  inputEl.addEventListener('focus', fetchAndShow);

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = inputEl.value.trim();
      if (q) {
        onSelect({ name: q, title: q, artist: '', id: null });
      }
    } else if (e.key === 'Escape') {
      dropdownEl.classList.add('hidden');
    }
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!inputEl.contains(e.target) && !dropdownEl.contains(e.target)) {
      dropdownEl.classList.add('hidden');
    }
  });
}

function renderTypeaheadDropdown(dropdownEl, items, type, onSelect) {
  dropdownEl.innerHTML = '';
  if (!items || items.length === 0) {
    dropdownEl.classList.add('hidden');
    return;
  }

  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'typeahead-item';

    const imgUrl = item.image_url || item.album_art_url;
    let imgHtml = '';
    if (imgUrl) {
      const isRound = type === 'artist' ? 'round' : '';
      imgHtml = `<img class="typeahead-thumb ${isRound}" src="${imgUrl}" alt="" loading="lazy">`;
    } else {
      const icon = type === 'artist' ? '🎤' : (type === 'track' ? '🎵' : '🎸');
      imgHtml = `<div class="typeahead-thumb placeholder-thumb" style="display:flex;align-items:center;justify-content:center;background:#333;font-size:11px;">${icon}</div>`;
    }

    const itemName = item.name || item.title || item.id || 'Unknown';
    let subText = item.subtitle || '';
    if (!subText && item.artist) {
      subText = item.artist + (item.album ? ` • ${item.album}` : '');
    }

    div.innerHTML = `
      ${imgHtml}
      <div class="typeahead-meta">
        <span class="typeahead-name">${escapeHtml(itemName)}</span>
        <span class="typeahead-sub">${escapeHtml(subText)}</span>
      </div>
    `;

    div.addEventListener('click', () => {
      onSelect(item);
    });

    dropdownEl.appendChild(div);
  });

  dropdownEl.classList.remove('hidden');
}

// --- Chips Management (Artists, Genres, Tracks) ---
function addDiscoveryChip(field, value, id, modifier) {
  if (!value) return;
  const list = state.discovery[field];
  // Allow having both + AND and - NOT for the same term (e.g. artist similarity seed + self exclusion)
  const existingIdx = list.findIndex(c => c.value.toLowerCase() === value.toLowerCase() && c.modifier === modifier);
  if (existingIdx < 0) {
    list.push({ value, id: id || null, modifier: modifier || 'AND' });
  }
  renderDiscoveryChips();
}

function removeDiscoveryChip(field, index) {
  state.discovery[field].splice(index, 1);
  renderDiscoveryChips();
  if (field === 'genres') syncGenrePillsUI();
  if (field === 'decades') syncDecadePillsUI();
}

function renderDiscoveryChips() {
  const renderChipsFor = (containerEl, field) => {
    if (!containerEl) return;
    containerEl.innerHTML = '';
    const chips = state.discovery[field] || [];

    chips.forEach((chip, idx) => {
      const chipEl = document.createElement('span');
      const isAnd = chip.modifier === 'AND';
      chipEl.className = `discovery-chip ${isAnd ? 'chip-and' : 'chip-not'}`;
      chipEl.innerHTML = `
        <span class="chip-mod-badge">${isAnd ? '+ AND' : '- NOT'}</span>
        <span>${escapeHtml(chip.value)}</span>
        <button class="chip-remove-btn" title="Remove">&times;</button>
      `;

      chipEl.querySelector('.chip-remove-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        removeDiscoveryChip(field, idx);
      });

      // Clicking chip toggles its AND / NOT state
      chipEl.addEventListener('click', () => {
        chip.modifier = chip.modifier === 'AND' ? 'NOT' : 'AND';
        renderDiscoveryChips();
        if (field === 'genres') syncGenrePillsUI();
        if (field === 'decades') syncDecadePillsUI();
      });

      containerEl.appendChild(chipEl);
    });
  };

  renderChipsFor(DOM.discoveryArtistChips, 'artists');
  renderChipsFor(DOM.discoveryGenreChips, 'genres');
  renderChipsFor(DOM.discoveryTrackChips, 'tracks');
}

// --- Quick Genre Cloud & 3-State Pills Logic ---
async function loadGenreCategoryPills(category) {
  if (!DOM.discoveryGenrePills) return;
  DOM.discoveryGenrePills.innerHTML = '<span style="font-size:10px;color:#888;">Loading genres...</span>';

  try {
    const data = await api(`/api/discovery/genres?category=${encodeURIComponent(category)}`);
    const genres = data.genres || [];
    DOM.discoveryGenrePills.innerHTML = '';

    genres.forEach(genre => {
      const gId = typeof genre === 'object' ? (genre.id || genre.name) : genre;
      const gName = typeof genre === 'object' ? (genre.name || genre.id) : genre;
      const pill = document.createElement('span');
      pill.className = 'tri-state-pill';
      pill.dataset.genre = gId;
      pill.textContent = gName;

      pill.addEventListener('click', () => {
        toggleTriStatePill(pill, 'genres', gId);
      });

      DOM.discoveryGenrePills.appendChild(pill);
    });

    syncGenrePillsUI();
  } catch (err) {
    DOM.discoveryGenrePills.innerHTML = '<span style="font-size:10px;color:#888;">Failed to load genres.</span>';
  }
}

function toggleTriStatePill(pillEl, field, value) {
  const list = state.discovery[field];
  const existingIdx = list.findIndex(item => item.value.toLowerCase() === value.toLowerCase());

  if (existingIdx === -1) {
    // State 0 (Off) ➔ State 1 (+ AND)
    list.push({ value, id: null, modifier: 'AND' });
    pillEl.classList.remove('state-not');
    pillEl.classList.add('state-and');
    pillEl.textContent = `+ ${value}`;
  } else if (list[existingIdx].modifier === 'AND') {
    // State 1 (+ AND) ➔ State 2 (- NOT)
    list[existingIdx].modifier = 'NOT';
    pillEl.classList.remove('state-and');
    pillEl.classList.add('state-not');
    pillEl.textContent = `- ${value}`;
  } else {
    // State 2 (- NOT) ➔ State 0 (Off)
    list.splice(existingIdx, 1);
    pillEl.classList.remove('state-and', 'state-not');
    pillEl.textContent = value;
  }

  renderDiscoveryChips();
}

function syncGenrePillsUI() {
  if (!DOM.discoveryGenrePills) return;
  const pills = DOM.discoveryGenrePills.querySelectorAll('.tri-state-pill');
  const activeGenres = new Map(state.discovery.genres.map(g => [g.value.toLowerCase(), g.modifier]));

  pills.forEach(pill => {
    const val = (pill.dataset.genre || pill.textContent.replace(/^[+-]\s*/, '')).toLowerCase();
    pill.classList.remove('state-and', 'state-not');
    if (activeGenres.has(val)) {
      const mod = activeGenres.get(val);
      if (mod === 'AND') {
        pill.classList.add('state-and');
        pill.textContent = `+ ${pill.dataset.genre || val}`;
      } else {
        pill.classList.add('state-not');
        pill.textContent = `- ${pill.dataset.genre || val}`;
      }
    } else {
      pill.textContent = pill.dataset.genre || val;
    }
  });
}

function syncDecadePillsUI() {
  if (!DOM.discoveryDecadePills) return;
  const pills = DOM.discoveryDecadePills.querySelectorAll('.tri-state-pill');
  const activeDecades = new Map(state.discovery.decades.map(d => [d.value.toLowerCase(), d.modifier]));

  pills.forEach(pill => {
    const val = pill.dataset.decade.toLowerCase();
    pill.classList.remove('state-and', 'state-not');
    if (activeDecades.has(val)) {
      const mod = activeDecades.get(val);
      if (mod === 'AND') {
        pill.classList.add('state-and');
        pill.textContent = `+ ${pill.dataset.decade.toUpperCase()}`;
      } else {
        pill.classList.add('state-not');
        pill.textContent = `- ${pill.dataset.decade.toUpperCase()}`;
      }
    } else {
      pill.textContent = pill.dataset.decade.toUpperCase();
    }
  });
}

// --- Generate Discovery Mix ---
async function generateDiscoveryMix() {
  if (state.discovery.isGenerating) return;

  // Auto-commit any pending un-submitted text in seed inputs before generating
  if (DOM.discoveryArtistInput && DOM.discoveryArtistInput.value.trim()) {
    const val = DOM.discoveryArtistInput.value.trim();
    const mod = DOM.discArtistModBtn?.dataset.modifier || 'AND';
    if (!state.discovery.artists.some(a => a.value.toLowerCase() === val.toLowerCase())) {
      state.discovery.artists.push({ value: val, id: null, modifier: mod });
    }
    DOM.discoveryArtistInput.value = '';
    renderDiscoveryChips();
  }
  if (DOM.discoveryTrackInput && DOM.discoveryTrackInput.value.trim()) {
    const val = DOM.discoveryTrackInput.value.trim();
    const mod = DOM.discTrackModBtn?.dataset.modifier || 'AND';
    if (!state.discovery.tracks.some(t => t.value.toLowerCase() === val.toLowerCase())) {
      state.discovery.tracks.push({ value: val, id: null, modifier: mod });
    }
    DOM.discoveryTrackInput.value = '';
    renderDiscoveryChips();
  }
  if (DOM.discoveryKeywordInput && DOM.discoveryKeywordInput.value.trim()) {
    const val = DOM.discoveryKeywordInput.value.trim();
    const mod = DOM.discKeywordModBtn?.dataset.modifier || 'AND';
    if (!state.discovery.keywords.some(k => k.value.toLowerCase() === val.toLowerCase())) {
      state.discovery.keywords.push({ value: val, id: null, modifier: mod });
    }
    DOM.discoveryKeywordInput.value = '';
    renderDiscoveryChips();
  }

  state.discovery.isGenerating = true;
  const diceIcon = DOM.discoveryGenerateBtn?.querySelector('.dice-icon');
  const btnText = DOM.discoveryGenerateBtn?.querySelector('.btn-text');
  if (diceIcon) diceIcon.classList.add('spinning');
  if (btnText) btnText.textContent = t('generatingDiscoveryBtn');

  DOM.discoveryResultsSection?.classList.remove('hidden');
  if (DOM.discoveryItemsContainer) {
    DOM.discoveryItemsContainer.innerHTML = '<div class="search-placeholder-text">🎲 Harvesting music candidates, applying strict NOT filters & True Shuffle...</div>';
  }

  const payload = {
    artists: state.discovery.artists,
    tracks: state.discovery.tracks,
    genres: state.discovery.genres,
    decades: state.discovery.decades,
    keywords: state.discovery.keywords,
    use_active_vibe: state.discovery.useActiveVibe,
    active_playlist_id: state.activeView === 'all' ? 'liked_songs' : state.activeView,
    not_liked_songs: state.discovery.notLikedSongs,
    not_in_playlists: state.discovery.notInPlaylists,
    not_recently_played_days: state.discovery.notRecentlyPlayedDays || null,
    not_live: state.discovery.notLive,
    not_remix: state.discovery.notRemix,
    low_popularity_only: state.discovery.lowPopularityOnly,
    hidden_gem_target: state.discovery.hiddenGemTarget || 'artist',
    target_count: state.discovery.targetCount,
    true_shuffle: state.discovery.trueShuffle,
    avoid_consecutive_artists: state.discovery.avoidConsecutiveArtists
  };

  try {
    const res = await api('/api/discovery/generate', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const tracks = res.tracks || [];
    state.discovery.discoveredTracks = tracks;
    state.rightTracks = tracks;

    DOM.discoveryResultsSection?.classList.remove('hidden');
    if (DOM.discoveryResultCountBadge) {
      DOM.discoveryResultCountBadge.textContent = t('discoveredCountBadge', { count: tracks.length });
    }
    
    renderDiscoveryResultsItems(tracks);
    showToast(t('discoveryToastSuccess', { count: tracks.length }));

    // Focus / smooth-scroll down to results inside Discovery studio
    setTimeout(() => {
      DOM.discoveryResultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  } catch (err) {
    if (DOM.discoveryItemsContainer) {
      DOM.discoveryItemsContainer.innerHTML = `<div class="search-placeholder-text" style="color:#ef4444;">Discovery generation failed: ${escapeHtml(err.message)}</div>`;
    }
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    state.discovery.isGenerating = false;
    if (diceIcon) diceIcon.classList.remove('spinning');
    if (btnText) btnText.textContent = t('generateDiscoveryBtn');
  }
}

function renderDiscoveryResultsItems(tracks) {
  if (!DOM.discoveryItemsContainer) return;
  DOM.discoveryItemsContainer.innerHTML = '';
  state.rightSelectedIds.clear();
  updateRightSelectionUI();

  if (!tracks || tracks.length === 0) {
    DOM.discoveryItemsContainer.innerHTML = '<div class="search-placeholder-text">No tracks discovered with current filters. Try relaxing some restrictions.</div>';
    return;
  }

  tracks.forEach((track, index) => {
    const row = document.createElement('div');
    row.className = 'right-item-row';
    row.dataset.trackId = track.id;
    row.dataset.index = index;
    row.draggable = true;

    // Selection Checkbox
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.className = 'right-item-checkbox';
    chk.checked = state.rightSelectedIds.has(track.id);
    chk.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleRightSelection(track.id, e.shiftKey, index);
    });

    // Play Direct Button
    const playBtn = document.createElement('button');
    playBtn.className = 'disc-item-play-btn';
    playBtn.title = 'Play song directly in Spotify';
    playBtn.textContent = '▶';
    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      playTrackUris([track.uri], track.title);
    });

    // Small Album Art
    const imgHtml = track.album_art_url
      ? `<img class="track-album-art" style="width:24px;height:24px;border-radius:3px;object-fit:cover;" src="${track.album_art_url}" alt="" loading="lazy">`
      : `<div class="track-album-art-placeholder" style="width:24px;height:24px;font-size:10px;">🎵</div>`;

    const metaWrap = document.createElement('div');
    metaWrap.className = 'right-item-meta';
    metaWrap.style.flex = '1';
    metaWrap.style.minWidth = '0';
    metaWrap.innerHTML = `
      <div style="display:flex; align-items:center; gap:6px;">
        ${imgHtml}
        <div style="flex:1; min-width:0;">
          <div class="right-item-title" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(track.title)}</div>
          <div class="right-item-subtitle-row">
            <span class="right-item-artist" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(track.artist)}</span>
          </div>
        </div>
      </div>
    `;
    row.appendChild(metaWrap);

    const durSpan = document.createElement('span');
    durSpan.className = 'right-item-dur';
    durSpan.textContent = formatDuration(track.duration_ms);
    row.appendChild(durSpan);

    const addBtn = document.createElement('button');
    addBtn.className = 'right-item-add-btn';
    addBtn.title = 'Add to main workspace';
    addBtn.textContent = '+ Add';
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      insertTracksIntoMainPanel([track], state.tracks.length);
    });
    row.appendChild(addBtn);

    // Row selection on click
    row.addEventListener('click', (e) => {
      if (e.target.classList.contains('right-item-add-btn') || e.target.classList.contains('disc-item-play-btn') || e.target.type === 'checkbox') return;
      handleRightRowClick(e, track.id, index);
    });

    // Double click to play directly
    row.addEventListener('dblclick', () => {
      playTrackUris([track.uri], track.title);
    });

    // Multi-Select and Drag support
    row.addEventListener('dragstart', (e) => {
      let moved = [];
      if (state.rightSelectedIds.has(track.id)) {
        moved = tracks.filter(t => state.rightSelectedIds.has(t.id));
      } else {
        moved = [track];
        state.rightSelectedIds.clear();
        state.rightSelectedIds.add(track.id);
        updateRightSelectionUI();
      }
      window.__draggedTracksFromRight = moved;
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'copy';
      try { e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'right', tracks: moved })); } catch (err) {}
      try { e.dataTransfer.setData('application/json', JSON.stringify({ source: 'right', tracks: moved })); } catch (err) {}
    });

    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      window.__draggedTracksFromRight = null;
    });

    DOM.discoveryItemsContainer.appendChild(row);
  });
}

// --- Discovery Transfer Handlers (Replace vs Append) ---
async function replaceMainQueue(autoPlay = false) {
  if (!state.discovery.discoveredTracks || state.discovery.discoveredTracks.length === 0) {
    showToast('No discovery tracks to load. Click "Generate Discovery Mix" first!', 'error');
    return;
  }

  // Save current order to undo stack
  state.undoStack.push([...state.tracks]);

  // Overwrite active workspace queue with discovered tracks
  state.tracks = [...state.discovery.discoveredTracks];
  state.userCustomOrderIds = state.tracks.map(t => t.id);
  state.selectedIds.clear();

  renderTracksTable();
  showToast(t('discoveryToastReplaced', { count: state.tracks.length }));

  if (autoPlay && state.tracks.length > 0) {
    playFromIndex(0);
  }
}

async function appendDiscoveryToMainQueue(selectedOnly = false) {
  let tracksToAppend = [];
  if (selectedOnly) {
    tracksToAppend = state.rightTracks.filter(t => state.rightSelectedIds.has(t.id));
    if (tracksToAppend.length === 0) {
      showToast('Select songs in the discovery list first', 'error');
      return;
    }
  } else {
    tracksToAppend = state.discovery.discoveredTracks;
  }

  if (!tracksToAppend || tracksToAppend.length === 0) {
    showToast('No discovery tracks to append.', 'error');
    return;
  }

  await insertTracksIntoMainPanel(tracksToAppend, state.tracks.length);
  showToast(t('discoveryToastAppended', { count: tracksToAppend.length }));
}

function toggleSelectAllDiscovery() {
  const allSelected = state.rightSelectedIds.size === state.rightTracks.length && state.rightTracks.length > 0;
  state.rightSelectedIds.clear();
  if (!allSelected) {
    state.rightTracks.forEach(t => state.rightSelectedIds.add(t.id));
  }
  updateRightSelectionUI();
}


// --- Live Player Poller ---
let pollerTimer = null;

function startPlayerStatePoller() {
  if (pollerTimer) clearInterval(pollerTimer);
  const interval = (state.playerState && state.playerState.is_playing) ? 2500 : 4000;
  if (!document.hidden) {
    pollerTimer = setInterval(pollPlayerState, interval);
    pollPlayerState();
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (pollerTimer) { clearInterval(pollerTimer); pollerTimer = null; }
  } else {
    pollPlayerState();
    startPlayerStatePoller();
  }
});

async function pollPlayerState() {
  if (document.hidden) return;
  try {
    const data = await api('/api/player/state');
    state.playerState = data;
    updatePlayerUI(data);
  } catch (e) {}
}

function updatePlayerUI(data) {
  const isPlaying = data && data.is_playing;
  const item = data && data.item;

  if (item) {
    state.currentPlayingTrackId = item.id;
    state.currentPlayingTrackTitle = item.title;

    // Bottom Bar
    DOM.playerTitle.textContent = item.title;
    DOM.playerArtist.textContent = item.artist;
    DOM.ctrlPlaypause.textContent = isPlaying ? '⏸️' : '▶️';

    // Progress Bar
    const prog = data.progress_ms || 0;
    const dur = item.duration_ms || 1;
    const pct = Math.min(100, Math.max(0, (prog / dur) * 100));
    DOM.progressBarFill.style.width = `${pct}%`;

    // Dynamic Vibrant Green Font Highlighting in Table!
    const rows = DOM.tracksTbody.querySelectorAll('.track-row');
    rows.forEach(row => {
      const rowId = row.dataset.trackId;
      const rowUri = row.dataset.trackUri;
      const rowTitle = row.dataset.trackTitle;

      const isThisTrack = (
        (item.id && (rowId === item.id || rowUri === item.id)) ||
        (item.uri && rowUri === item.uri) ||
        (rowTitle && item.title && rowTitle.toLowerCase().trim() === item.title.toLowerCase().trim())
      );

      row.classList.toggle('now-playing-row', isThisTrack);
      const numSpan = row.querySelector('.track-num-text');
      if (numSpan) {
        numSpan.textContent = isThisTrack ? '🔊' : (parseInt(row.dataset.index, 10) + 1);
      }
    });

    // Auto-scroll to center
    if (state.autoScrollLocked) {
      const activeRow = DOM.tracksTbody.querySelector('.track-row.now-playing-row');
      if (activeRow) {
        activeRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  } else {
    state.currentPlayingTrackId = null;
    state.currentPlayingTrackTitle = null;
    DOM.playerTitle.textContent = 'Not Playing';
    DOM.playerArtist.textContent = 'Open Spotify on Mac or Android';
    DOM.ctrlPlaypause.textContent = '▶️';
    DOM.progressBarFill.style.width = '0%';
  }
}

// --- Save As Playlist Button State Updater ---
function updateSaveAsPlaylistButtonState() {
  if (!DOM.saveAsPlaylistBtn) return;
  const count = state.tracks ? state.tracks.length : 0;
  DOM.saveAsPlaylistBtn.disabled = (count === 0);
  if (count === 0) {
    DOM.saveAsPlaylistBtn.classList.remove('btn-primary');
    DOM.saveAsPlaylistBtn.classList.add('btn-secondary');
    DOM.saveAsPlaylistBtn.setAttribute('data-tooltip-title', t('tipSaveAsPlaylistTitle') || 'Save as Playlist');
    DOM.saveAsPlaylistBtn.setAttribute('data-tooltip', t('tipSaveAsPlaylistEmpty') || 'The active list has no songs to save.');
  } else {
    DOM.saveAsPlaylistBtn.classList.remove('btn-secondary');
    DOM.saveAsPlaylistBtn.classList.add('btn-primary');
    DOM.saveAsPlaylistBtn.setAttribute('data-tooltip-title', t('tipSaveAsPlaylistTitle') || 'Save as Playlist');
    DOM.saveAsPlaylistBtn.setAttribute('data-tooltip', t('tipSaveAsPlaylistActive', { count }) || `Save or overwrite a Spotify playlist with these ${count} songs.`);
  }
}

// --- Create Spotify Playlist Modal ---
function openCreatePlaylistModal(fromActiveList = false) {
  state.playlistCreationFromActiveList = fromActiveList;
  let count = 0;
  if (fromActiveList) {
    count = state.tracks.length;
    const isEs = state.currentLang === 'es';
    DOM.createPlaylistCountHint.textContent = isEs
      ? `Creará o sobrescribirá una playlist con las ${count} canciones de tu lista activa en su orden actual.`
      : `Will create or overwrite a playlist containing ${count} songs from your active list in their current order.`;
    DOM.newPlaylistName.value = `Kiki's Mix ${new Date().toLocaleDateString()}`;
  } else {
    count = state.selectedIds.size;
    const isEs = state.currentLang === 'es';
    DOM.createPlaylistCountHint.textContent = isEs
      ? `Creará o sobrescribirá una playlist con las ${count} canciones seleccionadas.`
      : `Will create or overwrite a playlist containing ${count} selected song${count === 1 ? '' : 's'}.`;
    DOM.newPlaylistName.value = `Kiki's Mix ${new Date().toLocaleDateString()}`;
  }
  DOM.createPlaylistModal.classList.remove('hidden');
  DOM.newPlaylistName.focus();
}

async function handleCreateSpotifyPlaylist() {
  const name = DOM.newPlaylistName.value.trim();
  const desc = DOM.newPlaylistDesc.value.trim();
  let trackIds = [];
  if (state.playlistCreationFromActiveList) {
    trackIds = state.tracks.map(t => t.id);
  } else {
    trackIds = Array.from(state.selectedIds);
  }

  if (!name || trackIds.length === 0) return;

  const isEs = state.currentLang === 'es';
  // Check if a playlist with this exact name already exists in state.allPlaylists
  const existingPlaylist = state.allPlaylists.find(p => p.name.trim().toLowerCase() === name.toLowerCase());

  if (existingPlaylist) {
    // Hide creation modal and prompt for overwrite confirmation
    DOM.createPlaylistModal.classList.add('hidden');
    
    const confirmTitle = isEs 
      ? `⚠️ ¿Sobrescribir playlist "${existingPlaylist.name}"?` 
      : `⚠️ Overwrite Playlist "${existingPlaylist.name}"?`;
    const confirmMsg = isEs
      ? `Ya existe una playlist llamada "${existingPlaylist.name}" con ${existingPlaylist.total_tracks} canciones.\n\n¿Deseas sobrescribirla con estas ${trackIds.length} canciones? Esto actualizará la lista en Spotify y en tu biblioteca local.`
      : `A playlist named "${existingPlaylist.name}" already exists (${existingPlaylist.total_tracks} tracks).\n\nDo you want to overwrite it with these ${trackIds.length} tracks? This will replace the playlist's tracks on Spotify and in your local library.`;
    const confirmBtnText = isEs ? '⚠️ Sobrescribir Playlist' : '⚠️ Overwrite Playlist';

    showConfirmModal({
      title: confirmTitle,
      message: confirmMsg,
      confirmText: confirmBtnText,
      onConfirm: async () => {
        DOM.confirmModal.classList.add('hidden');
        await executePlaylistSave(name, desc, trackIds, true, existingPlaylist.id);
      }
    });
    return;
  }

  // If new playlist name, proceed directly
  await executePlaylistSave(name, desc, trackIds, false, null);
}

async function executePlaylistSave(name, desc, trackIds, overwrite = false, playlistId = null) {
  DOM.confirmCreatePlaylistModal.disabled = true;
  DOM.confirmCreatePlaylistModal.textContent = state.currentLang === 'es' ? 'Guardando playlist...' : 'Saving Playlist...';

  try {
    const res = await api('/api/playlists/create', {
      method: 'POST',
      body: JSON.stringify({
        name: name,
        description: desc,
        track_ids: trackIds,
        overwrite: overwrite,
        playlist_id: playlistId
      })
    });
    
    const isEs = state.currentLang === 'es';
    if (res.overwritten) {
      showToast(isEs ? `✅ ¡Playlist "${name}" sobrescrita con ${trackIds.length} canciones!` : `✅ Overwrote Playlist "${name}" with ${trackIds.length} songs!`);
    } else {
      showToast(isEs ? `✅ ¡Playlist "${name}" creada con ${trackIds.length} canciones!` : `✅ Created Playlist "${name}" (${trackIds.length} songs)!`);
    }
    
    DOM.createPlaylistModal.classList.add('hidden');
    await loadPlaylists();
    updateSaveAsPlaylistButtonState();
  } catch (e) {
    showToast('Failed to save playlist: ' + e.message, 'error');
  } finally {
    DOM.confirmCreatePlaylistModal.disabled = false;
    DOM.confirmCreatePlaylistModal.textContent = state.currentLang === 'es' ? 'Crear y guardar en Spotify' : 'Create & Sync to Spotify';
  }
}

// --- Context Menu for Tracks ---
let contextMenuIndex = 0;
function openContextMenu(x, y, index) {
  contextMenuIndex = index;
  hideAllContextMenus();
  const menu = DOM.customContextMenu;
  menu.style.left = `${Math.min(x, window.innerWidth - 200)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - 240)}px`;
  menu.classList.remove('hidden');
}

function hideAllContextMenus() {
  DOM.customContextMenu?.classList.add('hidden');
  DOM.playlistContextMenu?.classList.add('hidden');
}

// --- Event Listeners Setup ---
function initEventListeners() {
  // Dual-Flag Language Switcher (🇬🇧 English <-> 🇦🇷 Español Argentina)
  DOM.langBtnEn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.currentLang !== 'en') {
      applyLanguage('en');
      showToast('🇬🇧 Language switched to English');
    }
  });

  DOM.langBtnEs?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.currentLang !== 'es') {
      applyLanguage('es');
      showToast('🇦🇷 Idioma cambiado a Español (Argentina)');
    }
  });

  DOM.langToggleGroup?.addEventListener('click', () => {
    const nextLang = state.currentLang === 'en' ? 'es' : 'en';
    applyLanguage(nextLang);
    showToast(nextLang === 'es' ? '🇦🇷 Idioma cambiado a Español (Argentina)' : '🇬🇧 Language switched to English');
  });

  // Sync Library Buttons
  DOM.topSyncBtn?.addEventListener('click', () => triggerAutoSync(false));
  DOM.sidebarSyncBtn?.addEventListener('click', () => triggerAutoSync(false));

  // Search Filter in active list
  DOM.searchInput?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    DOM.clearSearchBtn?.classList.toggle('hidden', !state.searchQuery);
    loadTracks();
  });
  DOM.clearSearchBtn?.addEventListener('click', () => {
    DOM.searchInput.value = '';
    state.searchQuery = '';
    DOM.clearSearchBtn?.classList.add('hidden');
    loadTracks();
  });

  // Sidebar Nav
  DOM.navItems?.forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      state.activeView = item.dataset.view;
      loadTracks();
    });
  });

  DOM.selectAllCheckbox?.addEventListener('change', (e) => {
    if (e.target.checked) {
      state.tracks.forEach(t => state.selectedIds.add(t.id));
    } else {
      state.selectedIds.clear();
    }
    updateSelectionUI();
  });

  document.querySelectorAll('#tracks-table th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (col) applyColumnSort(col);
    });
  });

  // Main Toolbar Buttons
  DOM.playActiveListBtn?.addEventListener('click', () => playFromIndex(0));
  DOM.shuffleActiveListBtn?.addEventListener('click', toggleTrueShuffle);
  DOM.reloadViewBtn?.addEventListener('click', () => {
    loadTracks();
    showToast('🔄 Reloaded original list from library');
  });
  DOM.clearQueueBtn?.addEventListener('click', () => {
    if (!state.tracks || state.tracks.length === 0) return;
    state.undoStack.push([...state.tracks]);
    state.tracks = [];
    state.selectedIds.clear();
    state.userCustomOrderIds = [];
    renderTracksTable();
    updateSelectionUI();
    showToast('🗑️ Cleared workspace queue. (Press Cmd+Z to undo or click 🔄 Reload to restore)');
  });
  DOM.saveAsPlaylistBtn?.addEventListener('click', () => openCreatePlaylistModal(true));
  DOM.resetOrderBtn?.addEventListener('click', resetToUserOrder);
  DOM.saveOrderBtn?.addEventListener('click', saveAsUserOrder);
  DOM.lockOrderBtn?.addEventListener('click', () => {
    state.isOrderLocked = !state.isOrderLocked;
    DOM.lockOrderBtn.textContent = state.isOrderLocked ? '🔒 Locked' : '🔓 Unlocked';
    DOM.lockOrderBtn.classList.toggle('btn-accent', state.isOrderLocked);
    renderTracksTable();
    showToast(state.isOrderLocked ? '🔒 List order locked (drags and shuffles disabled)' : '🔓 List order unlocked');
  });

  // Batch Action Bar
  DOM.batchCreatePlaylistBtn?.addEventListener('click', () => openCreatePlaylistModal(false));

  DOM.batchShuffleBtn?.addEventListener('click', () => {
    if (state.isOrderLocked) {
      showToast('🔒 Active list order is locked. Unlock it to shuffle!', 'error');
      return;
    }
    const selTracks = state.tracks.filter(t => state.selectedIds.has(t.id));
    const uris = selTracks.map(t => t.uri);
    api('/api/player/play', {
      method: 'POST',
      body: JSON.stringify({ uris: uris, true_shuffle: true, device_id: DOM.deviceSelect?.value || null })
    });
    showToast(`🔀 True Shuffled ${uris.length} selected tracks`);
  });

  DOM.clearSelectionBtn?.addEventListener('click', () => {
    state.selectedIds.clear();
    updateSelectionUI();
  });

  // Player Controls
  DOM.ctrlPlaypause?.addEventListener('click', async () => {
    await api('/api/player/control', { method: 'POST', body: JSON.stringify({ action: 'playpause' }) });
    pollPlayerState();
  });
  DOM.ctrlNext?.addEventListener('click', () => {
    playNextInActiveList();
  });
  DOM.ctrlPrev?.addEventListener('click', () => {
    playPrevInActiveList();
  });
  DOM.ctrlTrueShuffle?.addEventListener('click', toggleTrueShuffle);

  // Progress Bar Seek Scrubber!
  DOM.progressBarWrap?.addEventListener('click', async (e) => {
    if (!state.playerState?.item?.duration_ms) return;
    const rect = DOM.progressBarWrap.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const newPosMs = Math.round(pct * state.playerState.item.duration_ms);
    DOM.progressBarFill.style.width = `${pct * 100}%`;
    await api('/api/player/seek', {
      method: 'POST',
      body: JSON.stringify({ position_ms: newPosMs })
    }).catch(() => {});
    pollPlayerState();
  });

  // Volume Slider
  DOM.volumeSlider?.addEventListener('input', (e) => {
    api('/api/player/volume', {
      method: 'POST',
      body: JSON.stringify({ volume_percent: parseInt(e.target.value, 10) })
    }).catch(() => {});
  });

  // Modals
  DOM.closeCreatePlaylistModal?.addEventListener('click', () => DOM.createPlaylistModal.classList.add('hidden'));
  DOM.cancelCreatePlaylistModal?.addEventListener('click', () => DOM.createPlaylistModal.classList.add('hidden'));
  DOM.confirmCreatePlaylistModal?.addEventListener('click', handleCreateSpotifyPlaylist);

  // Playlist Context Menu Actions (Rename, Delete)
  document.getElementById('ctx-playlist-rename')?.addEventListener('click', () => {
    if (!activeContextMenuPlaylist) return;
    const p = activeContextMenuPlaylist;
    showConfirmModal({
      title: `✏️ Rename Playlist`,
      message: `Enter the new name for playlist "${p.name}":`,
      showInput: true,
      inputValue: p.name,
      inputLabel: 'New Playlist Name:',
      confirmText: 'Rename',
      onConfirm: async () => {
        const newName = DOM.confirmModalInput.value.trim();
        if (newName && newName !== p.name) {
          try {
            await api(`/api/playlists/${p.id}/rename`, {
              method: 'POST',
              body: JSON.stringify({ new_name: newName })
            });
            showToast(`✏️ Renamed playlist to "${newName}"`);
            DOM.confirmModal.classList.add('hidden');
            await loadPlaylists();
            if (state.activeView === p.id) {
              loadTracks();
            }
          } catch (e) {
            showToast(e.message, 'error');
          }
        }
      }
    });
  });

  document.getElementById('ctx-playlist-delete')?.addEventListener('click', () => {
    if (!activeContextMenuPlaylist) return;
    const p = activeContextMenuPlaylist;
    showConfirmModal({
      title: `🗑️ Delete Playlist`,
      message: `Are you sure you want to delete playlist "${p.name}"?`,
      confirmText: 'Yes, Delete',
      onConfirm: async () => {
        try {
          await api(`/api/playlists/${p.id}`, { method: 'DELETE' });
          showToast(`🗑️ Deleted playlist "${p.name}"`);
          DOM.confirmModal.classList.add('hidden');
          if (state.activeView === p.id) {
            state.activeView = 'all';
            document.querySelectorAll('.nav-item').forEach(i => {
              if (i.dataset.view === 'all') i.classList.add('active');
              else i.classList.remove('active');
            });
          }
          await loadPlaylists();
          await loadTracks();
        } catch (e) {
          showToast(e.message, 'error');
        }
      }
    });
  });

  // Confirm Modal Cancel & Submit buttons
  DOM.closeConfirmModal?.addEventListener('click', () => DOM.confirmModal.classList.add('hidden'));
  DOM.confirmModalCancelBtn?.addEventListener('click', () => DOM.confirmModal.classList.add('hidden'));
  DOM.confirmModalSubmitBtn?.addEventListener('click', () => {
    if (confirmModalCallback) confirmModalCallback();
  });

  async function triggerSpotifyLogin() {
    try {
      showToast('Connecting to Spotify...');
      const auth = await api('/api/auth/login');
      if (auth.auth_url) {
        window.location.href = auth.auth_url;
      }
    } catch (e) {
      showToast('Login error: ' + e.message, 'error');
    }
  }

  DOM.loginBtn?.addEventListener('click', triggerSpotifyLogin);
  DOM.modal1ClickLoginBtn?.addEventListener('click', triggerSpotifyLogin);
  DOM.heroLoginBtn?.addEventListener('click', triggerSpotifyLogin);

  DOM.logoutBtn?.addEventListener('click', () => {
    showConfirmModal({
      title: '🚪 Log Out & Reset',
      message: 'Are you sure you want to log out? This will disconnect your account and clear the local library cache.',
      confirmText: 'Log Out',
      onConfirm: async () => {
        try {
          await api('/api/auth/logout', { method: 'POST' });
          showToast('🚪 Logged out successfully');
          DOM.confirmModal.classList.add('hidden');
          DOM.settingsModal.classList.add('hidden');
          state.authenticated = false;
          state.tracks = [];
          state.allPlaylists = [];
          await checkStatus();
        } catch (e) {
          showToast(e.message, 'error');
        }
      }
    });
  });

  DOM.settingsBtn?.addEventListener('click', () => DOM.settingsModal.classList.remove('hidden'));
  DOM.closeSettingsModal?.addEventListener('click', () => DOM.settingsModal.classList.add('hidden'));
  DOM.closeSettingsBtnBottom?.addEventListener('click', () => DOM.settingsModal.classList.add('hidden'));
  DOM.saveCredentialsBtn?.addEventListener('click', async () => {
    const client_id = DOM.settingsClientId.value.trim();
    const client_secret = DOM.settingsClientSecret.value.trim();
    if (client_id && client_secret) {
      await api('/api/credentials', {
        method: 'POST',
        body: JSON.stringify({ client_id, client_secret })
      });
      const auth = await api('/api/auth/login');
      if (auth.auth_url) window.location.href = auth.auth_url;
    }
  });

  document.addEventListener('click', hideAllContextMenus);
  document.getElementById('ctx-play-now')?.addEventListener('click', () => playFromIndex(contextMenuIndex));
  document.getElementById('ctx-true-shuffle')?.addEventListener('click', toggleTrueShuffle);
  document.getElementById('ctx-make-playlist')?.addEventListener('click', () => openCreatePlaylistModal(false));
  document.getElementById('ctx-remove-from-list')?.addEventListener('click', handleRemoveSelectedFromList);
  document.getElementById('ctx-keep-only-selected')?.addEventListener('click', handleKeepOnlySelectedInList);

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

    if (e.code === 'Space') {
      e.preventDefault();
      DOM.ctrlPlaypause?.click();
    } else if (e.key === 'Escape') {
      state.selectedIds.clear();
      updateSelectionUI();
      DOM.settingsModal?.classList.add('hidden');
      DOM.createPlaylistModal?.classList.add('hidden');
      DOM.confirmModal?.classList.add('hidden');
      hideAllContextMenus();
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      state.tracks.forEach(t => state.selectedIds.add(t.id));
      updateSelectionUI();
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      handleUndo();
    } else if (e.key === '/') {
      e.preventDefault();
      DOM.searchInput?.focus();
    }
  });
}

function handleUndo() {
  if (state.undoStack.length > 0) {
    const prevSnapshot = state.undoStack.pop();
    if (Array.isArray(prevSnapshot)) {
      if (prevSnapshot.length === 0) {
        state.tracks = [];
      } else if (typeof prevSnapshot[0] === 'object' && prevSnapshot[0] !== null) {
        state.tracks = [...prevSnapshot];
      } else {
        const map = new Map(state.tracks.map(t => [t.id, t]));
        state.tracks = prevSnapshot.map(id => map.get(id)).filter(Boolean);
      }
      state.userCustomOrderIds = state.tracks.map(t => t.id);
      state.selectedIds.clear();
      renderTracksTable();
      updateSelectionUI();
      showToast('↩️ Restored previous workspace state');
    }
  } else {
    showToast('Nothing to undo');
  }
}

function formatDuration(ms) {
  const totalSecs = Math.floor((ms || 0) / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  if (type === 'error') toast.style.borderColor = '#ef4444';
  toast.textContent = message;
  DOM.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// --- Sleek Hover & Linger Tooltip System ---
const TooltipManager = {
  tooltipEl: null,
  timer: null,
  lingerDelay: 380, // milliseconds pause before showing tooltip
  currentElem: null,

  init() {
    this.tooltipEl = document.createElement('div');
    this.tooltipEl.id = 'app-tooltip';
    document.body.appendChild(this.tooltipEl);

    // Watch hover with smooth linger delay
    document.addEventListener('mouseover', (e) => {
      const target = e.target.closest('[data-tooltip]');
      if (target) {
        if (target === this.currentElem) return;
        this.clear();
        this.currentElem = target;
        this.timer = setTimeout(() => {
          this.show(target);
        }, this.lingerDelay);
      } else {
        this.clear();
      }
    });

    document.addEventListener('mouseout', (e) => {
      const target = e.target.closest('[data-tooltip]');
      if (target && target === this.currentElem) {
        this.clear();
      }
    });

    document.addEventListener('mousedown', () => {
      this.clear();
    });

    window.addEventListener('scroll', () => this.clear(), true);
  },

  clear() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.currentElem = null;
    if (this.tooltipEl) {
      this.tooltipEl.classList.remove('tooltip-visible');
    }
  },

  show(elem) {
    if (!this.tooltipEl || !elem) return;
    const title = elem.getAttribute('data-tooltip-title') || '';
    const body = elem.getAttribute('data-tooltip') || '';
    const shortcut = elem.getAttribute('data-tooltip-shortcut') || '';

    if (!body && !title) return;

    let html = '';
    if (title || shortcut) {
      html += `<div class="tooltip-header">`;
      if (title) html += `<span class="tooltip-title">${escapeHtml(title)}</span>`;
      if (shortcut) html += `<span class="tooltip-shortcut">${escapeHtml(shortcut)}</span>`;
      html += `</div>`;
    }
    if (body) {
      html += `<div class="tooltip-body">${escapeHtml(body)}</div>`;
    }

    this.tooltipEl.innerHTML = html;
    this.position(elem);
    this.tooltipEl.classList.add('tooltip-visible');
  },

  position(elem) {
    const rect = elem.getBoundingClientRect();
    const tipRect = this.tooltipEl.getBoundingClientRect();
    const pos = elem.getAttribute('data-tooltip-pos') || 'bottom';

    let top = 0;
    let left = 0;

    if (pos === 'top') {
      top = rect.top - tipRect.height - 8;
      left = rect.left + (rect.width - tipRect.width) / 2;
    } else if (pos === 'left') {
      top = rect.top + (rect.height - tipRect.height) / 2;
      left = rect.left - tipRect.width - 8;
    } else if (pos === 'right') {
      top = rect.top + (rect.height - tipRect.height) / 2;
      left = rect.right + 8;
    } else { // default bottom
      top = rect.bottom + 8;
      left = rect.left + (rect.width - tipRect.width) / 2;
    }

    // Viewport boundaries protection
    const pad = 8;
    if (left < pad) left = pad;
    if (left + tipRect.width > window.innerWidth - pad) {
      left = window.innerWidth - tipRect.width - pad;
    }
    if (top < pad) {
      top = rect.bottom + 8;
    }
    if (top + tipRect.height > window.innerHeight - pad) {
      top = rect.top - tipRect.height - 8;
    }

    this.tooltipEl.style.top = `${Math.round(top)}px`;
    this.tooltipEl.style.left = `${Math.round(left)}px`;
  }
};

