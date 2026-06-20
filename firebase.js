/**
 * BOOST – firebase.js
 * Firebase Realtime Database integration for online multiplayer.
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to https://console.firebase.google.com/
 * 2. Create a new project named "boost-card-game"
 * 3. Enable Realtime Database (start in test mode for development)
 * 4. Register a web app and copy the config object below
 * 5. Replace the placeholder values in FIREBASE_CONFIG with your actual config
 * 6. In Firebase console → Realtime Database → Rules, set:
 *    {
 *      "rules": {
 *        ".read": true,
 *        ".write": true
 *      }
 *    }
 *    (for production, add proper authentication rules)
 *
 * SECURITY NOTE:
 * For production, implement Firebase Security Rules and Authentication.
 * The config values below are intentionally placeholder – replace with your own.
 */

'use strict';

// ── Firebase Configuration ───────────────────────────────────────
// Replace with your actual Firebase project config
const FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL:       "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

// ── Firebase Module ──────────────────────────────────────────────
window.BoostFirebase = (function () {

  let _db   = null;
  let _app  = null;
  let _initialized = false;
  let _listeners = [];

  /**
   * Try to load Firebase SDK from CDN; fall back to offline-only mode.
   */
  async function init() {
    if (_initialized) return true;

    try {
      // Dynamically load Firebase (avoids hard dependency if offline)
      await _loadScript('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
      await _loadScript('https://www.gstatic.com/firebasejs/10.7.1/firebase-database-compat.js');

      if (!window.firebase) throw new Error('Firebase SDK not available');

      // Only initialize if config is provided (not placeholder)
      if (FIREBASE_CONFIG.apiKey === 'YOUR_API_KEY') {
        console.info('[BOOST] Firebase: running in offline/local mode (no config provided)');
        return false;
      }

      _app = firebase.initializeApp(FIREBASE_CONFIG);
      _db  = firebase.database();
      _initialized = true;
      console.info('[BOOST] Firebase: initialized ✓');
      return true;
    } catch (err) {
      console.warn('[BOOST] Firebase unavailable, running offline:', err.message);
      return false;
    }
  }

  function isOnline() { return _initialized && _db !== null; }

  // ── Room CRUD ─────────────────────────────────────────────────

  async function createRoom(roomCode, roomData) {
    if (!isOnline()) return { ok: false, error: 'offline' };
    try {
      await _db.ref(`rooms/${roomCode}`).set({
        ...roomData,
        createdAt: Date.now(),
        status: 'lobby'
      });
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  async function joinRoom(roomCode, playerData) {
    if (!isOnline()) return { ok: false, error: 'offline' };
    try {
      const snap = await _db.ref(`rooms/${roomCode}`).once('value');
      if (!snap.exists()) return { ok: false, error: 'Room not found' };
      const room = snap.val();
      if (room.status === 'playing') return { ok: false, error: 'Game already started' };
      const players = room.players || {};
      const count = Object.keys(players).length;
      if (count >= room.maxPlayers) return { ok: false, error: 'Room is full' };

      await _db.ref(`rooms/${roomCode}/players/${playerData.id}`).set({
        ...playerData,
        joinedAt: Date.now(),
        connected: true
      });
      return { ok: true, room };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  async function getRoom(roomCode) {
    if (!isOnline()) return null;
    try {
      const snap = await _db.ref(`rooms/${roomCode}`).once('value');
      return snap.exists() ? snap.val() : null;
    } catch { return null; }
  }

  async function updateRoomState(roomCode, updates) {
    if (!isOnline()) return;
    try { await _db.ref(`rooms/${roomCode}`).update(updates); } catch (e) { console.error(e); }
  }

  async function deleteRoom(roomCode) {
    if (!isOnline()) return;
    try { await _db.ref(`rooms/${roomCode}`).remove(); } catch (e) { console.error(e); }
  }

  // ── Game State Sync ───────────────────────────────────────────

  async function pushGameAction(roomCode, action) {
    if (!isOnline()) return;
    try {
      await _db.ref(`rooms/${roomCode}/actions`).push({
        ...action,
        timestamp: Date.now()
      });
    } catch (e) { console.error('[BOOST] pushGameAction error:', e); }
  }

  async function updatePlayerState(roomCode, playerId, state) {
    if (!isOnline()) return;
    try {
      await _db.ref(`rooms/${roomCode}/players/${playerId}`).update(state);
    } catch (e) { console.error(e); }
  }

  // ── Chat ──────────────────────────────────────────────────────

  async function sendChatMessage(roomCode, message) {
    if (!isOnline()) return;
    try {
      await _db.ref(`rooms/${roomCode}/chat`).push({
        ...message,
        timestamp: Date.now()
      });
    } catch (e) { console.error(e); }
  }

  // ── Leaderboard ───────────────────────────────────────────────

  async function submitScore(userId, username, score, period = 'alltime') {
    if (!isOnline()) return;
    try {
      const ref = _db.ref(`leaderboard/${period}/${userId}`);
      const snap = await ref.once('value');
      const existing = snap.val() || {};
      await ref.set({
        username,
        score: (existing.score || 0) + score,
        wins:  (existing.wins  || 0) + (score > 0 ? 1 : 0),
        updatedAt: Date.now()
      });
    } catch (e) { console.error(e); }
  }

  async function getLeaderboard(period = 'alltime', limit = 20) {
    if (!isOnline()) return [];
    try {
      const snap = await _db.ref(`leaderboard/${period}`)
        .orderByChild('score')
        .limitToLast(limit)
        .once('value');
      if (!snap.exists()) return [];
      const entries = [];
      snap.forEach(child => entries.unshift({ id: child.key, ...child.val() }));
      return entries;
    } catch { return []; }
  }

  // ── Presence ──────────────────────────────────────────────────

  function setupPresence(roomCode, playerId) {
    if (!isOnline()) return;
    const connRef  = _db.ref('.info/connected');
    const presRef  = _db.ref(`rooms/${roomCode}/players/${playerId}/connected`);
    connRef.on('value', snap => {
      if (snap.val()) {
        presRef.onDisconnect().set(false);
        presRef.set(true);
      }
    });
  }

  // ── Real-time Subscriptions ───────────────────────────────────

  function onRoomChange(roomCode, callback) {
    if (!isOnline()) return () => {};
    const ref = _db.ref(`rooms/${roomCode}`);
    ref.on('value', snap => callback(snap.exists() ? snap.val() : null));
    _listeners.push({ ref, event: 'value', callback });
    return () => ref.off('value');
  }

  function onNewAction(roomCode, callback) {
    if (!isOnline()) return () => {};
    const ref = _db.ref(`rooms/${roomCode}/actions`);
    ref.on('child_added', snap => callback(snap.val()));
    _listeners.push({ ref, event: 'child_added', callback });
    return () => ref.off('child_added');
  }

  function onChatMessage(roomCode, callback) {
    if (!isOnline()) return () => {};
    const ref = _db.ref(`rooms/${roomCode}/chat`);
    ref.limitToLast(1).on('child_added', snap => callback(snap.val()));
    return () => ref.off('child_added');
  }

  function unsubscribeAll() {
    _listeners.forEach(({ ref, event }) => ref.off(event));
    _listeners = [];
  }

  // ── Host Migration ────────────────────────────────────────────

  async function migrateHost(roomCode, newHostId) {
    if (!isOnline()) return;
    try { await _db.ref(`rooms/${roomCode}`).update({ hostId: newHostId }); } catch (e) { console.error(e); }
  }

  // ── Helpers ───────────────────────────────────────────────────

  function _loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload  = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // Public API
  return {
    init, isOnline,
    createRoom, joinRoom, getRoom, updateRoomState, deleteRoom,
    pushGameAction, updatePlayerState,
    sendChatMessage,
    submitScore, getLeaderboard,
    setupPresence,
    onRoomChange, onNewAction, onChatMessage, unsubscribeAll,
    migrateHost
  };
})();
