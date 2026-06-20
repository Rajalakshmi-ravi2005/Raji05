/**
 * BOOST – The Ultimate Card Passing Party Game
 * script.js  |  Full game engine + UI controller
 *
 * Architecture:
 *   BoostApp     – Screen router, settings, PWA install
 *   BoostProfile – Player profile, XP, achievements
 *   BoostGame    – Core game engine (rules, AI, modes)
 *   BoostUI      – DOM rendering helpers
 *   BoostAudio   – Web Audio API sound engine
 *   BoostChat    – In-game chat
 */

'use strict';

/* ================================================================
   CONSTANTS & DATA
   ================================================================ */

const CATEGORIES = {
  colors:     { emoji: '🎨', items: ['❤️ Red','🔵 Blue','💚 Green','💛 Yellow','🟣 Purple','🟠 Orange','⚪ White','🖤 Black'] },
  flowers:    { emoji: '🌸', items: ['🌹 Rose','🌻 Sunflower','🌺 Hibiscus','🌼 Daisy','💐 Tulip','🪷 Lotus','🌷 Poppy','🌸 Cherry'] },
  fruits:     { emoji: '🍎', items: ['🍎 Apple','🍌 Banana','🍓 Strawberry','🍊 Orange','🍇 Grapes','🥭 Mango','🍍 Pineapple','🍑 Peach'] },
  animals:    { emoji: '🦁', items: ['🦁 Lion','🐯 Tiger','🐘 Elephant','🦊 Fox','🐺 Wolf','🦅 Eagle','🐉 Dragon','🐬 Dolphin'] },
  actors:     { emoji: '🎭', items: ['Amitabh','Rajinikanth','Tom Cruise','Brad Pitt','DiCaprio','Dwayne','Shahrukh','Salman'] },
  actresses:  { emoji: '🌟', items: ['Deepika','Priyanka','Scarlett','Meryl','Aishwarya','Angelina','Kareena','Katrina'] },
  chocolates: { emoji: '🍫', items: ['🍫 Kitkat','🍬 Dairy Milk','🍭 Snickers','🍦 Twix','🎂 Bounty','🧁 Mars','🍮 Toblerone','🍩 Oreo'] },
  cars:       { emoji: '🚗', items: ['🚗 Ferrari','🏎️ Lamborghini','🚙 BMW','🚕 Mercedes','🛻 Audi','🚌 Porsche','🚎 Tesla','🏍️ Bentley'] },
  countries:  { emoji: '🌍', items: ['🇮🇳 India','🇺🇸 USA','🇬🇧 UK','🇫🇷 France','🇩🇪 Germany','🇯🇵 Japan','🇨🇳 China','🇧🇷 Brazil'] },
};

const MODES = {
  classic:  { label: '🎮 Classic',  timerEnabled: false, chaos: false },
  speed:    { label: '⚡ Speed',    timerEnabled: true,  chaos: false, timerSec: 20 },
  survival: { label: '💀 Survival', timerEnabled: false, chaos: false, survival: true },
  chaos:    { label: '🌀 Chaos',    timerEnabled: false, chaos: true  },
  team:     { label: '👥 Team',     timerEnabled: false, chaos: false, teams: true },
  custom:   { label: '🔧 Custom',   timerEnabled: false, chaos: false, custom: true },
};

const CHAOS_EVENTS = [
  { id: 'reverse',   text: '🔄 Direction Reversed!',       emoji: '🔄' },
  { id: 'swap',      text: '🔀 Hands Swapped with Neighbour!', emoji: '🔀' },
  { id: 'skip',      text: '⏭️ Next Player Skipped!',       emoji: '⏭️' },
  { id: 'doublepass',text: '✌️ Pass TWO cards this turn!',  emoji: '✌️' },
  { id: 'shuffle',   text: '🃏 All cards reshuffled!',      emoji: '🃏' },
];

const ACHIEVEMENTS_DEF = [
  { id: 'first_win',       icon: '🏆', name: 'First Win',          desc: 'Win your first game' },
  { id: 'wins_10',         icon: '🥇', name: 'On a Roll',          desc: 'Win 10 games' },
  { id: 'wins_100',        icon: '💯', name: 'Century',            desc: 'Win 100 games' },
  { id: 'fastest_boost',   icon: '⚡', name: 'Lightning BOOST',    desc: 'Win in under 30 seconds' },
  { id: 'perfect_game',    icon: '✨', name: 'Perfect Game',       desc: 'Win without any warnings' },
  { id: 'tournament_champ',icon: '🏅', name: 'Tournament Champ',   desc: 'Win a tournament' },
  { id: 'social_butterfly',icon: '🦋', name: 'Social Butterfly',   desc: 'Send 50 chat messages' },
  { id: 'ai_slayer',       icon: '🤖', name: 'AI Slayer',          desc: 'Beat Expert AI' },
  { id: 'chaos_master',    icon: '🌀', name: 'Chaos Master',       desc: 'Win a Chaos mode game' },
  { id: 'speed_demon',     icon: '💨', name: 'Speed Demon',        desc: 'Win a Speed mode game' },
];

const XP_LEVELS = [0,100,250,500,900,1500,2500,4000,6000,9000,13000];

/* ================================================================
   UTILITY FUNCTIONS
   ================================================================ */

const $ = id => document.getElementById(id);
const $q = sel => document.querySelector(sel);

function generateRoomCode() {
  return Math.random().toString(36).substring(2,8).toUpperCase();
}

function generateId() {
  return '_' + Math.random().toString(36).substr(2,9);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ================================================================
   AUDIO ENGINE
   ================================================================ */

const BoostAudio = (() => {
  let _ctx  = null;
  let _mute = false;
  let _vol  = 0.7;

  function _ctx_() {
    if (!_ctx) {
      try { _ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
    }
    return _ctx;
  }

  function play(type) {
    if (_mute) return;
    const ctx = _ctx_();
    if (!ctx) return;

    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const configs = {
      card:    { freq: [440,550],         dur: .12, wave: 'sine',     vol: .3 },
      boost:   { freq: [330,660,990],     dur: .6,  wave: 'sawtooth', vol: .6 },
      win:     { freq: [523,659,784,1047],dur: .8,  wave: 'sine',     vol: .5 },
      error:   { freq: [200,150],         dur: .3,  wave: 'sawtooth', vol: .4 },
      warning: { freq: [440,380],         dur: .25, wave: 'square',   vol: .3 },
      chaos:   { freq: [200,400,300,500], dur: .5,  wave: 'sawtooth', vol: .4 },
      click:   { freq: [600],             dur: .08, wave: 'sine',     vol: .2 },
    };

    const cfg = configs[type] || configs.click;
    osc.type = cfg.wave;
    gain.gain.setValueAtTime(cfg.vol * _vol, ctx.currentTime);

    const freqs = cfg.freq;
    const step  = cfg.dur / freqs.length;
    freqs.forEach((f, i) => {
      osc.frequency.setValueAtTime(f, ctx.currentTime + i * step);
    });

    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + cfg.dur);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + cfg.dur);
  }

  function setMute(v) { _mute = v; }
  function setVolume(v) { _vol = v / 100; }

  return { play, setMute, setVolume };
})();

/* ================================================================
   PROFILE & PERSISTENCE
   ================================================================ */

const BoostProfile = (() => {
  const KEY = 'boost_profile_v2';

  const defaults = () => ({
    id:           generateId(),
    username:     'Player',
    avatar:       '🎮',
    wins:         0,
    losses:       0,
    boosts:       0,
    cardsP:       0,
    tournaments:  0,
    chatMsgs:     0,
    xp:           0,
    level:        1,
    coins:        100,
    achievements: {},
    recentRooms:  [],
    settings: {
      darkMode:      true,
      largeText:     false,
      colorBlind:    false,
      reduceMotion:  false,
      music:         true,
      sfx:           true,
      volume:        70,
      language:      'en',
    },
    stats: {
      avgReactionMs:  0,
      totalGames:     0,
      fastestWinMs:   null,
    }
  });

  let _data = null;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      _data = raw ? { ...defaults(), ...JSON.parse(raw) } : defaults();
    } catch {
      _data = defaults();
    }
    return _data;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(_data)); } catch {}
  }

  function get() { return _data || load(); }

  function update(partial) {
    _data = { ..._data, ...partial };
    save();
  }

  function addXP(amount) {
    _data.xp += amount;
    // Level up
    for (let lv = XP_LEVELS.length - 1; lv >= 1; lv--) {
      if (_data.xp >= XP_LEVELS[lv]) { _data.level = lv + 1; break; }
    }
    save();
  }

  function addCoins(amount) { _data.coins += amount; save(); }

  function unlockAchievement(id) {
    if (_data.achievements[id]) return false;
    _data.achievements[id] = Date.now();
    save();
    return true;
  }

  function addRecentRoom(roomCode, roomName) {
    const existing = _data.recentRooms.filter(r => r.code !== roomCode);
    _data.recentRooms = [{ code: roomCode, name: roomName, ts: Date.now() }, ...existing].slice(0,5);
    save();
  }

  function checkAchievements(context) {
    const earned = [];
    const p = _data;
    if (context.win) {
      if (p.wins === 1) { if (unlockAchievement('first_win')) earned.push('first_win'); }
      if (p.wins >= 10) { if (unlockAchievement('wins_10'))   earned.push('wins_10');   }
      if (p.wins >= 100){ if (unlockAchievement('wins_100'))  earned.push('wins_100');  }
    }
    if (context.gameMode === 'chaos' && context.win) {
      if (unlockAchievement('chaos_master')) earned.push('chaos_master');
    }
    if (context.gameMode === 'speed' && context.win) {
      if (unlockAchievement('speed_demon')) earned.push('speed_demon');
    }
    if (context.win && context.durationMs < 30000) {
      if (unlockAchievement('fastest_boost')) earned.push('fastest_boost');
    }
    if (context.win && context.warnings === 0) {
      if (unlockAchievement('perfect_game')) earned.push('perfect_game');
    }
    if (context.aiWin) {
      if (unlockAchievement('ai_slayer')) earned.push('ai_slayer');
    }
    if (context.tournament) {
      if (unlockAchievement('tournament_champ')) earned.push('tournament_champ');
    }
    return earned;
  }

  return { load, save, get, update, addXP, addCoins, unlockAchievement, addRecentRoom, checkAchievements };
})();

/* ================================================================
   GAME ENGINE
   ================================================================ */

const BoostGame = (() => {

  /* ── State ──────────────────────────────────────────────────── */
  let _state = null;  // active game state

  /**
   * Build a fresh game state from options.
   * @param {object} opts
   */
  function createGame(opts) {
    const {
      players,          // [{id, name, avatar, isBot, aiDiff}]
      category = 'colors',
      customItems = [],
      mode = 'classic',
      direction = 'clockwise',
      maxPlayers = players.length,
    } = opts;

    // Build item list
    let items = category === 'custom'
      ? customItems.filter(Boolean).slice(0, 8)
      : CATEGORIES[category].items;

    // We need at least ceil(players.length/3) categories, each ×3
    const needed = Math.ceil(players.length * 3 / 3);
    if (items.length < needed) {
      // pad by repeating
      while (items.length < needed) items = [...items, ...items];
    }
    items = items.slice(0, Math.ceil((players.length * 3 + 1) / 3)); // +1 for BOOST

    // Build deck: each item ×3
    let deck = [];
    items.forEach(item => {
      deck.push({ id: generateId(), type: item, isBoost: false });
      deck.push({ id: generateId(), type: item, isBoost: false });
      deck.push({ id: generateId(), type: item, isBoost: false });
    });

    // Add BOOST card
    deck.push({ id: 'BOOST_CARD', type: '⚡ BOOST', isBoost: true });

    // Shuffle & deal 3 cards to each player (+BOOST card to one)
    deck = shuffle(deck);
    const boostIdx = deck.findIndex(c => c.isBoost);

    const playerStates = players.map((p, i) => ({
      ...p,
      hand:       [],
      warnings:   0,
      eliminated: false,
      cardsP:     0,
      lastReceived: null,
      hasBoost:   false,
    }));

    // Deal 3 cards per player
    let deckPtr = 0;
    playerStates.forEach(p => {
      // skip BOOST position
      for (let c = 0; c < 3; c++) {
        while (deck[deckPtr].isBoost) deckPtr++;
        p.hand.push(deck[deckPtr++]);
      }
    });

    // Give BOOST to random player
    const boostHolder = Math.floor(Math.random() * players.length);
    playerStates[boostHolder].hand.push(deck[boostIdx]);
    playerStates[boostHolder].hasBoost = true;

    const state = {
      gameId:        generateId(),
      mode,
      direction,     // 'clockwise' | 'counterclockwise' | 'random'
      category,
      players:       playerStates,
      currentTurnIdx: 0,
      round:         1,
      startTime:     Date.now(),
      status:        'playing', // 'playing' | 'finished'
      winner:        null,
      events:        [],
      chaosQueue:    [],
      timerSec:      MODES[mode]?.timerSec || 30,
      eliminationOrder: [],
    };

    _state = state;
    return state;
  }

  function getState() { return _state; }

  /**
   * Execute a card pass: playerIdx passes cardId to targetIdx.
   * Returns { ok, error, events }
   */
  function passCard(fromIdx, cardId, toIdx) {
    const s = _state;
    if (!s || s.status !== 'playing') return { ok: false, error: 'Game not active' };

    const from = s.players[fromIdx];
    const to   = s.players[toIdx];

    if (from.eliminated) return { ok: false, error: 'You are eliminated' };
    if (to.eliminated)   return { ok: false, error: 'Target is eliminated' };

    const cardIdx = from.hand.findIndex(c => c.id === cardId);
    if (cardIdx === -1) return { ok: false, error: 'Card not found in your hand' };

    const card = from.hand[cardIdx];

    // Anti-cheat: cannot immediately pass back last received card
    if (from.lastReceived && from.lastReceived.id === cardId) {
      return { ok: false, error: 'Cannot pass back the card you just received!' };
    }

    // Remove from sender
    from.hand.splice(cardIdx, 1);
    from.cardsP++;

    // Add to receiver
    to.hand.push(card);
    to.lastReceived = card;

    // Update BOOST ownership
    if (card.isBoost) {
      from.hasBoost = false;
      to.hasBoost   = true;
      s.events.push({ type: 'boost_moved', from: from.name, to: to.name });
    }

    s.events.push({ type: 'card_passed', from: fromIdx, to: toIdx, card });

    // Check for winner (3 identical cards)
    const winCheck = _checkWinner(to);
    if (winCheck) {
      // They have 3 of a kind – BOOST button should light up for them
      return { ok: true, readyToBoost: toIdx, events: s.events };
    }

    return { ok: true, events: s.events };
  }

  /**
   * Player presses BOOST button.
   */
  function pressBoost(playerIdx) {
    const s = _state;
    if (!s || s.status !== 'playing') return { ok: false, error: 'Game not active' };

    const player = s.players[playerIdx];
    if (player.eliminated) return { ok: false, error: 'You are eliminated' };

    const triple = _checkWinner(player);
    if (triple) {
      // Valid BOOST!
      s.status = 'finished';
      s.winner = playerIdx;
      s.endTime = Date.now();
      s.winnerCards = triple;
      return { ok: true, valid: true, winner: player, cards: triple };
    } else {
      // False BOOST – eliminate player
      player.eliminated = true;
      s.eliminationOrder.push(playerIdx);
      s.events.push({ type: 'false_boost', player: player.name });

      const activePlayers = s.players.filter(p => !p.eliminated);
      if (activePlayers.length === 1) {
        s.status  = 'finished';
        s.winner  = s.players.indexOf(activePlayers[0]);
        s.endTime = Date.now();
      }
      return { ok: true, valid: false, eliminated: true };
    }
  }

  /**
   * Add a warning to a player.
   */
  function addWarning(playerIdx) {
    const s = _state;
    const player = s.players[playerIdx];
    player.warnings++;
    if (player.warnings >= 3) {
      player.eliminated = true;
      s.eliminationOrder.push(playerIdx);
      return { eliminated: true };
    }
    return { warnings: player.warnings };
  }

  /**
   * Get valid pass targets for a player given current direction.
   */
  function getValidTargets(fromIdx) {
    const s = _state;
    const active = s.players
      .map((p, i) => ({ p, i }))
      .filter(({ p, i }) => !p.eliminated && i !== fromIdx);

    let dir = s.direction;
    if (dir === 'random') dir = Math.random() < .5 ? 'clockwise' : 'counterclockwise';

    if (dir === 'clockwise') {
      // next active player clockwise
      const n = s.players.length;
      let next = (fromIdx + 1) % n;
      while (next !== fromIdx && s.players[next].eliminated) next = (next + 1) % n;
      return [next];
    } else {
      // counterclockwise
      const n = s.players.length;
      let prev = (fromIdx - 1 + n) % n;
      while (prev !== fromIdx && s.players[prev].eliminated) prev = (prev - 1 + n) % n;
      return [prev];
    }
  }

  /**
   * Trigger a chaos event.
   */
  function triggerChaosEvent() {
    const s = _state;
    const evt = CHAOS_EVENTS[Math.floor(Math.random() * CHAOS_EVENTS.length)];
    s.events.push({ type: 'chaos', event: evt });

    switch (evt.id) {
      case 'reverse':
        s.direction = s.direction === 'clockwise' ? 'counterclockwise' : 'clockwise';
        break;
      case 'swap': {
        // Swap hands of two random adjacent players
        const active = s.players.map((p,i) => ({p,i})).filter(x => !x.p.eliminated);
        if (active.length >= 2) {
          const [a, b] = shuffle(active).slice(0,2);
          [a.p.hand, b.p.hand] = [b.p.hand, a.p.hand];
        }
        break;
      }
      case 'skip':
        // Advance currentTurnIdx by 2
        s.currentTurnIdx = _nextActive(s.currentTurnIdx, 2);
        break;
      case 'doublepass':
        s.events.push({ type: 'double_pass_active' });
        break;
      case 'shuffle': {
        // Collect all cards, reshuffle, redistribute
        let allCards = [];
        s.players.forEach(p => { allCards = allCards.concat(p.hand); p.hand = []; });
        allCards = shuffle(allCards);
        let ptr = 0;
        s.players.forEach(p => {
          if (!p.eliminated) {
            p.hand.push(allCards[ptr++]);
            p.hand.push(allCards[ptr++] || allCards[0]);
            p.hand.push(allCards[ptr++] || allCards[0]);
          }
        });
        // fix BOOST tracking
        s.players.forEach(p => { p.hasBoost = p.hand.some(c => c.isBoost); });
        break;
      }
    }

    return evt;
  }

  /* ── AI Player ───────────────────────────────────────────────── */

  /**
   * AI decides which card to pass and to whom.
   */
  async function aiTakeTurn(playerIdx, difficulty = 'medium') {
    const s = _state;
    const player = s.players[playerIdx];
    const targets = getValidTargets(playerIdx);
    const toIdx   = targets[0];

    // Delay based on difficulty
    const delays = { easy: 2000, medium: 1200, hard: 600, expert: 300 };
    const baseDelay = delays[difficulty] || 1200;
    await sleep(baseDelay + Math.random() * 500);

    if (player.hand.length === 0) return null;

    // Expert/Hard: strategic – keep the type we have most of
    // Easy/Medium: random with occasional mistakes
    let cardToPass;

    const typeCounts = {};
    player.hand.forEach(c => {
      if (!c.isBoost) typeCounts[c.type] = (typeCounts[c.type] || 0) + 1;
    });

    const sortedTypes = Object.entries(typeCounts).sort((a,b) => b[1]-a[1]);
    const keepType = sortedTypes[0]?.[0];

    if (difficulty === 'easy') {
      // Easy: mostly random, sometimes mistakes
      cardToPass = player.hand[Math.floor(Math.random() * player.hand.length)];
    } else if (difficulty === 'medium') {
      // Medium: prefer to pass cards not matching most common type
      const expendable = player.hand.filter(c => c.type !== keepType && !c.isBoost);
      cardToPass = expendable.length > 0
        ? expendable[Math.floor(Math.random() * expendable.length)]
        : player.hand[Math.floor(Math.random() * player.hand.length)];
    } else {
      // Hard/Expert: always pass the card that helps least; keep the pair
      const expendable = player.hand.filter(c => c.type !== keepType && !c.isBoost);
      if (expendable.length > 0) {
        cardToPass = expendable[0];
      } else {
        // Pass BOOST if only option
        cardToPass = player.hand.find(c => c.isBoost) || player.hand[0];
      }
    }

    // Avoid passing lastReceived (rule check)
    if (player.lastReceived && cardToPass.id === player.lastReceived.id) {
      const alt = player.hand.find(c => c.id !== cardToPass.id);
      if (alt) cardToPass = alt;
    }

    return { cardId: cardToPass.id, toIdx };
  }

  /**
   * Check if AI should press BOOST.
   */
  function aiShouldBoost(playerIdx) {
    return _checkWinner(_state.players[playerIdx]) !== null;
  }

  /* ── Internal Helpers ────────────────────────────────────────── */

  function _checkWinner(player) {
    const nonBoost = player.hand.filter(c => !c.isBoost);
    const counts = {};
    nonBoost.forEach(c => { counts[c.type] = (counts[c.type] || 0) + 1; });
    for (const [type, cnt] of Object.entries(counts)) {
      if (cnt >= 3) return nonBoost.filter(c => c.type === type).slice(0,3);
    }
    return null;
  }

  function _nextActive(fromIdx, steps = 1) {
    const s = _state;
    const n = s.players.length;
    let idx = fromIdx;
    for (let i = 0; i < steps; i++) {
      idx = (idx + 1) % n;
      while (s.players[idx].eliminated) idx = (idx + 1) % n;
    }
    return idx;
  }

  function nextTurn() {
    const s = _state;
    s.currentTurnIdx = _nextActive(s.currentTurnIdx);
  }

  function reset() { _state = null; }

  return {
    createGame, getState, passCard, pressBoost, addWarning,
    getValidTargets, triggerChaosEvent, aiTakeTurn, aiShouldBoost,
    nextTurn, reset,
  };
})();

/* ================================================================
   SCREEN ROUTER
   ================================================================ */

const BoostApp = (() => {
  let _current   = 'screen-splash';
  let _deferredInstall = null;
  let _firebaseOk      = false;
  let _unsubRoomFns    = [];

  /* ── Init ─────────────────────────────────────────────────────── */
  async function init() {
    BoostProfile.load();
    _applySettings();
    _bindGlobalEvents();

    // Firebase (non-blocking)
    BoostFirebase.init().then(ok => { _firebaseOk = ok; });

    // Service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js')
        .catch(err => console.warn('[SW] Registration failed:', err));
    }

    // PWA install prompt
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      _deferredInstall = e;
      $('install-banner').classList.remove('hidden');
    });

    // Simulate splash loading
    await sleep(2800);
    navigateTo('screen-home');
    _refreshHomeStats();
    _renderLeaderboard('daily');
    _renderAchievements();
  }

  /* ── Navigation ──────────────────────────────────────────────── */
  function navigateTo(screenId) {
    const prev = document.getElementById(_current);
    const next = document.getElementById(screenId);
    if (!next) return;
    if (prev) prev.classList.remove('active');
    next.classList.add('active');
    _current = screenId;
    BoostAudio.play('click');
  }

  /* ── Settings Application ─────────────────────────────────────── */
  function _applySettings() {
    const s = BoostProfile.get().settings;
    document.body.classList.toggle('light-mode',    !s.darkMode);
    document.body.classList.toggle('large-text',     s.largeText);
    document.body.classList.toggle('colorblind',     s.colorBlind);
    document.body.classList.toggle('reduce-motion',  s.reduceMotion);
    BoostAudio.setMute(!s.sfx);
    BoostAudio.setVolume(s.volume);

    // Sync UI controls
    const sd = $('setting-dark-mode');    if (sd) sd.checked = s.darkMode;
    const sl = $('setting-large-text');   if (sl) sl.checked = s.largeText;
    const sc = $('setting-colorblind');   if (sc) sc.checked = s.colorBlind;
    const sr = $('setting-reduce-motion');if (sr) sr.checked = s.reduceMotion;
    const sm = $('setting-music');        if (sm) sm.checked = s.music;
    const sfx= $('setting-sfx');          if (sfx) sfx.checked = s.sfx;
    const sv = $('setting-volume');       if (sv) sv.value = s.volume;
    const su = $('setting-username');     if (su) su.value = BoostProfile.get().username;
    const sl2= $('setting-language');     if (sl2) sl2.value = s.language;
  }

  /* ── Home Stats ───────────────────────────────────────────────── */
  function _refreshHomeStats() {
    const p = BoostProfile.get();
    $('stat-wins').textContent  = p.wins;
    $('stat-level').textContent = p.level;
    $('stat-xp').textContent    = p.xp;
  }

  /* ── Global Event Binding ─────────────────────────────────────── */
  function _bindGlobalEvents() {

    // Back buttons (data-target)
    document.querySelectorAll('.back-btn[data-target]').forEach(btn => {
      btn.addEventListener('click', () => navigateTo(btn.dataset.target));
    });

    // Home buttons
    $('btn-quick-play').addEventListener('click', () => _startQuickPlay());
    $('btn-create-room').addEventListener('click', () => navigateTo('screen-create-room'));
    $('btn-join-room').addEventListener('click', () => navigateTo('screen-join-room'));
    $('btn-ai-game').addEventListener('click', () => _startAIGame());
    $('btn-tournament').addEventListener('click', () => navigateTo('screen-tournament'));
    $('btn-leaderboard-nav').addEventListener('click', () => navigateTo('screen-leaderboard'));
    $('btn-how-to-play').addEventListener('click', () => navigateTo('screen-how-to-play'));
    $('btn-profile-icon').addEventListener('click', () => { _renderProfile(); navigateTo('screen-profile'); });
    $('btn-settings-icon').addEventListener('click', () => { _applySettings(); navigateTo('screen-settings'); });

    // Create Room
    $('player-count').addEventListener('input', e => {
      $('player-count-display').textContent = e.target.value;
    });
    $('card-category').addEventListener('change', e => {
      $('custom-category-section').classList.toggle('hidden', e.target.value !== 'custom');
    });
    document.querySelectorAll('#mode-selector .mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#mode-selector .mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
    _bindToggleGroup('direction-selector');
    _bindToggleGroup('room-type-selector');
    _bindToggleGroup('ai-difficulty');
    $('btn-start-create').addEventListener('click', _createRoom);

    // Join Room
    $('btn-join-submit').addEventListener('click', _joinRoom);
    $('btn-scan-qr').addEventListener('click', () => _showModal('QR Scanner', '<p style="text-align:center;padding:20px;color:var(--text-muted)">QR scanning requires camera access. Enter the room code manually or paste from invite link.</p>'));

    // Lobby
    $('btn-lobby-back').addEventListener('click', _leaveLobby);
    $('btn-copy-code').addEventListener('click', _copyRoomCode);
    $('btn-share-room').addEventListener('click', _shareRoom);
    $('btn-add-bot').addEventListener('click', _addBot);
    $('btn-start-game').addEventListener('click', _startGame);

    // Game
    $('boost-btn').addEventListener('click', _handleBoostPress);
    $('btn-game-chat').addEventListener('click', () => $('chat-panel').classList.toggle('hidden'));
    $('btn-close-chat').addEventListener('click', () => $('chat-panel').classList.add('hidden'));
    $('btn-game-menu').addEventListener('click', () => $('game-menu-panel').classList.remove('hidden'));
    $('btn-resume-game').addEventListener('click', () => $('game-menu-panel').classList.add('hidden'));
    $('btn-quit-game').addEventListener('click', _quitGame);
    $('btn-toggle-sound').addEventListener('click', _toggleGameSound);
    $('btn-rules-ingame').addEventListener('click', () => { $('game-menu-panel').classList.add('hidden'); navigateTo('screen-how-to-play'); });
    $('btn-pass-left').addEventListener('click', () => _handlePassButton('left'));
    $('btn-pass-right').addEventListener('click', () => _handlePassButton('right'));

    // Chat
    $('btn-send-chat').addEventListener('click', _sendChatMessage);
    $('chat-input').addEventListener('keyup', e => { if (e.key === 'Enter') _sendChatMessage(); });
    document.querySelectorAll('.quick-msg').forEach(btn => {
      btn.addEventListener('click', () => _sendChatMessage(btn.dataset.msg));
    });

    // Results
    $('btn-play-again').addEventListener('click', _playAgain);
    $('btn-home-from-results').addEventListener('click', () => navigateTo('screen-home'));

    // Profile
    $('btn-edit-profile').addEventListener('click', () => navigateTo('screen-settings'));

    // Leaderboard tabs
    document.querySelectorAll('.lb-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        _renderLeaderboard(tab.dataset.period);
      });
    });

    // Settings
    $('btn-save-settings').addEventListener('click', _saveSettings);
    document.querySelectorAll('.avatar-picker span').forEach(span => {
      span.addEventListener('click', () => {
        document.querySelectorAll('.avatar-picker span').forEach(s => s.classList.remove('selected'));
        span.classList.add('selected');
      });
    });
    // Set current avatar as selected
    const av = BoostProfile.get().avatar;
    const avEl = document.querySelector(`.avatar-picker span[data-av="${av}"]`);
    if (avEl) avEl.classList.add('selected');

    // Tournament
    $('tournament-players').addEventListener('input', e => {
      $('tournament-player-display').textContent = e.target.value;
    });
    document.querySelectorAll('[data-rounds]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-rounds]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
    $('btn-start-tournament').addEventListener('click', _startTournament);

    // Modal
    $('modal-close').addEventListener('click', _closeModal);
    $('modal-overlay').addEventListener('click', e => { if (e.target === $('modal-overlay')) _closeModal(); });

    // Install banner
    $('btn-install').addEventListener('click', async () => {
      if (_deferredInstall) {
        _deferredInstall.prompt();
        const result = await _deferredInstall.userChoice;
        if (result.outcome === 'accepted') $('install-banner').classList.add('hidden');
      }
    });
    $('btn-dismiss-install').addEventListener('click', () => $('install-banner').classList.add('hidden'));

    // Recent rooms
    _renderRecentRooms();

    // Keyboard support
    document.addEventListener('keydown', e => {
      if (e.key === ' ' && _current === 'screen-game') {
        e.preventDefault();
        _handleBoostPress();
      }
      if (e.key === 'Escape') {
        if (!$('game-menu-panel').classList.contains('hidden')) {
          $('game-menu-panel').classList.add('hidden');
        }
        if (!$('chat-panel').classList.contains('hidden')) {
          $('chat-panel').classList.add('hidden');
        }
      }
    });
  }

  function _bindToggleGroup(groupId) {
    const group = $(groupId);
    if (!group) return;
    group.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  /* ── Room Management ─────────────────────────────────────────── */
  let _currentRoom = null;
  let _myPlayerId  = null;

  function _createRoom() {
    const hostName  = $('host-name').value.trim() || BoostProfile.get().username || 'Host';
    const mode      = $q('#mode-selector .mode-btn.active')?.dataset.mode || 'classic';
    const category  = $('card-category').value;
    const direction = $q('#direction-selector .toggle-btn.active')?.dataset.dir || 'clockwise';
    const roomType  = $q('#room-type-selector .toggle-btn.active')?.dataset.type || 'local';
    const maxP      = parseInt($('player-count').value);
    const aiDiff    = $q('#ai-difficulty .toggle-btn.active')?.dataset.ai || 'none';
    const customRaw = $('custom-items')?.value || '';
    const customItems = customRaw.split(',').map(s => s.trim()).filter(Boolean);

    const roomCode = generateRoomCode();
    _myPlayerId    = generateId();

    _currentRoom = {
      code:        roomCode,
      hostId:      _myPlayerId,
      mode,
      category,
      customItems,
      direction,
      roomType,
      maxPlayers:  maxP,
      aiDiff,
      players: [{
        id:     _myPlayerId,
        name:   hostName,
        avatar: BoostProfile.get().avatar,
        isBot:  false,
        isHost: true,
      }],
    };

    BoostProfile.update({ username: hostName });
    BoostProfile.addRecentRoom(roomCode, `${mode} – ${category}`);

    if (_firebaseOk && roomType === 'online') {
      BoostFirebase.createRoom(roomCode, _currentRoom);
      _subscribeRoom(roomCode);
    }

    _renderLobby();
    navigateTo('screen-lobby');
    BoostAudio.play('click');
    _showToast(`Room ${roomCode} created!`, 'success');
  }

  async function _joinRoom() {
    const name = $('join-name').value.trim() || BoostProfile.get().username || 'Player';
    const code = $('room-code-input').value.trim().toUpperCase();
    if (!code || code.length < 4) { _showToast('Enter a valid room code', 'error'); return; }

    _myPlayerId = generateId();
    BoostProfile.update({ username: name });

    if (_firebaseOk) {
      const result = await BoostFirebase.joinRoom(code, { id: _myPlayerId, name, avatar: BoostProfile.get().avatar, isBot: false });
      if (!result.ok) { _showToast(result.error, 'error'); return; }
      _currentRoom = { ...result.room, players: Object.values(result.room.players || {}) };
      _subscribeRoom(code);
    } else {
      // Offline: create a local stub
      _currentRoom = {
        code,
        hostId: null,
        mode: 'classic',
        category: 'colors',
        direction: 'clockwise',
        roomType: 'local',
        maxPlayers: 4,
        players: [{ id: _myPlayerId, name, avatar: BoostProfile.get().avatar, isBot: false }],
      };
      _showToast('Offline mode – playing locally', 'warning');
    }

    BoostProfile.addRecentRoom(code, `Room ${code}`);
    _renderLobby();
    navigateTo('screen-lobby');
  }

  function _leaveLobby() {
    _unsubscribeRoom();
    _currentRoom = null;
    navigateTo('screen-home');
  }

  function _addBot() {
    if (!_currentRoom) return;
    const diff    = $q('#ai-difficulty .toggle-btn.active')?.dataset.ai || 'easy';
    const botNames= ['Bolt','Blaze','Spark','Nova','Titan','Viper','Echo','Zara'];
    const botName = botNames[Math.floor(Math.random() * botNames.length)] + ' 🤖';
    const botEmojis = ['🤖','🦾','🧠','⚙️','🔮'];
    _currentRoom.players.push({
      id:     generateId(),
      name:   botName,
      avatar: botEmojis[Math.floor(Math.random() * botEmojis.length)],
      isBot:  true,
      aiDiff: diff === 'none' ? 'easy' : diff,
      isHost: false,
    });
    _renderLobby();
    BoostAudio.play('click');
  }

  function _subscribeRoom(roomCode) {
    const unsub = BoostFirebase.onRoomChange(roomCode, data => {
      if (!data) return;
      _currentRoom = { ...data, players: Object.values(data.players || {}) };
      if (_current === 'screen-lobby') _renderLobby();
    });
    _unsubRoomFns.push(unsub);
  }

  function _unsubscribeRoom() {
    _unsubRoomFns.forEach(fn => fn());
    _unsubRoomFns = [];
  }

  function _renderLobby() {
    if (!_currentRoom) return;
    $('display-room-code').textContent = _currentRoom.code;
    $('lobby-player-count').textContent = _currentRoom.players.length;
    $('lobby-max-players').textContent  = _currentRoom.maxPlayers;

    // Settings summary
    $('lobby-settings-summary').innerHTML = [
      `<span class="summary-badge">${MODES[_currentRoom.mode]?.label || _currentRoom.mode}</span>`,
      `<span class="summary-badge">${CATEGORIES[_currentRoom.category]?.emoji || '✏️'} ${_currentRoom.category}</span>`,
      `<span class="summary-badge">${_currentRoom.direction}</span>`,
    ].join('');

    // Players
    const list = $('lobby-players-list');
    list.innerHTML = _currentRoom.players.map(p => `
      <div class="player-chip ${p.isHost ? 'host' : ''} ${p.isBot ? 'bot' : ''}">
        <span>${p.avatar}</span>
        <span>${p.name}</span>
        ${p.isHost ? '<span>👑</span>' : ''}
      </div>
    `).join('');

    // Host/guest controls
    const isHost = _currentRoom.players[0]?.id === _myPlayerId ||
                   _currentRoom.hostId === _myPlayerId ||
                   _currentRoom.roomType === 'local';
    $('host-controls').classList.toggle('hidden', !isHost);
    $('guest-waiting').classList.toggle('hidden', isHost);

    // QR code (simple text-based placeholder)
    $('lobby-qr').innerHTML = `<div style="font-size:.7rem;color:var(--text-muted);text-align:center;padding:8px;">Share code: <strong>${_currentRoom.code}</strong></div>`;
  }

  function _copyRoomCode() {
    if (!_currentRoom) return;
    navigator.clipboard?.writeText(_currentRoom.code).then(() => _showToast('Code copied!', 'success'));
  }

  function _shareRoom() {
    if (!_currentRoom) return;
    const text = `Join my BOOST game! Room code: ${_currentRoom.code}`;
    if (navigator.share) {
      navigator.share({ title: 'Join my BOOST game!', text });
    } else {
      navigator.clipboard?.writeText(text);
      _showToast('Invite link copied!', 'success');
    }
  }

  /* ── Game Start ───────────────────────────────────────────────── */
  function _startQuickPlay() {
    _currentRoom = {
      code: generateRoomCode(),
      hostId: _myPlayerId = generateId(),
      mode: 'classic',
      category: 'colors',
      direction: 'clockwise',
      roomType: 'local',
      maxPlayers: 4,
      aiDiff: 'medium',
      players: [
        { id: _myPlayerId, name: BoostProfile.get().username || 'You', avatar: BoostProfile.get().avatar, isBot: false },
        { id: generateId(), name: 'Bolt 🤖', avatar: '🤖', isBot: true, aiDiff: 'easy' },
        { id: generateId(), name: 'Blaze 🤖', avatar: '🦾', isBot: true, aiDiff: 'medium' },
        { id: generateId(), name: 'Nova 🤖', avatar: '🔮', isBot: true, aiDiff: 'medium' },
      ],
    };
    _startGame();
  }

  function _startAIGame() {
    _currentRoom = {
      code: generateRoomCode(),
      hostId: _myPlayerId = generateId(),
      mode: 'classic',
      category: 'animals',
      direction: 'clockwise',
      roomType: 'local',
      maxPlayers: 5,
      aiDiff: 'hard',
      players: [
        { id: _myPlayerId, name: BoostProfile.get().username || 'You', avatar: BoostProfile.get().avatar, isBot: false },
        { id: generateId(), name: 'Titan 🤖', avatar: '🤖', isBot: true, aiDiff: 'hard' },
        { id: generateId(), name: 'Viper 🤖', avatar: '🦾', isBot: true, aiDiff: 'expert' },
        { id: generateId(), name: 'Echo 🤖', avatar: '🧠', isBot: true, aiDiff: 'medium' },
      ],
    };
    _showModal('vs AI Bots', `
      <h3>🤖 Challenge AI</h3>
      <p style="color:var(--text-muted);margin:8px 0 16px">4 Players: You vs 3 AI bots (Hard/Expert difficulty)</p>
      <button class="btn-primary btn-full" id="modal-confirm-ai">Start Game</button>
    `);
    $('modal-confirm-ai').addEventListener('click', () => { _closeModal(); _startGame(); });
  }

  function _startGame() {
    if (!_currentRoom) return;
    if (_currentRoom.players.length < 2) {
      _showToast('Need at least 2 players to start!', 'error');
      return;
    }

    _closeModal();

    // Create game state
    BoostGame.createGame({
      players:     _currentRoom.players,
      category:    _currentRoom.category,
      customItems: _currentRoom.customItems || [],
      mode:        _currentRoom.mode,
      direction:   _currentRoom.direction,
    });

    // Sync to Firebase if online
    if (_firebaseOk && _currentRoom.roomType === 'online') {
      BoostFirebase.updateRoomState(_currentRoom.code, { status: 'playing' });
    }

    navigateTo('screen-game');
    _initGameUI();
    BoostAudio.play('boost');
  }

  /* ── Game UI ───────────────────────────────────────────────────── */
  let _gameTimerInterval = null;
  let _myPlayerIdx = 0;
  let _selectedCard = null;

  function _initGameUI() {
    const s = BoostGame.getState();
    if (!s) return;

    // Find my player index
    _myPlayerIdx = s.players.findIndex(p => p.id === _myPlayerId);
    if (_myPlayerIdx === -1) _myPlayerIdx = 0; // host/local

    // HUD
    $('hud-round-num').textContent = s.round;
    $('hud-mode-badge').textContent = MODES[s.mode]?.label || s.mode;
    $('direction-text').textContent = s.direction;
    $('direction-arrow').textContent = s.direction === 'clockwise' ? '↩️' : '↪️';

    // Boost owner
    _updateBoostOwner();

    // Render ring of players
    _renderPlayersRing();

    // Render my hand
    _renderMyHand();

    // Pass controls visibility
    $('pass-controls').classList.remove('hidden');

    // Timer for speed mode
    if (MODES[s.mode]?.timerEnabled) {
      $('hud-timer').classList.remove('hidden');
      _startSpeedTimer();
    } else {
      $('hud-timer').classList.add('hidden');
    }

    // Start AI loops for bots
    _runAILoop();

    // Chaos events
    if (s.mode === 'chaos') {
      _scheduleChaosEvent();
    }
  }

  function _renderPlayersRing() {
    const s = BoostGame.getState();
    if (!s) return;

    const ring  = $('players-ring');
    const n     = s.players.length;
    const rect  = ring.getBoundingClientRect();
    const cx    = rect.width  / 2;
    const cy    = rect.height / 2;
    const rx    = Math.min(cx, cy) * 0.8;
    const ry    = Math.min(cx, cy) * 0.75;

    ring.innerHTML = '';

    s.players.forEach((p, i) => {
      const angle  = (i / n) * 2 * Math.PI - Math.PI / 2;
      const x      = cx + rx * Math.cos(angle);
      const y      = cy + ry * Math.sin(angle);

      const div = document.createElement('div');
      div.className = `ring-player${p.eliminated ? ' eliminated' : ''}${i === s.currentTurnIdx ? ' active-turn' : ''}${p.hasBoost ? ' has-boost' : ''}`;
      div.id = `ring-player-${i}`;
      div.style.left = `${x}px`;
      div.style.top  = `${y}px`;
      div.style.transform = 'translate(-50%, -50%)';
      div.innerHTML = `
        <div class="ring-avatar">
          ${p.avatar || '👤'}
          <div class="ring-cards-badge">${p.hand.length}</div>
        </div>
        <div class="ring-name">${p.name}</div>
        <div class="ring-warnings">
          ${'<div class="ring-warning-dot"></div>'.repeat(p.warnings)}
        </div>
      `;
      ring.appendChild(div);
    });
  }

  function _renderMyHand() {
    const s = BoostGame.getState();
    if (!s) return;
    const myPlayer = s.players[_myPlayerIdx];
    if (!myPlayer) return;

    const hand = $('player-hand');
    hand.innerHTML = '';
    _selectedCard = null;

    myPlayer.hand.forEach(card => {
      const el = document.createElement('div');
      el.className = `game-card${card.isBoost ? ' boost-card' : ''}${myPlayer.lastReceived?.id === card.id ? ' just-received' : ''}`;
      el.dataset.cardId = card.id;
      el.innerHTML = `
        <span>${card.type.split(' ')[0]}</span>
        <span class="game-card-label">${card.type.split(' ').slice(1).join(' ')}</span>
      `;
      el.addEventListener('click', () => _selectCard(card.id, el));
      hand.appendChild(el);
    });

    // Update BOOST button state
    _checkBoostButton();
  }

  function _selectCard(cardId, el) {
    const hand = $('player-hand');
    hand.querySelectorAll('.game-card').forEach(c => c.classList.remove('selected'));
    if (_selectedCard === cardId) {
      _selectedCard = null;
    } else {
      _selectedCard = cardId;
      el.classList.add('selected');
    }
    BoostAudio.play('click');
  }

  function _handlePassButton(dir) {
    if (!_selectedCard) {
      _showToast('Select a card to pass first!', 'warning');
      return;
    }
    const s    = BoostGame.getState();
    const targets = BoostGame.getValidTargets(_myPlayerIdx);
    const toIdx   = dir === 'left'
      ? ((_myPlayerIdx - 1 + s.players.length) % s.players.length)
      : ((_myPlayerIdx + 1) % s.players.length);

    // Validate target is valid (not eliminated)
    const actualTarget = targets.includes(toIdx) ? toIdx : targets[0];

    const result = BoostGame.passCard(_myPlayerIdx, _selectedCard, actualTarget);
    if (!result.ok) {
      _showToast(result.error, 'error');
      BoostAudio.play('error');
      BoostGame.addWarning(_myPlayerIdx);
      return;
    }

    BoostAudio.play('card');
    _animateCardPass(_myPlayerIdx, actualTarget);
    _afterPass(result);
  }

  function _handleBoostPress() {
    const result = BoostGame.pressBoost(_myPlayerIdx);
    if (result.valid) {
      BoostAudio.play('boost');
      _endGame(result);
    } else if (result.eliminated) {
      BoostAudio.play('error');
      _showToast('False BOOST! You are eliminated!', 'error');
      _renderPlayersRing();
      _renderMyHand();
      $('boost-btn').disabled = true;
    }
  }

  function _checkBoostButton() {
    const s = BoostGame.getState();
    if (!s) return;
    const myPlayer = s.players[_myPlayerIdx];
    if (!myPlayer || myPlayer.eliminated) return;

    // Check if myPlayer has 3 of a kind
    const nonBoost = myPlayer.hand.filter(c => !c.isBoost);
    const counts   = {};
    nonBoost.forEach(c => { counts[c.type] = (counts[c.type] || 0) + 1; });
    const canBoost = Object.values(counts).some(v => v >= 3);

    $('boost-btn').disabled = !canBoost;
    $('boost-btn').classList.toggle('ready', canBoost);
    if (canBoost) BoostAudio.play('win');
  }

  function _updateBoostOwner() {
    const s = BoostGame.getState();
    if (!s) return;
    const boostHolder = s.players.find(p => p.hasBoost);
    const badge = $('boost-owner-badge');
    if (boostHolder) {
      badge.classList.remove('hidden');
      $('boost-owner-name').textContent = boostHolder.name;
    } else {
      badge.classList.add('hidden');
    }
  }

  function _afterPass(result) {
    _renderMyHand();
    _renderPlayersRing();
    _updateBoostOwner();

    // Update last received label
    const s = BoostGame.getState();
    const myP = s.players[_myPlayerIdx];
    if (myP.lastReceived) {
      $('last-received-label').textContent = `Last received: ${myP.lastReceived.type}`;
    }

    // Push to Firebase
    if (_firebaseOk && _currentRoom?.roomType === 'online') {
      BoostFirebase.pushGameAction(_currentRoom.code, {
        type: 'pass',
        ...result
      });
    }
  }

  function _animateCardPass(fromIdx, toIdx) {
    const s = BoostGame.getState();
    if (!s || document.body.classList.contains('reduce-motion')) return;

    const fromEl = $(`ring-player-${fromIdx}`)?.querySelector('.ring-avatar');
    const toEl   = $(`ring-player-${toIdx}`)?.querySelector('.ring-avatar');
    if (!fromEl || !toEl) return;

    const overlay  = $('pass-anim-overlay');
    const flyCard  = $('flying-card');
    const fromRect = fromEl.getBoundingClientRect();
    const toRect   = toEl.getBoundingClientRect();
    const ringRect = overlay.getBoundingClientRect();

    flyCard.style.left = `${fromRect.x - ringRect.x + fromRect.width/2}px`;
    flyCard.style.top  = `${fromRect.y - ringRect.y + fromRect.height/2}px`;
    flyCard.textContent = '🃏';
    overlay.classList.remove('hidden');
    flyCard.style.animation = 'none';
    flyCard.offsetHeight; // reflow
    flyCard.style.animation = '';

    const dx = (toRect.x - fromRect.x);
    const dy = (toRect.y - fromRect.y);
    flyCard.style.transform = `translate(${dx}px, ${dy}px)`;
    flyCard.style.transition = 'transform 0.5s ease';

    setTimeout(() => {
      overlay.classList.add('hidden');
      flyCard.style.transition = '';
      flyCard.style.transform  = '';
    }, 600);
  }

  /* ── Speed Mode Timer ─────────────────────────────────────────── */
  function _startSpeedTimer() {
    clearInterval(_gameTimerInterval);
    const s = BoostGame.getState();
    let sec = s.timerSec || 30;
    $('hud-timer-val').textContent = sec;

    _gameTimerInterval = setInterval(() => {
      sec--;
      $('hud-timer-val').textContent = sec;
      if (sec <= 5) BoostAudio.play('warning');
      if (sec <= 0) {
        clearInterval(_gameTimerInterval);
        // Time's up – closest player to winning wins
        const winner = _findClosestToWin();
        BoostGame.pressBoost(winner);
        _endGame({ valid: true, winner: s.players[winner] });
      }
    }, 1000);
  }

  function _findClosestToWin() {
    const s = BoostGame.getState();
    let best = { idx: 0, max: 0 };
    s.players.forEach((p, i) => {
      if (p.eliminated) return;
      const counts = {};
      p.hand.filter(c => !c.isBoost).forEach(c => { counts[c.type] = (counts[c.type] || 0) + 1; });
      const max = Math.max(0, ...Object.values(counts));
      if (max > best.max) best = { idx: i, max };
    });
    return best.idx;
  }

  /* ── Chaos Events ─────────────────────────────────────────────── */
  let _chaosTimeout = null;

  function _scheduleChaosEvent() {
    const delay = 8000 + Math.random() * 12000;
    _chaosTimeout = setTimeout(() => {
      const s = BoostGame.getState();
      if (!s || s.status !== 'playing') return;
      const evt = BoostGame.triggerChaosEvent();
      _showChaosEvent(evt);
      _renderPlayersRing();
      _renderMyHand();
      _scheduleChaosEvent();
    }, delay);
  }

  function _showChaosEvent(evt) {
    const banner = $('chaos-banner');
    $('chaos-event-text').textContent = evt.text;
    banner.classList.remove('hidden');
    BoostAudio.play('chaos');
    setTimeout(() => banner.classList.add('hidden'), 3000);
  }

  /* ── AI Loop ──────────────────────────────────────────────────── */
  let _aiLoopRunning = false;

  async function _runAILoop() {
    _aiLoopRunning = true;
    const s = BoostGame.getState();
    if (!s) return;

    while (s.status === 'playing' && _aiLoopRunning) {
      // Check each bot
      for (let i = 0; i < s.players.length; i++) {
        const p = s.players[i];
        if (!p.isBot || p.eliminated || s.status !== 'playing') continue;

        // Check if AI should BOOST first
        if (BoostGame.aiShouldBoost(i)) {
          await sleep(300 + Math.random() * 500);
          if (s.status !== 'playing') break;
          const result = BoostGame.pressBoost(i);
          if (result.valid) {
            BoostAudio.play('boost');
            _endGame({ ...result, winner: s.players[i] });
            return;
          }
        }

        // AI takes a pass turn
        const action = await BoostGame.aiTakeTurn(i, p.aiDiff);
        if (!action || s.status !== 'playing') break;

        const result = BoostGame.passCard(i, action.cardId, action.toIdx);
        if (result.ok) {
          BoostAudio.play('card');
          _animateCardPass(i, action.toIdx);
          _renderPlayersRing();
          // If the AI passed to the human player, update their hand
          if (action.toIdx === _myPlayerIdx) {
            _renderMyHand();
          }
          _updateBoostOwner();
        }
      }
      await sleep(200);
    }
  }

  /* ── Game End ─────────────────────────────────────────────────── */
  function _endGame(result) {
    clearInterval(_gameTimerInterval);
    clearTimeout(_chaosTimeout);
    _aiLoopRunning = false;

    const s = BoostGame.getState();
    if (!s) return;

    const durationMs = Date.now() - s.startTime;
    const isMyWin    = result.winner?.id === _myPlayerId || (typeof result === 'object' && s.players[s.winner]?.id === _myPlayerId);
    const profile    = BoostProfile.get();

    if (isMyWin) {
      profile.wins++;
      BoostProfile.addXP(100 + Math.floor(50 * s.players.length));
      BoostProfile.addCoins(20);
    } else {
      profile.losses = (profile.losses || 0) + 1;
      BoostProfile.addXP(10);
    }

    profile.boosts = (profile.boosts || 0) + (isMyWin ? 1 : 0);
    profile.stats.totalGames = (profile.stats.totalGames || 0) + 1;
    BoostProfile.update(profile);

    const myPlayerState = s.players[_myPlayerIdx];
    const earned = BoostProfile.checkAchievements({
      win:      isMyWin,
      gameMode: s.mode,
      durationMs,
      warnings: myPlayerState?.warnings || 0,
      aiWin:    isMyWin && s.players.some(p => p.isBot),
    });

    // Submit online score
    if (_firebaseOk) {
      BoostFirebase.submitScore(profile.id, profile.username, isMyWin ? 100 : 10);
      BoostFirebase.submitScore(profile.id, profile.username, isMyWin ? 100 : 10, 'daily');
      BoostFirebase.submitScore(profile.id, profile.username, isMyWin ? 100 : 10, 'weekly');
    }

    _showResults(result, s, durationMs, isMyWin, earned);
  }

  function _showResults(result, s, durationMs, isMyWin, earned) {
    const winnerName = result.winner?.name || s.players[s.winner]?.name || 'Unknown';

    $('winner-name-display').textContent = winnerName;
    $('rs-time').textContent  = `${Math.round(durationMs / 1000)}s`;
    $('rs-cards').textContent = s.players.reduce((a,p) => a + (p.cardsP || 0), 0);
    $('rs-xp').textContent    = isMyWin ? '+100 XP' : '+10 XP';

    // Winner cards
    const wc = $('winner-cards-display');
    wc.innerHTML = '';
    if (result.cards) {
      result.cards.forEach(c => {
        const el = document.createElement('div');
        el.className = 'game-card';
        el.style.width = '48px'; el.style.height = '64px'; el.style.fontSize = '1.4rem';
        el.innerHTML = `<span>${c.type.split(' ')[0]}</span>`;
        wc.appendChild(el);
      });
    }

    // Leaderboard of this game
    const lb = $('results-leaderboard');
    const sorted = [...s.players].sort((a,b) => {
      if (a.id === (result.winner?.id || s.players[s.winner]?.id)) return -1;
      if (b.id === (result.winner?.id || s.players[s.winner]?.id)) return  1;
      return 0;
    });
    lb.innerHTML = sorted.map((p,i) => `
      <div class="lb-row">
        <span class="lb-rank ${i===0?'gold':i===1?'silver':i===2?'bronze':''}">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</span>
        <span>${p.avatar || '👤'}</span>
        <span class="lb-name">${p.name}</span>
        <span style="color:var(--text-muted);font-size:.8rem">${p.cardsP||0} passed</span>
      </div>
    `).join('');

    navigateTo('screen-results');
    _confetti();
    BoostAudio.play('win');
    _refreshHomeStats();

    // Show achievement toasts
    setTimeout(() => {
      earned.forEach(achId => {
        const ach = ACHIEVEMENTS_DEF.find(a => a.id === achId);
        if (ach) _showToast(`🏆 Achievement: ${ach.name}!`, 'success');
      });
    }, 1500);
  }

  function _playAgain() {
    if (_currentRoom) {
      _currentRoom.players = _currentRoom.players; // keep same players
      _startGame();
    } else {
      navigateTo('screen-home');
    }
  }

  function _quitGame() {
    clearInterval(_gameTimerInterval);
    clearTimeout(_chaosTimeout);
    _aiLoopRunning = false;
    BoostGame.reset();
    navigateTo('screen-home');
  }

  function _toggleGameSound() {
    const s = BoostProfile.get().settings;
    s.sfx = !s.sfx;
    BoostProfile.update({ settings: s });
    BoostAudio.setMute(!s.sfx);
    $('btn-toggle-sound').textContent = `${s.sfx ? '🔊' : '🔇'} Sound: ${s.sfx ? 'On' : 'Off'}`;
  }

  /* ── Chat ─────────────────────────────────────────────────────── */
  function _sendChatMessage(text) {
    const msg = text || $('chat-input').value.trim();
    if (!msg) return;

    const profile = BoostProfile.get();
    const msgData = {
      id:     generateId(),
      name:   profile.username,
      avatar: profile.avatar,
      text:   msg,
      ts:     Date.now(),
    };

    _appendChatMsg(msgData);
    $('chat-input').value = '';

    if (_firebaseOk && _currentRoom) {
      BoostFirebase.sendChatMessage(_currentRoom.code, msgData);
    }

    profile.chatMsgs = (profile.chatMsgs || 0) + 1;
    if (profile.chatMsgs >= 50) {
      if (BoostProfile.unlockAchievement('social_butterfly')) {
        _showToast('🦋 Achievement: Social Butterfly!', 'success');
      }
    }
    BoostProfile.update({ chatMsgs: profile.chatMsgs });
    BoostAudio.play('click');
  }

  function _appendChatMsg(msg) {
    const box = $('chat-messages');
    const el  = document.createElement('div');
    el.className = 'chat-msg';
    el.innerHTML = `<div class="msg-name">${msg.avatar} ${msg.name}</div><div>${msg.text}</div>`;
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
  }

  /* ── Leaderboard ──────────────────────────────────────────────── */
  async function _renderLeaderboard(period) {
    const list = $('lb-list');
    list.innerHTML = '<div class="empty-msg">Loading…</div>';

    let entries = [];
    if (_firebaseOk) {
      entries = await BoostFirebase.getLeaderboard(period);
    }

    // Always show local player at top for offline
    const profile = BoostProfile.get();
    if (entries.length === 0) {
      entries = [
        { username: profile.username, score: profile.wins * 100, wins: profile.wins, rank: 1 },
        { username: 'Bolt 🤖', score: 850, wins: 9 },
        { username: 'Blaze 🤖', score: 720, wins: 7 },
        { username: 'Nova 🤖', score: 630, wins: 6 },
        { username: 'Titan 🤖', score: 510, wins: 5 },
      ];
    }

    list.innerHTML = entries.map((e, i) => `
      <div class="lb-row">
        <span class="lb-rank ${i===0?'gold':i===1?'silver':i===2?'bronze':''}">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</span>
        <span class="lb-name">${e.username || e.name || '?'}</span>
        <span class="lb-score">${e.score || 0}</span>
      </div>
    `).join('') || '<div class="empty-msg">No entries yet</div>';
  }

  /* ── Profile ─────────────────────────────────────────────────── */
  function _renderProfile() {
    const p = BoostProfile.get();
    $('profile-avatar').textContent   = p.avatar;
    $('profile-username').textContent = p.username;
    $('profile-level').textContent    = p.level;
    $('ps-wins').textContent          = p.wins;
    $('ps-losses').textContent        = p.losses || 0;
    $('ps-winrate').textContent       = p.wins + (p.losses||0) > 0
      ? `${Math.round(p.wins / (p.wins + (p.losses||0)) * 100)}%` : '0%';
    $('ps-tournaments').textContent   = p.tournaments || 0;
    $('ps-boosts').textContent        = p.boosts || 0;
    $('ps-coins').textContent         = p.coins || 0;
    $('xp-current').textContent       = p.xp;

    const curLvXP  = XP_LEVELS[p.level - 1] || 0;
    const nextLvXP = XP_LEVELS[p.level] || XP_LEVELS[XP_LEVELS.length-1];
    $('xp-next').textContent = nextLvXP;
    const pct = Math.min(100, Math.round((p.xp - curLvXP) / (nextLvXP - curLvXP) * 100));
    $('xp-bar-fill').style.width = pct + '%';
  }

  function _renderAchievements() {
    const p    = BoostProfile.get();
    const grid = $('achievements-grid');
    if (!grid) return;
    grid.innerHTML = ACHIEVEMENTS_DEF.map(ach => {
      const unlocked = !!p.achievements[ach.id];
      return `
        <div class="achievement ${unlocked ? '' : 'locked'}" title="${ach.desc}">
          <span class="ach-icon">${ach.icon}</span>
          <span>${ach.name}</span>
        </div>
      `;
    }).join('');
  }

  /* ── Settings ─────────────────────────────────────────────────── */
  function _saveSettings() {
    const selectedAv = $q('.avatar-picker span.selected')?.dataset.av || BoostProfile.get().avatar;
    const settings = {
      darkMode:     $('setting-dark-mode')?.checked  ?? true,
      largeText:    $('setting-large-text')?.checked ?? false,
      colorBlind:   $('setting-colorblind')?.checked ?? false,
      reduceMotion: $('setting-reduce-motion')?.checked ?? false,
      music:        $('setting-music')?.checked      ?? true,
      sfx:          $('setting-sfx')?.checked        ?? true,
      volume:       parseInt($('setting-volume')?.value || '70'),
      language:     $('setting-language')?.value     || 'en',
    };
    const username = $('setting-username')?.value.trim() || BoostProfile.get().username;
    BoostProfile.update({ settings, username, avatar: selectedAv });
    _applySettings();
    _showToast('Settings saved!', 'success');
    BoostAudio.play('click');
  }

  /* ── Tournament ───────────────────────────────────────────────── */
  function _startTournament() {
    const name    = $('tournament-name').value || 'BOOST Championship';
    const players = parseInt($('tournament-players').value) || 8;
    const rounds  = parseInt($q('[data-rounds].active')?.dataset.rounds) || 3;

    _showModal(`🏆 ${name}`, `
      <h3>Tournament Setup</h3>
      <p style="color:var(--text-muted);margin:8px 0">${players} players · ${rounds} rounds</p>
      <p style="color:var(--text-muted);font-size:.85rem;margin-bottom:16px">Tournament will use AI bots to fill slots. You play as Player 1.</p>
      <button class="btn-primary btn-full" id="modal-confirm-tour">Start Tournament 🏆</button>
    `);
    $('modal-confirm-tour').addEventListener('click', () => {
      _closeModal();
      const botPlayers = Array.from({ length: players - 1 }, (_, i) => ({
        id:     generateId(),
        name:   `Bot ${i+1} 🤖`,
        avatar: '🤖',
        isBot:  true,
        aiDiff: ['easy','medium','hard','expert'][Math.floor(Math.random()*4)],
      }));
      _currentRoom = {
        code:       generateRoomCode(),
        hostId:     _myPlayerId = generateId(),
        mode:       'classic',
        category:   'animals',
        direction:  'clockwise',
        roomType:   'local',
        maxPlayers: players,
        isTournament: true,
        players: [
          { id: _myPlayerId, name: BoostProfile.get().username, avatar: BoostProfile.get().avatar, isBot: false },
          ...botPlayers,
        ],
      };
      _startGame();
    });
  }

  /* ── Recent Rooms ─────────────────────────────────────────────── */
  function _renderRecentRooms() {
    const list    = $('recent-rooms-list');
    if (!list) return;
    const rooms   = BoostProfile.get().recentRooms || [];
    if (rooms.length === 0) {
      list.innerHTML = '<p class="empty-msg">No recent rooms yet</p>';
      return;
    }
    list.innerHTML = rooms.map(r => `
      <button class="recent-room-btn" data-code="${r.code}">
        <span>${r.name || r.code}</span>
        <span style="color:var(--purple-light);font-weight:800">${r.code}</span>
      </button>
    `).join('');
    list.querySelectorAll('.recent-room-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $('room-code-input').value = btn.dataset.code;
      });
    });
  }

  /* ── Modal ────────────────────────────────────────────────────── */
  function _showModal(title, html) {
    $('modal-content').innerHTML = `<h3>${title}</h3>${html}`;
    $('modal-overlay').classList.remove('hidden');
  }

  function _closeModal() {
    $('modal-overlay').classList.add('hidden');
  }

  /* ── Toast ────────────────────────────────────────────────────── */
  function _showToast(msg, type = '') {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    $('toast-container').appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  /* ── Confetti ─────────────────────────────────────────────────── */
  function _confetti() {
    const container = $('confetti-container');
    container.innerHTML = '';
    const colors = ['#6C3CE1','#00D4FF','#FFD700','#FF4757','#2ED573','#FFA500'];
    for (let i = 0; i < 60; i++) {
      const p = document.createElement('div');
      p.className = 'confetti-piece';
      p.style.left     = Math.random() * 100 + '%';
      p.style.top      = '-20px';
      p.style.background = colors[Math.floor(Math.random() * colors.length)];
      p.style.width    = (6 + Math.random() * 8) + 'px';
      p.style.height   = (6 + Math.random() * 8) + 'px';
      p.style.animationDuration  = (2 + Math.random() * 3) + 's';
      p.style.animationDelay     = Math.random() * 2 + 's';
      container.appendChild(p);
    }
  }

  return { init, navigateTo };
})();

/* ================================================================
   BOOTSTRAP
   ================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  BoostApp.init();
});
