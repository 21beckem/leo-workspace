#!/home/michael/leo-workspace/py/bin/python

import asyncio
import json
import atexit
import logging
import pathlib
import socket
import subprocess

import board
import busio
import adafruit_pca9685
from aiohttp import web, WSMsgType, ClientSession
import sys
sys.path.append('/home/michael/leo-workspace/power_off_pi')
from power_off_pi import power_off_pi

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ── PCA9685 / Motor hardware setup ────────────────────────────────────────────
i2c = busio.I2C(board.SCL, board.SDA)
pca = adafruit_pca9685.PCA9685(i2c)
pca.frequency = 60

MAX_DUTY = 65535  # 16-bit full scale

# Motor channel pairs — matches the assignments in bendBackAndForth.py.
# Each tuple is (channel_A, channel_B); driving A → one direction, B → other.
MOTORS: dict[str, tuple] = {
    "A": (pca.channels[0],  pca.channels[1]),
    "B": (pca.channels[10], pca.channels[11]),
    "C": (pca.channels[2],  pca.channels[3]),
    "D": (pca.channels[9],  pca.channels[8]),
    "E": (pca.channels[4],  pca.channels[5]),
    "F": (pca.channels[14], pca.channels[15]),
    "G": (pca.channels[13], pca.channels[12]),
    "H": (pca.channels[6],  pca.channels[7]),
}


def set_motor(name: str, value: float) -> None:
    """
    Drive a motor at normalised power.
      value =  1.0  → full power, channel-A direction  (maps to dir=0 in original)
      value = -1.0  → full power, channel-B direction  (maps to dir=1 in original)
      value =  0.0  → coast (both channels off)
    `value` is clamped to [-1, 1] before use.
    """
    value = max(-1.0, min(1.0, value))
    ch_a, ch_b = MOTORS[name]
    duty = int(abs(value) * MAX_DUTY)

    if value > 0:
        ch_b.duty_cycle = 0
        ch_a.duty_cycle = duty
    elif value < 0:
        ch_a.duty_cycle = 0
        ch_b.duty_cycle = duty
    else:
        ch_a.duty_cycle = 0
        ch_b.duty_cycle = 0


def stop_all() -> None:
    """Zero every PCA9685 channel — all motors coast immediately."""
    for i in range(16):
        pca.channels[i].duty_cycle = 0


atexit.register(stop_all)  # runs on clean exit (Ctrl-C, etc.)


# ── WebSocket handler ─────────────────────────────────────────────────────────
async def ws_handler(request: web.Request) -> web.WebSocketResponse:
    ws = web.WebSocketResponse(heartbeat=3.0)
    await ws.prepare(request)

    peer = request.remote
    log.info("Client connected    [%s]", peer)

    try:
        async for msg in ws:
            if msg.type == WSMsgType.TEXT:
                _dispatch(msg.data, peer, ws)
            elif msg.type == WSMsgType.ERROR:
                log.error("WS error from %s: %s", peer, ws.exception())
    finally:
        # Safety: stop everything the moment this browser tab disconnects.
        stop_all()
        log.info("Client disconnected [%s] — all motors stopped", peer)

    return ws


def _dispatch(raw: str, peer: str, ws: web.WebSocketResponse) -> None:
    """Parse and execute one WebSocket message."""
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        log.warning("Non-JSON from %s: %r", peer, raw)
        return

    kind = data.get("type")

    if kind == "motor":
        motor = str(data.get("motor", "")).upper()
        if motor not in MOTORS:
            log.warning("Unknown motor %r from %s", motor, peer)
            return
        try:
            value = float(data["value"])
        except (KeyError, TypeError, ValueError) as exc:
            log.warning("Bad motor value from %s: %s", peer, exc)
            return
        set_motor(motor, value)

    elif kind == "stop_all":
        stop_all()
        log.info("STOP ALL ← %s", peer)

    elif kind == "poweroff":
        log.info("POWER OFF ← %s — stopping motors and shutting down", peer)
        stop_all()
        power_off_pi()

    else:
        log.warning("Unknown command %r from %s", kind, peer)


# ── App assembly ──────────────────────────────────────────────────────────────

async def proxy_handler(request):
    async with ClientSession() as session:
        # If the incoming path starts with "/leo-workspace", strip that prefix
        path_qs = request.path_qs
        prefix = "/leo-workspace"
        if path_qs.startswith(prefix):
            path_qs = path_qs[len(prefix):]
            if path_qs == "":
                path_qs = "/"

        target_url = f"https://21beckem.github.io/leo-workspace{path_qs}"

        # Forward the request to the target server
        async with session.get(target_url) as resp:
            data = await resp.read()
            return web.Response(
                text=data.decode("utf-8", errors="replace"),
                status=resp.status,
                content_type=resp.content_type,
            )

def build_app() -> web.Application:
    app = web.Application()
    app.router.add_get("/{path:.*}", proxy_handler)
    app.router.add_get("/ws", ws_handler)
    return app


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    # Try to show the LAN IP so the user knows what to type in a browser
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        lan_ip = s.getsockname()[0]
        s.close()
    except Exception:
        lan_ip = "?"

    log.info("━" * 54)
    log.info("  Robot control server is running!")
    log.info("  Open in any browser →  http://%s:9300", lan_ip)
    log.info("  Or →  https://21beckem.github.io/leo-workspace/")
    log.info("━" * 54)

    web.run_app(build_app(), host="0.0.0.0", port=9300, access_log=None)