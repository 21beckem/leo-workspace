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
const momentaryBtn = document.getElementById('momentaryBtn');

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

let momentary = localStorage.getItem('robot_momentary') === 'true';

function applyMomentary() {
  momentaryBtn.textContent = `MOMENTARY: ${momentary ? 'ON' : 'OFF'}`;
  momentaryBtn.classList.toggle('on', momentary);
}

momentaryBtn.addEventListener('click', () => {
  momentary = !momentary;
  localStorage.setItem('robot_momentary', momentary);
  applyMomentary();
  if (momentary) {
    sendMsg({ type: 'stop_all' });
    sliders.forEach(s => s.resetVisual());
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
//  MotorCard — manages one motor's DOM + two control modes
// ─────────────────────────────────────────────────────────────────────────────
class MotorCard {
  constructor(name) {
    this.name     = name;
    this.value    = 0;       // -1 … 1 (negative = reverse)
    this.mode     = 'bidir'; // 'bidir' | 'split'
    this._lastSentAt = 0;

    // split-mode state
    this._splitDir   = 1;    // 1 = forward, -1 = reverse
    this._splitSpeed = 0;    // 0 … 1

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

      <div class="type-toggle">
        <button data-mode="bidir" class="sel">BIDIR</button>
        <button data-mode="split">SPLIT</button>
      </div>

      <!-- Bidirectional vertical slider -->
      <div class="slider-zone" id="sz-${this.name}" style="display:flex;flex-direction:column;align-items:center;">
        <div class="slider-rail" id="rail-${this.name}">
          <div class="slider-fill" id="fill-${this.name}"></div>
          <div class="slider-thumb" id="thumb-${this.name}"></div>
        </div>
      </div>

      <!-- Split: direction + speed slider -->
      <div class="speed-dir-wrap" id="sdw-${this.name}" style="display:none;">
        <div class="dir-toggle">
          <button data-dir="1"  class="active-fwd">FWD</button>
          <button data-dir="-1"                   >REV</button>
        </div>
        <div class="speed-slider-wrap">
          <input type="range" min="0" max="100" value="0" id="spd-${this.name}" />
          <span class="speed-pct" id="spct-${this.name}">0%</span>
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
    this._spdIn  = card.querySelector(`#spd-${this.name}`);
    this._spct   = card.querySelector(`#spct-${this.name}`);
    this._ro     = card.querySelector(`#ro-${this.name}`);

    // Mode toggle
    card.querySelectorAll('.type-toggle button').forEach(btn => {
      btn.addEventListener('click', () => this._setMode(btn.dataset.mode));
    });

    // Direction buttons (split mode)
    card.querySelectorAll('.dir-toggle button').forEach(btn => {
      btn.addEventListener('click', () => {
        this._splitDir = parseInt(btn.dataset.dir);
        this._syncSplitDirUI();
        this._commitSplit();
      });
    });

    // Speed slider (split mode)
    this._spdIn.addEventListener('input', () => {
      this._splitSpeed = parseInt(this._spdIn.value) / 100;
      this._spct.textContent = `${this._spdIn.value}%`;
      this._commitSplit();
    });

    this._spdIn.addEventListener('pointerup', () => {
      if (momentary) {
        this._splitSpeed = 0;
        this._spdIn.value = 0;
        this._spct.textContent = '0%';
        this.setValue(0, false);
        this._forceSend();
      }
    });

    // Per-motor stop button
    card.querySelector(`#mstop-${this.name}`).addEventListener('click', e => {
      e.stopPropagation();
      this.setValue(0);
      this._forceSend();
    });

    // Bidirectional slider drag
    this._attachBidirEvents();

    return card;
  }

  // ── Mode switching ───────────────────────────────────────────────
  _setMode(mode) {
    this.mode = mode;
    this._card.querySelectorAll('.type-toggle button').forEach(b => {
      b.classList.toggle('sel', b.dataset.mode === mode);
    });
    const bidir = mode === 'bidir';
    this._sz.style.display  = bidir ? 'flex' : 'none';
    this._sdw.style.display = bidir ? 'none' : 'flex';

    // Carry value across modes
    if (mode === 'split') {
      this._splitDir   = this.value >= 0 ? 1 : -1;
      this._splitSpeed = Math.abs(this.value);
      this._spdIn.value = Math.round(this._splitSpeed * 100);
      this._spct.textContent = `${this._spdIn.value}%`;
      this._syncSplitDirUI();
    } else {
      // bidir ← take split state
      this.setValue(this._splitDir * this._splitSpeed, false);
    }
  }

  _syncSplitDirUI() {
    this._card.querySelectorAll('.dir-toggle button').forEach(b => {
      const d = parseInt(b.dataset.dir);
      b.classList.remove('active-fwd', 'active-rev');
      if (d === this._splitDir) b.classList.add(d > 0 ? 'active-fwd' : 'active-rev');
    });
  }

  _commitSplit() {
    this.setValue(this._splitDir * this._splitSpeed);
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
      if (momentary) {
        this.setValue(0, false);
        this._forceSend();
      } else {
        this._forceSend(); // guarantee final value is sent
      }
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
    this._splitSpeed = 0;
    this._spdIn.value = 0;
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

applyMomentary();