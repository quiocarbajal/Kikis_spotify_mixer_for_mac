/**
 * Kiki's Spotify Mixer - Client Application
 */

const state = {
  // Main Panel (Active Queue)
  tracks: [],
  selectedIds: new Set(),
  lastSelectedId: null,
  lastClickedIndex: 0,
  tags: [],
  activeTags: [],
  filterMode: 'AND',
  searchQuery: '',
  activeView: 'all',
  
  userCustomOrderIds: [],
  sortState: { column: 'order_index', direction: 'asc', isTemporary: false },
  isOrderLocked: false,
  isTrueShuffleActive: false,
  undoStack: [],
  
  // Right Panel (Dual Browser)
  rightTab: 'search', // 'search' or 'playlist'
  searchModifier: 'all', // 'all', 'track', 'artist', 'album'
  rightFilterTag: '',
  rightTracks: [],
  rightSelectedIds: new Set(),
  rightLastSelectedId: null,
  rightLastClickedIndex: 0,
  allPlaylists: [],
  
  // Player state
  playerState: null,
  currentPlayingTrackId: null,
  currentPlayingTrackTitle: null,
  autoScrollLocked: true,
  isMac: false,
  authenticated: false
};

const DOM = {
  searchInput: document.getElementById('search-input'),
  clearSearchBtn: document.getElementById('clear-search-btn'),
  syncBtn: document.getElementById('sync-btn'),
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
  tagsList: document.getElementById('tags-list'),
  playlistsList: document.getElementById('playlists-list'),
  filterModeRadios: document.querySelectorAll('input[name="filter-mode"]'),
  createTagSidebarBtn: document.getElementById('create-tag-sidebar-btn'),
  remoteUrlDisplay: document.getElementById('remote-url-display'),
  
  // Main Table & Toolbar
  tracksTbody: document.getElementById('tracks-tbody'),
  selectAllCheckbox: document.getElementById('select-all-checkbox'),
  trackCountBadge: document.getElementById('track-count-badge'),
  activeFilterChips: document.getElementById('active-filter-chips'),
  playActiveListBtn: document.getElementById('play-active-list-btn'),
  shuffleActiveListBtn: document.getElementById('shuffle-active-list-btn'),
  resetOrderBtn: document.getElementById('reset-order-btn'),
  saveOrderBtn: document.getElementById('save-order-btn'),
  lockOrderBtn: document.getElementById('lock-order-btn'),
  emptyState: document.getElementById('empty-state'),
  tableContainer: document.getElementById('table-container'),
  
  // Floating Batch Action Bar
  selectionActionBar: document.getElementById('selection-action-bar'),
  selectedCountText: document.getElementById('selected-count-text'),
  batchCreatePlaylistBtn: document.getElementById('batch-create-playlist-btn'),
  batchTagBtn: document.getElementById('batch-tag-btn'),
  batchRemoveTagsBtn: document.getElementById('batch-remove-tags-btn'),
  batchShuffleBtn: document.getElementById('batch-shuffle-btn'),
  clearSelectionBtn: document.getElementById('clear-selection-btn'),
  
  // Right Panel: Dual Source Browser & Spotify Search
  tabRightSearch: document.getElementById('tab-right-search'),
  tabRightPlaylist: document.getElementById('tab-right-playlist'),
  rightSearchControls: document.getElementById('right-search-controls'),
  rightPlaylistControls: document.getElementById('right-playlist-controls'),
  rightSearchInput: document.getElementById('right-search-input'),
  rightSearchSubmitBtn: document.getElementById('right-search-submit-btn'),
  searchModPills: document.querySelectorAll('.search-mod-pill'),
  rightPlaylistPicker: document.getElementById('right-playlist-picker'),
  rightTagPicker: document.getElementById('right-tag-picker'),
  rightSelectedText: document.getElementById('right-selected-text'),
  rightAddSelectedBtn: document.getElementById('right-add-selected-btn'),
  rightItemsContainer: document.getElementById('right-items-container'),
  
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
  tagModal: document.getElementById('tag-modal'),
  closeTagModal: document.getElementById('close-tag-modal'),
  cancelTagModal: document.getElementById('cancel-tag-modal'),
  applyTagModal: document.getElementById('apply-tag-modal'),
  modalTagsChecklist: document.getElementById('modal-tags-checklist'),
  newTagNameInput: document.getElementById('new-tag-name-input'),
  newTagColorInput: document.getElementById('new-tag-color-input'),
  createTagSubmitBtn: document.getElementById('create-tag-submit-btn'),
  tagSearchInput: document.getElementById('tag-search-input'),
  
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
  confirmModalColorInput: document.getElementById('confirm-modal-color-input'),
  confirmModalCancelBtn: document.getElementById('confirm-modal-cancel-btn'),
  confirmModalSubmitBtn: document.getElementById('confirm-modal-submit-btn'),
  
  // Context Menus
  customContextMenu: document.getElementById('custom-context-menu'),
  tagContextMenu: document.getElementById('tag-context-menu'),
  playlistContextMenu: document.getElementById('playlist-context-menu'),
  toastContainer: document.getElementById('toast-container')
};

let activeContextMenuTag = null;
let activeContextMenuPlaylist = null;
let confirmModalCallback = null;

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
  try { initEventListeners(); } catch (e) { console.error('initEventListeners error:', e); }
  try { initRightPanel(); } catch (e) { console.error('initRightPanel error:', e); }
  try { initPanelResizers(); } catch (e) { console.error('initPanelResizers error:', e); }
  try { await checkStatus(); } catch (e) {}
  try { await loadTags(); } catch (e) {}
  try { await loadPlaylists(); } catch (e) {}
  try { await loadTracks(); } catch (e) {}
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
    
    if (DOM.remoteUrlDisplay) {
      DOM.remoteUrlDisplay.textContent = data.access_url;
    }
    
    if (data.authenticated) {
      DOM.connectionBadge.className = 'status-badge status-online';
      DOM.statusText.textContent = 'Spotify Online';
      loadDevices();
    } else if (data.is_mac && data.mac_spotify_running) {
      DOM.connectionBadge.className = 'status-badge status-mac';
      DOM.statusText.textContent = 'Mac Local';
    } else {
      DOM.connectionBadge.className = 'status-badge status-offline';
      DOM.statusText.textContent = data.has_credentials ? 'Login Needed' : 'Setup Required';
    }
  } catch (e) {
    DOM.connectionBadge.className = 'status-badge status-offline';
    DOM.statusText.textContent = 'Offline';
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

// --- Tags Operations ---
async function loadTags() {
  try {
    const data = await api('/api/tags');
    state.tags = data.tags || [];
    
    // Automatically purge and deselect any deleted or non-existent tags
    const validTagNames = new Set(state.tags.map(t => t.name));
    state.activeTags = state.activeTags.filter(name => validTagNames.has(name));
    if (state.rightFilterTag && !validTagNames.has(state.rightFilterTag)) {
      state.rightFilterTag = '';
    }
    
    renderSidebarTags();
    renderFilterChips();
    populateRightTagPicker();
  } catch (e) {}
}

function populateRightTagPicker() {
  if (!DOM.rightTagPicker) return;
  const currentVal = DOM.rightTagPicker.value;
  DOM.rightTagPicker.innerHTML = '<option value="">🏷️ All Tags (Filter by Tag...)</option>';
  state.tags.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.name;
    opt.textContent = `#${t.name} (${t.track_count})`;
    if (t.name === currentVal) opt.selected = true;
    DOM.rightTagPicker.appendChild(opt);
  });
}

function renderSidebarTags() {
  DOM.tagsList.innerHTML = '';
  state.tags.forEach((tag, idx) => {
    const pill = document.createElement('div');
    pill.className = `tag-pill ${state.activeTags.includes(tag.name) ? 'active' : ''}`;
    pill.dataset.tag = tag.name;
    pill.dataset.index = idx;
    pill.draggable = true;

    // Drag-to-reorder tags vs Drag-songs-onto-tags
    pill.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('application/json', JSON.stringify({ type: 'tag', tagName: tag.name, index: idx }));
      pill.classList.add('dragging');
    });

    pill.addEventListener('dragend', () => {
      pill.classList.remove('dragging');
      document.querySelectorAll('.tag-pill').forEach(p => p.style.borderColor = '');
    });

    pill.addEventListener('dragover', (e) => {
      e.preventDefault();
      pill.style.borderColor = tag.color;
      pill.style.transform = 'scale(1.06)';
    });

    pill.addEventListener('dragleave', () => {
      pill.style.borderColor = '';
      pill.style.transform = '';
    });

    pill.addEventListener('drop', async (e) => {
      e.preventDefault();
      pill.style.borderColor = '';
      pill.style.transform = '';

      try {
        const raw = e.dataTransfer.getData('application/json');
        const data = raw ? JSON.parse(raw) : null;

        if (data && data.type === 'tag') {
          const fromIdx = data.index;
          const toIdx = idx;
          if (fromIdx !== toIdx) {
            const movedTag = state.tags.splice(fromIdx, 1)[0];
            state.tags.splice(toIdx, 0, movedTag);
            renderSidebarTags();
            await api('/api/tags/reorder', {
              method: 'POST',
              body: JSON.stringify({ tag_names: state.tags.map(t => t.name) })
            });
            showToast(`🏷️ Reordered tags`);
          }
          return;
        }
      } catch (err) {}

      // Dropping songs onto this tag!
      const draggedTrackIds = Array.from(state.selectedIds);
      if (draggedTrackIds.length > 0) {
        await api('/api/tags/assign', {
          method: 'POST',
          body: JSON.stringify({ track_ids: draggedTrackIds, tag_names: [tag.name] })
        });
        showToast(`🏷️ Tagged ${draggedTrackIds.length} tracks with #${tag.name}`);
        await loadTags();
        await loadTracks();
      }
    });

    // Right-Click Context Menu on Tag Pill (Rename, Change Color, Delete)
    pill.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openTagContextMenu(e.clientX, e.clientY, tag);
    });

    pill.innerHTML = `
      <span class="tag-dot" style="background-color: ${tag.color}"></span>
      <span class="tag-name">#${escapeHtml(tag.name)}</span>
      <span class="tag-count">(${tag.track_count})</span>
    `;

    pill.addEventListener('click', () => toggleTagFilter(tag.name));
    DOM.tagsList.appendChild(pill);
  });
}

function openTagContextMenu(x, y, tag) {
  activeContextMenuTag = tag;
  hideAllContextMenus();
  const menu = DOM.tagContextMenu;
  menu.style.left = `${Math.min(x, window.innerWidth - 190)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - 180)}px`;
  menu.classList.remove('hidden');
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
function showConfirmModal({ title, message, showInput = false, inputValue = '', inputLabel = 'Name:', showColor = false, colorValue = '#1DB954', confirmText = 'Confirm', onConfirm }) {
  DOM.confirmModalTitle.textContent = title;
  DOM.confirmModalMessage.textContent = message || '';
  
  if (showInput || showColor) {
    DOM.confirmModalInputGroup.classList.remove('hidden');
    DOM.confirmModalInputLabel.textContent = inputLabel;
    
    if (showInput) {
      DOM.confirmModalInput.classList.remove('hidden');
      DOM.confirmModalInput.value = inputValue;
    } else {
      DOM.confirmModalInput.classList.add('hidden');
    }
    
    if (showColor) {
      DOM.confirmModalColorInput.classList.remove('hidden');
      DOM.confirmModalColorInput.value = colorValue;
    } else {
      DOM.confirmModalColorInput.classList.add('hidden');
    }
  } else {
    DOM.confirmModalInputGroup.classList.add('hidden');
  }

  DOM.confirmModalSubmitBtn.textContent = confirmText;
  confirmModalCallback = onConfirm;
  DOM.confirmModal.classList.remove('hidden');
  if (showInput) DOM.confirmModalInput.focus();
}

function toggleTagFilter(tagName) {
  if (state.activeTags.includes(tagName)) {
    state.activeTags = state.activeTags.filter(t => t !== tagName);
  } else {
    state.activeTags.push(tagName);
  }
  renderSidebarTags();
  renderFilterChips();
  loadTracks();
}

function renderFilterChips() {
  DOM.activeFilterChips.innerHTML = '';
  if (state.activeTags.length === 0) return;

  state.activeTags.forEach((tagName, idx) => {
    const chip = document.createElement('div');
    chip.className = 'filter-chip';
    chip.innerHTML = `#${escapeHtml(tagName)} <span>✕</span>`;
    chip.addEventListener('click', () => toggleTagFilter(tagName));
    DOM.activeFilterChips.appendChild(chip);

    if (idx < state.activeTags.length - 1) {
      const modeSpan = document.createElement('span');
      modeSpan.style.fontSize = '11px';
      modeSpan.style.color = '#888';
      modeSpan.textContent = state.filterMode;
      DOM.activeFilterChips.appendChild(modeSpan);
    }
  });

  const clearBtn = document.createElement('button');
  clearBtn.className = 'btn btn-ghost btn-sm';
  clearBtn.style.padding = '1px 6px';
  clearBtn.style.fontSize = '10px';
  clearBtn.textContent = 'Clear Filter ✕';
  clearBtn.addEventListener('click', () => {
    state.activeTags = [];
    renderSidebarTags();
    renderFilterChips();
    loadTracks();
  });
  DOM.activeFilterChips.appendChild(clearBtn);
}

// --- Playlists Operations ---
async function loadPlaylists() {
  try {
    const data = await api('/api/playlists');
    state.allPlaylists = data.playlists || [];
    DOM.playlistsList.innerHTML = '';
    
    if (DOM.rightPlaylistPicker) {
      DOM.rightPlaylistPicker.innerHTML = '<option value="">Select Playlist to Browse...</option>';
    }

    state.allPlaylists.forEach(p => {
      if (DOM.rightPlaylistPicker) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.name} (${p.total_tracks} songs)`;
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
  } catch (e) {}
}

// --- Load Tracks for Current View (Main Center Panel) ---
async function loadTracks() {
  try {
    let url = '/api/tracks?';
    const params = new URLSearchParams();
    
    if (state.activeView === 'untagged') {
      params.append('untagged_only', 'true');
    } else if (state.activeView !== 'all') {
      params.append('playlist_id', state.activeView);
    }

    if (state.activeTags.length > 0) {
      params.append('tags', state.activeTags.join(','));
      params.append('filter_mode', state.filterMode);
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
  DOM.trackCountBadge.textContent = `${count} track${count === 1 ? '' : 's'} in active list`;
  const countAll = document.getElementById('count-all');
  if (countAll && state.activeView === 'all' && state.activeTags.length === 0 && !state.searchQuery) {
    countAll.textContent = count;
  }
}

// --- Render Table: Check | Num | Title | Artist | Tags | Album | Dur ---
function renderTracksTable() {
  DOM.tracksTbody.innerHTML = '';
  
  if (state.tracks.length === 0) {
    DOM.emptyState.classList.remove('hidden');
    return;
  } else {
    DOM.emptyState.classList.add('hidden');
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

    // Col 5: Tags (AFTER ARTIST as requested!)
    const tdTags = document.createElement('td');
    tdTags.className = 'col-tags';
    const tagWrap = document.createElement('div');
    tagWrap.className = 'row-tags-wrapper';
    (track.tags || []).forEach(t => {
      const badge = document.createElement('span');
      badge.className = 'mini-tag-badge';
      badge.style.backgroundColor = t.color || '#1DB954';
      badge.textContent = `#${t.name}`;
      tagWrap.appendChild(badge);
    });
    tdTags.appendChild(tagWrap);
    tr.appendChild(tdTags);

    // Col 6: Album
    const tdAlbum = document.createElement('td');
    tdAlbum.className = 'col-album';
    tdAlbum.innerHTML = `<span class="track-album">${escapeHtml(track.album)}</span>`;
    tr.appendChild(tdAlbum);

    // Col 7: Duration
    const tdDur = document.createElement('td');
    tdDur.className = 'col-duration';
    tdDur.textContent = formatDuration(track.duration_ms);
    tr.appendChild(tdDur);

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
}

// --- Active List Playback ---
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
    state.lastClickedIndex = index;
    state.lastSelectedId = trackId;
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
    DOM.selectedCountText.textContent = `🟢 ${count} track${count === 1 ? '' : 's'} selected`;
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
      const raw = e.dataTransfer.getData('application/json');
      const payload = raw ? JSON.parse(raw) : { source: 'main', tracks: draggedTrackData };
      
      if (payload.source === 'right') {
        insertTracksIntoMainPanel(payload.tracks, index);
      } else {
        const movedIds = payload.tracks.map(t => t.id);
        executeReorder(movedIds, index);
      }
    } catch (err) {
      if (draggedTrackData.length > 0) {
        executeReorder(draggedTrackData.map(t => t.id), index);
      }
    }
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
  state.undoStack.push(state.tracks.map(t => t.id));

  const remaining = state.tracks.filter(t => !movedIds.includes(t.id));
  const movedTracks = state.tracks.filter(t => movedIds.includes(t.id));
  const insertIdx = Math.min(targetIndex, remaining.length);
  remaining.splice(insertIdx, 0, ...movedTracks);
  state.tracks = remaining;

  state.userCustomOrderIds = state.tracks.map(t => t.id);
  renderTracksTable();

  try {
    await api('/api/playlists/reorder', {
      method: 'POST',
      body: JSON.stringify({
        playlist_id: state.activeView === 'all' ? 'liked_songs' : state.activeView,
        track_ids: state.userCustomOrderIds
      })
    });
    showToast(`💾 Reordered ${movedIds.length} track${movedIds.length === 1 ? '' : 's'}`);
  } catch (e) {}
}

async function insertTracksIntoMainPanel(newTracks, targetIndex) {
  if (!newTracks || newTracks.length === 0) return;
  state.undoStack.push(state.tracks.map(t => t.id));

  const insertIdx = (targetIndex !== undefined && targetIndex !== null) ? targetIndex : state.tracks.length;
  state.tracks.splice(insertIdx, 0, ...newTracks);
  state.userCustomOrderIds = state.tracks.map(t => t.id);
  renderTracksTable();

  // Save to DB
  for (const t of newTracks) {
    try {
      await api(`/api/playlists/${state.activeView === 'all' ? 'liked_songs' : state.activeView}/add-track`, {
        method: 'POST',
        body: JSON.stringify({ track_id: t.id })
      });
    } catch (e) {}
  }
  showToast(`➕ Added ${newTracks.length} song${newTracks.length === 1 ? '' : 's'} to main list!`);
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

  await api('/api/playlists/reorder', {
    method: 'POST',
    body: JSON.stringify({
      playlist_id: state.activeView === 'all' ? 'liked_songs' : state.activeView,
      track_ids: state.userCustomOrderIds
    })
  });
  showToast('💾 Saved sequence as new Custom User Order');
}

// --- Right Panel: Dual Source Browser & Spotify Search ---
let rightSearchTimeout = null;

function initRightPanel() {
  if (!DOM.tabRightSearch || !DOM.tabRightPlaylist) return;

  DOM.tabRightSearch.addEventListener('click', () => {
    state.rightTab = 'search';
    DOM.tabRightSearch.classList.add('active');
    DOM.tabRightPlaylist.classList.remove('active');
    DOM.rightSearchControls.classList.remove('hidden');
    DOM.rightPlaylistControls.classList.add('hidden');
    DOM.rightSearchInput.focus();
  });

  DOM.tabRightPlaylist.addEventListener('click', () => {
    state.rightTab = 'playlist';
    DOM.tabRightPlaylist.classList.add('active');
    DOM.tabRightSearch.classList.remove('active');
    DOM.rightPlaylistControls.classList.remove('hidden');
    DOM.rightSearchControls.classList.add('hidden');
    if (DOM.rightPlaylistPicker.value) {
      loadRightPlaylistTracks(DOM.rightPlaylistPicker.value);
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

  // Right Tag filter dropdown
  DOM.rightTagPicker?.addEventListener('change', (e) => {
    state.rightFilterTag = e.target.value;
    if (state.rightTab === 'playlist' && DOM.rightPlaylistPicker.value) {
      loadRightPlaylistTracks(DOM.rightPlaylistPicker.value);
    } else if (state.rightFilterTag) {
      loadTracksByTagRightPanel(state.rightFilterTag);
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
    let results = data.tracks || [];
    if (state.rightFilterTag) {
      results = results.filter(t => (t.tags || []).some(tag => tag.name === state.rightFilterTag));
    }
    state.rightTracks = results;
    renderRightItems();
  } catch (e) {
    DOM.rightItemsContainer.innerHTML = '<div class="search-placeholder-text">Error loading playlist.</div>';
  }
}

async function loadTracksByTagRightPanel(tagName) {
  DOM.rightItemsContainer.innerHTML = `<div class="search-placeholder-text">Loading #${tagName} songs...</div>`;
  try {
    const data = await api(`/api/tracks?tags=${encodeURIComponent(tagName)}`);
    state.rightTracks = data.tracks || [];
    renderRightItems();
  } catch (e) {
    DOM.rightItemsContainer.innerHTML = '<div class="search-placeholder-text">Error loading tagged songs.</div>';
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

    // Tags list for right panel
    let tagsHtml = '';
    if (track.tags && track.tags.length > 0) {
      tagsHtml = track.tags.map(t => `<span class="mini-tag-badge" style="background-color:${t.color || '#1DB954'}">#${t.name}</span>`).join('');
    }

    row.innerHTML = `
      ${imgHtml}
      <div class="right-item-meta">
        <div class="right-item-title">${escapeHtml(track.title)}</div>
        <div class="right-item-subtitle-row">
          <span class="right-item-artist">${escapeHtml(track.artist)}</span>
          <div class="right-item-tags">${tagsHtml}</div>
        </div>
      </div>
      <span class="right-item-dur">${formatDuration(track.duration_ms)}</span>
      <button class="right-item-add-btn" title="Add to main list">+ Add</button>
    `;

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
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('application/json', JSON.stringify({ source: 'right', tracks: moved }));
    });

    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
    });

    DOM.rightItemsContainer.appendChild(row);
  });
}

function handleRightRowClick(e, trackId, index) {
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
    state.rightLastClickedIndex = index;
    state.rightLastSelectedId = trackId;
  }
}

function updateRightSelectionUI() {
  const rows = DOM.rightItemsContainer.querySelectorAll('.right-item-row');
  rows.forEach(row => {
    const isSel = state.rightSelectedIds.has(row.dataset.trackId);
    row.classList.toggle('selected', isSel);
  });
  const count = state.rightSelectedIds.size;
  DOM.rightSelectedText.textContent = `${count} selected`;
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

// --- Create Spotify Playlist Modal ---
function openCreatePlaylistModal() {
  const count = state.selectedIds.size;
  DOM.createPlaylistCountHint.textContent = `Will create a playlist containing ${count} selected song${count === 1 ? '' : 's'}.`;
  DOM.newPlaylistName.value = `Kiki's Mix ${new Date().toLocaleDateString()}`;
  DOM.createPlaylistModal.classList.remove('hidden');
  DOM.newPlaylistName.focus();
}

async function handleCreateSpotifyPlaylist() {
  const name = DOM.newPlaylistName.value.trim();
  const desc = DOM.newPlaylistDesc.value.trim();
  const selectedTrackIds = Array.from(state.selectedIds);

  if (!name || selectedTrackIds.length === 0) return;

  DOM.confirmCreatePlaylistModal.disabled = true;
  DOM.confirmCreatePlaylistModal.textContent = 'Creating Playlist...';

  try {
    const res = await api('/api/playlists/create', {
      method: 'POST',
      body: JSON.stringify({
        name: name,
        description: desc,
        track_ids: selectedTrackIds
      })
    });
    showToast(`✅ Created Playlist "${name}" (${selectedTrackIds.length} songs)!`);
    DOM.createPlaylistModal.classList.add('hidden');
    await loadPlaylists();
  } catch (e) {
    showToast('Failed to create playlist: ' + e.message, 'error');
  } finally {
    DOM.confirmCreatePlaylistModal.disabled = false;
    DOM.confirmCreatePlaylistModal.textContent = 'Create & Sync to Spotify';
  }
}

// --- Tag Assignment Modal ---
function openTagModal() {
  DOM.modalTagsChecklist.innerHTML = '';
  const selectedTrackObjects = state.tracks.filter(t => state.selectedIds.has(t.id));
  const totalSelected = selectedTrackObjects.length;

  state.tags.forEach(tag => {
    const countWithTag = selectedTrackObjects.filter(t => 
      (t.tags || []).some(tt => tt.name === tag.name)
    ).length;

    const row = document.createElement('div');
    row.className = 'modal-tag-row';
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.value = tag.name;

    if (countWithTag === totalSelected && totalSelected > 0) {
      chk.checked = true;
    } else if (countWithTag > 0) {
      chk.indeterminate = true;
    }

    row.innerHTML = `
      <span class="tag-dot" style="background-color: ${tag.color}"></span>
      <span style="flex:1; font-size:12px; font-weight:500;">#${escapeHtml(tag.name)}</span>
      <span style="font-size:11px; color:#888;">(${countWithTag}/${totalSelected})</span>
    `;
    row.prepend(chk);
    DOM.modalTagsChecklist.appendChild(row);
  });

  DOM.tagModal.classList.remove('hidden');
  DOM.newTagNameInput.focus();
}

async function applyTagModalChanges() {
  const selectedTrackIds = Array.from(state.selectedIds);
  if (selectedTrackIds.length === 0) return;

  const toAdd = [];
  const toRemove = [];

  const checkboxes = DOM.modalTagsChecklist.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(chk => {
    if (chk.checked) toAdd.push(chk.value);
    else if (!chk.indeterminate) toRemove.push(chk.value);
  });

  if (toAdd.length > 0) {
    await api('/api/tags/assign', {
      method: 'POST',
      body: JSON.stringify({ track_ids: selectedTrackIds, tag_names: toAdd })
    });
  }
  if (toRemove.length > 0) {
    await api('/api/tags/remove', {
      method: 'POST',
      body: JSON.stringify({ track_ids: selectedTrackIds, tag_names: toRemove })
    });
  }

  showToast(`✅ Updated tags for ${selectedTrackIds.length} tracks`);
  DOM.tagModal.classList.add('hidden');
  await loadTags();
  await loadTracks();
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
  DOM.tagContextMenu?.classList.add('hidden');
  DOM.playlistContextMenu?.classList.add('hidden');
}

// --- Event Listeners Setup ---
function initEventListeners() {
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

  DOM.filterModeRadios?.forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.filterMode = e.target.value;
      renderFilterChips();
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
  DOM.batchCreatePlaylistBtn?.addEventListener('click', openCreatePlaylistModal);
  DOM.batchTagBtn?.addEventListener('click', openTagModal);
  DOM.batchRemoveTagsBtn?.addEventListener('click', async () => {
    const ids = Array.from(state.selectedIds);
    const allTagNames = state.tags.map(t => t.name);
    await api('/api/tags/remove', {
      method: 'POST',
      body: JSON.stringify({ track_ids: ids, tag_names: allTagNames })
    });
    showToast(`❌ Removed tags from ${ids.length} tracks`);
    await loadTags();
    await loadTracks();
  });

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

  // Sync Library Button
  DOM.syncBtn?.addEventListener('click', async () => {
    DOM.syncBtn.disabled = true;
    DOM.syncBtn.innerHTML = '<span>🔄</span> Syncing...';
    try {
      const res = await api('/api/sync', { method: 'POST' });
      showToast(`✅ Synced ${res.liked_count} tracks and all playlists!`);
      await loadTags();
      await loadPlaylists();
      await loadTracks();
    } catch (e) {
      showToast('Sync error: ' + e.message, 'error');
    } finally {
      DOM.syncBtn.disabled = false;
      DOM.syncBtn.innerHTML = '<span>🔄</span> Sync Library';
    }
  });

  // Modals
  DOM.closeCreatePlaylistModal?.addEventListener('click', () => DOM.createPlaylistModal.classList.add('hidden'));
  DOM.cancelCreatePlaylistModal?.addEventListener('click', () => DOM.createPlaylistModal.classList.add('hidden'));
  DOM.confirmCreatePlaylistModal?.addEventListener('click', handleCreateSpotifyPlaylist);

  DOM.closeTagModal?.addEventListener('click', () => DOM.tagModal.classList.add('hidden'));
  DOM.cancelTagModal?.addEventListener('click', () => DOM.tagModal.classList.add('hidden'));
  DOM.applyTagModal?.addEventListener('click', applyTagModalChanges);

  DOM.createTagSidebarBtn?.addEventListener('click', openTagModal);
  DOM.createTagSubmitBtn?.addEventListener('click', async () => {
    const name = DOM.newTagNameInput.value.trim();
    const color = DOM.newTagColorInput.value;
    if (name) {
      if (state.tags.some(t => t.name.toLowerCase() === name.toLowerCase())) {
        showToast(`Tag #${name} already exists`, 'error');
        return;
      }
      await api('/api/tags', { method: 'POST', body: JSON.stringify({ name, color }) });
      DOM.newTagNameInput.value = '';
      showToast(`🏷️ Created tag #${name}`);
      await loadTags();
      openTagModal();
    }
  });

  // Tag Context Menu Actions (Rename, Change Color, Delete) with Confirmation Dialog
  document.getElementById('ctx-tag-rename')?.addEventListener('click', () => {
    if (!activeContextMenuTag) return;
    const tag = activeContextMenuTag;
    showConfirmModal({
      title: `✏️ Rename Tag #${tag.name}`,
      message: `Enter the new name for tag #${tag.name}:`,
      showInput: true,
      inputValue: tag.name,
      inputLabel: 'New Tag Name:',
      confirmText: 'Rename Tag',
      onConfirm: async () => {
        const newName = DOM.confirmModalInput.value.trim();
        if (newName && newName !== tag.name) {
          try {
            await api('/api/tags/rename', {
              method: 'POST',
              body: JSON.stringify({ old_name: tag.name, new_name: newName })
            });
            showToast(`✏️ Renamed tag to #${newName}`);
            DOM.confirmModal.classList.add('hidden');
            await loadTags();
            await loadTracks();
          } catch (e) {
            showToast(e.message, 'error');
          }
        }
      }
    });
  });

  document.getElementById('ctx-tag-color')?.addEventListener('click', () => {
    if (!activeContextMenuTag) return;
    const tag = activeContextMenuTag;
    showConfirmModal({
      title: `🎨 Change Color for #${tag.name}`,
      message: `Pick a new badge color for #${tag.name}:`,
      showColor: true,
      colorValue: tag.color || '#1DB954',
      confirmText: 'Save Color',
      onConfirm: async () => {
        const newColor = DOM.confirmModalColorInput.value;
        try {
          await api('/api/tags', {
            method: 'POST',
            body: JSON.stringify({ name: tag.name, color: newColor })
          });
          showToast(`🎨 Updated color for #${tag.name}`);
          DOM.confirmModal.classList.add('hidden');
          await loadTags();
          await loadTracks();
        } catch (e) {
          showToast(e.message, 'error');
        }
      }
    });
  });

  document.getElementById('ctx-tag-delete')?.addEventListener('click', () => {
    if (!activeContextMenuTag) return;
    const tag = activeContextMenuTag;
    showConfirmModal({
      title: `🗑️ Delete Tag #${tag.name}`,
      message: `Are you sure you want to delete tag #${tag.name}? This will remove it from all tracks.`,
      confirmText: 'Yes, Delete Tag',
      onConfirm: async () => {
        try {
          await api(`/api/tags?name=${encodeURIComponent(tag.name)}`, { method: 'DELETE' });
          showToast(`🗑️ Deleted tag #${tag.name}`);
          DOM.confirmModal.classList.add('hidden');
          await loadTags();
          await loadTracks();
        } catch (e) {
          showToast(e.message, 'error');
        }
      }
    });
  });

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
  document.getElementById('ctx-make-playlist')?.addEventListener('click', openCreatePlaylistModal);
  document.getElementById('ctx-assign-tags')?.addEventListener('click', openTagModal);

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

    if (e.code === 'Space') {
      e.preventDefault();
      DOM.ctrlPlaypause?.click();
    } else if (e.key === 'Escape') {
      state.selectedIds.clear();
      updateSelectionUI();
      DOM.tagModal?.classList.add('hidden');
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
    } else if (e.key.toLowerCase() === 't' && state.selectedIds.size > 0) {
      e.preventDefault();
      openTagModal();
    } else if (e.key === '/') {
      e.preventDefault();
      DOM.searchInput?.focus();
    }
  });
}

function handleUndo() {
  if (state.undoStack.length > 0) {
    const prevOrder = state.undoStack.pop();
    const map = new Map(state.tracks.map(t => [t.id, t]));
    state.tracks = prevOrder.map(id => map.get(id)).filter(Boolean);
    state.userCustomOrderIds = state.tracks.map(t => t.id);
    renderTracksTable();
    showToast('↩️ Undid last order change');
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
