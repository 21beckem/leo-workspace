'use strict';

// ─────────────────────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────────────────────
const MOTOR_NAMES  = ['A','B','C','D','E','F','G','H'];
const SNAP_ZONE    = 0.04;  // snap to 0 within ±4 % of centre
const THROTTLE_MS  = 33;    // max send rate ~30 fps
const TRACK_H      = 188;   // must match CSS .slider-zone height

// ─────────────────────────────────────────────────────────────────────────────
//  WebSocket connection
// ─────────────────────────────────────────────────────────────────────────────
let ws = null;

const pip         = document.getElementById('pip');
const statusLabel = document.getElementById('statusLabel');
const connectBtn  = document.getElementById('connectBtn');
const hostInput   = document.getElementById('hostInput');
const portInput   = document.getElementById('portInput');
const stopAllBtn  = document.getElementById('stopAllBtn');
const poweroffBtn = document.getElementById('poweroffBtn');
const themeBtn    = document.getElementById('themeBtn');

// ── Theme ──────────────────────────────────────────────────────────
let darkMode = localStorage.getItem('robot_theme') !== 'light';

function applyTheme() {
  document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
  themeBtn.textContent = darkMode ? '☀ LIGHT' : '☽ DARK';
  localStorage.setItem('robot_theme', darkMode ? 'dark' : 'light');
}

themeBtn.addEventListener('click', () => { darkMode = !darkMode; applyTheme(); });
applyTheme();

poweroffBtn.addEventListener('click', () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    alert('Not connected to the robot — connect first before powering off.');
    return;
  }
  const confirmed = confirm(
    'Power off the Raspberry Pi?\n\nThis will stop all motors and shut the robot down. You will need physical access to turn it back on.'
  );
  if (confirmed) {
    sendMsg({ type: 'stop_all' });
    sendMsg({ type: 'poweroff' });
    setConnectionState('', 'Shutting down…');
  }
});

function setConnectionState(state, label) {
  pip.className = 'status-pip ' + state;
  statusLabel.textContent = label;
  const live = state === 'connected';
  connectBtn.textContent = live ? 'DISCONNECT' : 'CONNECT';
  connectBtn.classList.toggle('live', live);
}

function sendMsg(obj) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
    return true;
  }
  return false;
}

function connect() {
  const host = hostInput.value.trim();
  const port = portInput.value.trim() || '9300';
  if (!host) { statusLabel.textContent = 'Enter a host address'; return; }

  // Persist for next visit
  localStorage.setItem('robot_host', host);
  localStorage.setItem('robot_port', port);

  const url = `ws://${host}:${port}/ws`;
  setConnectionState('connecting', `Connecting to ${url} …`);

  ws = new WebSocket(url);

  ws.onopen = () => {
    setConnectionState('connected', `Connected — ${host}:${port}`);
  };

  ws.onclose = () => {
    setConnectionState('', 'Disconnected');
    ws = null;
    // Server already stopped motors on disconnect; just reset slider visuals
    sliders.forEach(s => s.resetVisual());
  };

  ws.onerror = () => {
    setConnectionState('', 'Connection error — is the server running?');
  };

  ws.onmessage = (e) => {
    try {
      const d = JSON.parse(e.data);
      if (d.type === 'error') console.warn('[Server]', d.message);
    } catch {}
  };
}

function disconnect() {
  if (ws) {
    sendMsg({ type: 'stop_all' });
    ws.close();
    ws = null;
  }
  setConnectionState('', 'Disconnected');
}

connectBtn.addEventListener('click', () => {
  ws ? disconnect() : connect();
});

stopAllBtn.addEventListener('click', () => {
  sendMsg({ type: 'stop_all' });
  sliders.forEach(s => s.setValue(0, false));
});


// ─────────────────────────────────────────────────────────────────────────────
//  MotorCard — manages one motor's DOM
// ─────────────────────────────────────────────────────────────────────────────
class MotorCard {
  constructor(name) {
    this.name     = name;
    this.value    = 0;       // -1 … 1 (negative = reverse)
    this._lastSentAt = 0;
    this._speed = 0;    // 0 … 1

    this.el = this._buildDOM();
    this._updateVisuals();
  }

  // ── DOM construction ─────────────────────────────────────────────
  _buildDOM() {
    const card = document.createElement('div');
    card.className = 'motor-card';
    card.innerHTML = `
      <div class="motor-tag">MOTOR</div>
      <div class="motor-letter">${this.name}</div>

      <!-- Bidirectional vertical slider -->
      <div class="slider-zone" id="sz-${this.name}" style="display:flex;flex-direction:column;align-items:center;">
        <div class="slider-rail" id="rail-${this.name}">
          <div class="slider-fill" id="fill-${this.name}"></div>
          <div class="slider-thumb" id="thumb-${this.name}"></div>
        </div>
      </div>

      <div class="motor-readout" id="ro-${this.name}">---</div>
      <button class="btn-motor-stop" id="mstop-${this.name}">■ STOP</button>
    `;

    // Cache refs
    this._card   = card;
    this._sz     = card.querySelector(`#sz-${this.name}`);
    this._rail   = card.querySelector(`#rail-${this.name}`);
    this._fill   = card.querySelector(`#fill-${this.name}`);
    this._thumb  = card.querySelector(`#thumb-${this.name}`);
    this._sdw    = card.querySelector(`#sdw-${this.name}`);
    this._spct   = card.querySelector(`#spct-${this.name}`);
    this._ro     = card.querySelector(`#ro-${this.name}`);

    // Per-motor stop button
    card.querySelector(`#mstop-${this.name}`).addEventListener('click', e => {
      e.stopPropagation();
      this.setValue(0);
      this._forceSend();
    });

    this._attachBidirEvents();

    return card;
  }

  // ── Bidirectional slider pointer events ──────────────────────────
  _attachBidirEvents() {
    const zone = this._sz;
    let dragging = false;

    const valueFromEvent = (e) => {
      const rect = this._rail.getBoundingClientRect();
      const relY  = e.clientY - rect.top;
      const clamp = Math.max(0, Math.min(rect.height, relY));
      let v = 1 - (clamp / rect.height) * 2; // 1 at top, -1 at bottom
      if (Math.abs(v) < SNAP_ZONE) v = 0;
      return v;
    };

    zone.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      zone.setPointerCapture(e.pointerId);
      dragging = true;
      zone.classList.add('dragging');
      this.setValue(valueFromEvent(e));
    });

    zone.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      this.setValue(valueFromEvent(e));
    });

    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      zone.classList.remove('dragging');
      this.setValue(0, false);
      this._forceSend();
    };

    zone.addEventListener('pointerup',     endDrag);
    zone.addEventListener('pointercancel', endDrag);
  }

  // ── Value management ─────────────────────────────────────────────
  setValue(v, send = true) {
    if (Math.abs(v) < SNAP_ZONE) v = 0;
    v = Math.max(-1, Math.min(1, v));
    this.value = v;
    this._updateVisuals();
    if (send) this._throttledSend();
  }

  resetVisual() {
    // Server stopped the motors; just sync the UI without re-sending
    this.value = 0;
    this._speed = 0;
    this._spct.textContent = '0%';
    this._updateVisuals();
  }

  _throttledSend() {
    const now = Date.now();
    if (now - this._lastSentAt >= THROTTLE_MS) {
      sendMsg({ type: 'motor', motor: this.name, value: this.value });
      this._lastSentAt = now;
    }
  }

  _forceSend() {
    sendMsg({ type: 'motor', motor: this.name, value: this.value });
    this._lastSentAt = Date.now();
  }

  // ── Visuals ──────────────────────────────────────────────────────
  _updateVisuals() {
    const v = this.value;

    // Thumb position on vertical track (TRACK_H matches CSS)
    const thumbTopPx = ((1 - v) / 2) * TRACK_H;
    this._thumb.style.top = `${thumbTopPx}px`;

    // Fill bar: from center to thumb
    const centerPx = TRACK_H / 2;
    if (v > 0) {
      const fillH = centerPx - thumbTopPx;
      this._fill.style.top        = `${thumbTopPx}px`;
      this._fill.style.height     = `${fillH}px`;
      this._fill.style.background = 'var(--fwd)';
    } else if (v < 0) {
      const fillH = thumbTopPx - centerPx;
      this._fill.style.top        = `${centerPx}px`;
      this._fill.style.height     = `${fillH}px`;
      this._fill.style.background = 'var(--rev)';
    } else {
      this._fill.style.height = '0';
    }

    // Card state class
    this._card.classList.remove('fwd', 'rev');
    if (v > 0) this._card.classList.add('fwd');
    if (v < 0) this._card.classList.add('rev');

    // Readout text
    const pct = Math.round(Math.abs(v) * 100);
    if (v === 0) {
      this._ro.textContent = '---';
    } else {
      this._ro.textContent = `${pct}%  ${v > 0 ? 'FWD' : 'REV'}`;
    }
  }
}


// ─────────────────────────────────────────────────────────────────────────────
//  Initialise
// ─────────────────────────────────────────────────────────────────────────────
const sliders = MOTOR_NAMES.map(name => new MotorCard(name));
const grid    = document.getElementById('motorGrid');
sliders.forEach(s => grid.appendChild(s.el));

// Restore or auto-detect connection info
const savedHost = localStorage.getItem('robot_host');
const savedPort = localStorage.getItem('robot_port');

if (savedHost) {
  hostInput.value = savedHost;
  portInput.value = savedPort || '9300';
} else if (window.location.hostname && window.location.hostname !== '') {
  // Page was loaded from the Pi — use the same host automatically
  hostInput.value = window.location.hostname;
  portInput.value = window.location.port || '9300';
}

// Auto-connect if we have something to connect to
if (hostInput.value) {
  connect();
}