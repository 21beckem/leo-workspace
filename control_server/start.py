#!/home/michael/leo-workspace/py/bin/python
"""
start.py — Web server for LEO.
Handles HTTP, WebSocket, and the GitHub Pages proxy.
All robot logic is delegated to the LEO class in leo.py.
"""

import asyncio
import json
import logging
import socket

from aiohttp import web, WSMsgType, ClientSession

import sys
sys.path.append('/home/michael/leo-workspace/leo-master')
from leo import LEO

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ── Robot instance ────────────────────────────────────────────────────────────
leo = LEO()

# ── Connected WebSocket clients (for pot broadcasts) ─────────────────────────
_clients: set[web.WebSocketResponse] = set()

POT_BROADCAST_HZ = 20  # how often to push pot values to the browser


# ── Pot broadcast loop ────────────────────────────────────────────────────────
async def _broadcast_pots() -> None:
    """Push pot values to all connected clients at POT_BROADCAST_HZ."""
    interval = 1.0 / POT_BROADCAST_HZ
    while True:
        if _clients:
            msg = json.dumps({"type": "pots", "values": leo.pot_values})
            dead = set()
            for ws in _clients:
                try:
                    await ws.send_str(msg)
                except Exception:
                    dead.add(ws)
            _clients.difference_update(dead)
        await asyncio.sleep(interval)


async def _broadcast_json(payload: dict[str, object]) -> None:
    if not _clients:
        return

    msg = json.dumps(payload)
    dead = set()
    for ws in _clients:
        try:
            await ws.send_str(msg)
        except Exception:
            dead.add(ws)
    _clients.difference_update(dead)


async def _broadcast_pid_state() -> None:
    await _broadcast_json({"type": "pid_state", "running": leo.pid_running})


async def _broadcast_pid_targets() -> None:
    await _broadcast_json({"type": "pid_targets", "values": leo.get_pid_targets()})


# ── WebSocket handler ─────────────────────────────────────────────────────────
async def ws_handler(request: web.Request) -> web.WebSocketResponse:
    ws = web.WebSocketResponse(heartbeat=3.0)
    await ws.prepare(request)

    peer = request.remote
    _clients.add(ws)
    log.info("Client connected    [%s]  (total: %d)", peer, len(_clients))

    await ws.send_str(json.dumps({"type": "pid_state", "running": leo.pid_running}))
    await ws.send_str(json.dumps({"type": "pid_targets", "values": leo.get_pid_targets()}))
    await ws.send_str(json.dumps({"type": "pid_tuning", "values": leo.get_pid_tuning()}))

    try:
        async for msg in ws:
            if msg.type == WSMsgType.TEXT:
                _dispatch(msg.data, peer)
            elif msg.type == WSMsgType.ERROR:
                log.error("WS error from %s: %s", peer, ws.exception())
    finally:
        leo.stop_pid()
        _clients.discard(ws)
        leo.stop_all()
        log.info("Client disconnected [%s] — all motors stopped  (total: %d)", peer, len(_clients))

    return ws


def _dispatch(raw: str, peer: str) -> None:
    """Parse and execute one WebSocket message."""
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        log.warning("Non-JSON from %s: %r", peer, raw)
        return

    kind = data.get("type")

    if kind == "motor":
        motor = str(data.get("motor", "")).upper()
        if motor not in leo.motor_names:
            log.warning("Unknown motor %r from %s", motor, peer)
            return
        try:
            value = float(data["value"])
        except (KeyError, TypeError, ValueError) as exc:
            log.warning("Bad motor value from %s: %s", peer, exc)
            return
        leo.set_motor(motor, value)

    elif kind == "pid_start":
        leo.start_pid()
        asyncio.create_task(_broadcast_pid_state())

    elif kind == "pid_stop":
        leo.stop_pid()
        asyncio.create_task(_broadcast_pid_state())
        asyncio.create_task(_broadcast_pid_targets())

    elif kind == "pid_target":
        joint = str(data.get("joint", ""))
        try:
            value = float(data["value"])
        except (KeyError, TypeError, ValueError) as exc:
            log.warning("Bad PID target from %s: %s", peer, exc)
            return

        try:
            leo.set_pid_target(joint, value)
        except KeyError:
            log.warning("Unknown PID joint %r from %s", joint, peer)
            return

        asyncio.create_task(_broadcast_json({"type": "pid_target", "joint": joint, "value": leo.get_pid_targets()[joint]}))

    elif kind == "pid_tune":
        try:
            kp = float(data.get("kp", 0.0))
            ki = float(data.get("ki", 0.0))
            kd = float(data.get("kd", 0.0))
        except (TypeError, ValueError):
            log.warning("Bad PID tuning from %s: %r", peer, data)
            return

        leo.set_pid_tuning(kp, ki, kd)
        asyncio.create_task(_broadcast_json({"type": "pid_tuning", "values": leo.get_pid_tuning()}))

    elif kind == "stop_all":
        leo.stop_pid()
        leo.stop_all()
        log.info("STOP ALL ← %s", peer)

    elif kind == "poweroff":
        log.info("POWER OFF ← %s", peer)
        leo.power_off()

    else:
        log.warning("Unknown command %r from %s", kind, peer)


# ── GitHub Pages proxy ────────────────────────────────────────────────────────
async def proxy_handler(request: web.Request) -> web.Response:
    async with ClientSession() as session:
        path_qs = request.path_qs
        prefix  = "/leo-workspace"
        if path_qs.startswith(prefix):
            path_qs = path_qs[len(prefix):]
            if not path_qs:
                path_qs = "/"

        target_url = f"https://21beckem.github.io/leo-workspace{path_qs}"

        async with session.get(target_url) as resp:
            data = await resp.read()
            return web.Response(
                text=data.decode("utf-8", errors="replace"),
                status=resp.status,
                content_type=resp.content_type,
            )


# ── App startup ───────────────────────────────────────────────────────────────
async def on_startup(app: web.Application) -> None:
    leo.start_polling()
    asyncio.create_task(_broadcast_pots())
    log.info("Pot polling and broadcast loop started")


# ── App assembly ──────────────────────────────────────────────────────────────
def build_app() -> web.Application:
    app = web.Application()
    app.on_startup.append(on_startup)
    # /ws must be registered before the catch-all proxy route
    app.router.add_get("/ws",       ws_handler)
    app.router.add_get("/{path:.*}", proxy_handler)
    return app


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        lan_ip = s.getsockname()[0]
        s.close()
    except Exception:
        lan_ip = "?"

    log.info("━" * 54)
    log.info("  LEO control server is running!")
    log.info("  Open in any browser →  http://%s:9300", lan_ip)
    log.info("  Or →  https://21beckem.github.io/leo-workspace/")
    log.info("━" * 54)

    web.run_app(build_app(), host="0.0.0.0", port=9300, access_log=None)