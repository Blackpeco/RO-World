#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""RO-World — static file server + live PvP rooms (stdlib only)."""

from __future__ import annotations

import json
import os
import random
import socket
import threading
import time
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("ATB_PORT", "8765"))
ALPH = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
DISCONNECT_SEC = 45.0
ROOM_TTL = 2 * 60 * 60

rooms = {}
lock = threading.Lock()


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return "127.0.0.1"
    finally:
        s.close()


def new_code():
    for n in (4, 5, 6):
        for _ in range(40):
            c = "".join(random.choice(ALPH) for _ in range(n))
            if c not in rooms:
                return c
    return "".join(random.choice(ALPH) for _ in range(6))


class Player:
    def __init__(self, seat, name):
        self.seat = seat
        self.token = uuid.uuid4().hex
        self.name = name
        self.hero_id = None
        self.allocated = None
        self.skill_ranks = None
        self.ready = False
        self.last_seen = time.time()

    def public(self):
        return {
            "name": self.name,
            "heroId": self.hero_id,
            "ready": self.ready,
            "hasAlloc": bool(self.allocated),
            "allocated": self.allocated,
            "skillRanks": self.skill_ranks,
            "hasSkills": bool(self.skill_ranks),
            "connected": (time.time() - self.last_seen) < DISCONNECT_SEC,
        }


class Room:
    def __init__(self, code):
        self.code = code
        self.host = None
        self.guest = None
        self.phase = "lobby"
        self.combat = None
        self.version = 1
        self.pending_skill = None
        self.cv = threading.Condition()
        self.created = time.time()
        self.msg = None
        self.dead = False

    def bump(self):
        self.version += 1
        with self.cv:
            self.cv.notify_all()

    def player_by_token(self, token):
        if self.host and self.host.token == token:
            return self.host
        if self.guest and self.guest.token == token:
            return self.guest
        return None

    def other(self, p):
        if p is self.host:
            return self.guest
        return self.host


def server_info():
    ip = lan_ip()
    return {
        "port": PORT,
        "local": "http://127.0.0.1:%d/" % PORT,
        "lan": "http://%s:%d/" % (ip, PORT),
        "ip": ip,
    }


def public_room(room, me):
    return {
        "ok": True,
        "v": room.version,
        "code": room.code,
        "phase": "dead" if room.dead else room.phase,
        "seat": me.seat if me else None,
        "msg": room.msg,
        "host": room.host.public() if room.host else None,
        "guest": room.guest.public() if room.guest else None,
        "pendingSkill": room.pending_skill if (me and me.seat == "host") else None,
        "combat": room.combat,
        "info": server_info(),
        "dead": room.dead,
    }


def check_disconnect(room):
    if room.dead:
        return
    now = time.time()
    if room.phase in ("fight", "over") or (room.host and room.guest):
        for p in (room.host, room.guest):
            if p and (now - p.last_seen) > DISCONNECT_SEC:
                room.dead = True
                room.phase = "dead"
                room.msg = "เพื่อนออกจากห้อง"
                room.bump()
                return


def janitor():
    while True:
        time.sleep(2)
        now = time.time()
        with lock:
            dead_codes = []
            for code, room in list(rooms.items()):
                check_disconnect(room)
                if now - room.created > ROOM_TTL:
                    dead_codes.append(code)
            for c in dead_codes:
                rooms.pop(c, None)


def read_json(handler):
    n = int(handler.headers.get("Content-Length") or 0)
    if n <= 0:
        return {}
    raw = handler.rfile.read(n)
    if not raw:
        return {}
    try:
        return json.loads(raw.decode("utf-8"))
    except Exception:
        return {}


def write_json(handler, obj, status=200):
    data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(data)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(data)


def create_room(name):
    with lock:
        code = new_code()
        room = Room(code)
        host = Player("host", name or "เจ้าของห้อง")
        room.host = host
        rooms[code] = room
        out = public_room(room, host)
        out["token"] = host.token
        return out


def join_room(code, name):
    code = (code or "").strip().upper()
    with lock:
        room = rooms.get(code)
        if not room or room.dead:
            return {"ok": False, "error": "ไม่พบห้องนี้"}
        if room.guest:
            return {"ok": False, "error": "ห้องเต็มแล้ว"}
        if room.phase != "lobby":
            return {"ok": False, "error": "ห้องนี้เริ่มต่อสู้แล้ว"}
        guest = Player("guest", name or "ผู้เข้าร่วม")
        room.guest = guest
        room.bump()
        out = public_room(room, guest)
        out["token"] = guest.token
        return out


def do_action(body):
    code = (body.get("code") or "").strip().upper()
    token = body.get("token") or ""
    typ = body.get("type") or ""
    with lock:
        room = rooms.get(code)
        if not room:
            return {"ok": False, "error": "ไม่พบห้องนี้"}
        me = room.player_by_token(token)
        if not me:
            return {"ok": False, "error": "โทเคนไม่ถูกต้อง"}
        me.last_seen = time.time()
        check_disconnect(room)
        if room.dead and typ != "leave":
            out = public_room(room, me)
            return out

        if typ == "leave":
            room.dead = True
            room.phase = "dead"
            room.msg = "เพื่อนออกจากห้อง"
            room.bump()
            return {"ok": True, "left": True}

        if typ == "name":
            nm = str(body.get("name") or "").strip()[:24]
            if nm:
                me.name = nm
                me.ready = False
                room.bump()

        elif typ == "pick":
            hid = body.get("heroId")
            alloc = body.get("allocated")
            if hid not in ("warrior", "assassin", "hunter"):
                return {"ok": False, "error": "ฮีโร่ไม่ถูกต้อง"}
            if not isinstance(alloc, dict):
                return {"ok": False, "error": "แต้มไม่ถูกต้อง"}
            me.hero_id = hid
            me.allocated = alloc
            ranks = body.get("skillRanks")
            if ranks is not None and not isinstance(ranks, dict):
                return {"ok": False, "error": "ต้นไม้สกิลไม่ถูกต้อง"}
            me.skill_ranks = ranks
            me.ready = False
            room.bump()

        elif typ == "ready":
            want = bool(body.get("ready"))
            if want and (not me.hero_id or not me.allocated):
                return {"ok": False, "error": "เลือกฮีโร่และแจกแต้มก่อน"}
            me.ready = want
            room.bump()

        elif typ == "skill":
            if room.phase != "fight" or not room.combat:
                return {"ok": False, "error": "ยังไม่เริ่มต่อสู้"}
            sid = body.get("skillId")
            if not sid:
                return {"ok": False, "error": "ไม่มีสกิล"}
            waiting = (room.combat or {}).get("waitingAction")
            my_side = "left" if me.seat == "host" else "right"
            if waiting != my_side:
                return {"ok": False, "error": "ยังไม่ถึงตาคุณ"}
            if me.seat == "guest":
                room.pending_skill = sid
                room.bump()
            else:
                return {"ok": False, "error": "เจ้าของห้องใช้สกิลบนเครื่องแล้วส่ง snapshot"}

        elif typ == "ack_skill":
            if me.seat != "host":
                return {"ok": False, "error": "เฉพาะเจ้าของห้อง"}
            room.pending_skill = None
            room.bump()

        elif typ == "snapshot":
            if me.seat != "host":
                return {"ok": False, "error": "เฉพาะเจ้าของห้องส่งสถานะ"}
            combat = body.get("combat")
            if not isinstance(combat, dict):
                return {"ok": False, "error": "สถานะไม่ถูกต้อง"}
            room.combat = combat
            phase = body.get("phase") or "fight"
            if phase in ("fight", "over", "lobby"):
                room.phase = phase
            room.pending_skill = None
            room.bump()

        else:
            return {"ok": False, "error": "คำสั่งไม่รู้จัก"}

        return public_room(room, me)


def wait_state(code, token, since_v, wait):
    with lock:
        room = rooms.get(code)
        if not room:
            return {"ok": False, "error": "ไม่พบห้องนี้"}
        me = room.player_by_token(token)
        if not me:
            return {"ok": False, "error": "โทเคนไม่ถูกต้อง"}
        me.last_seen = time.time()
        check_disconnect(room)
        if (not wait) or room.version > since_v:
            return public_room(room, me)
        cv = room.cv
    # wait outside the global lock
    with cv:
        cv.wait(timeout=20)
    with lock:
        room = rooms.get(code)
        if not room:
            return {"ok": False, "error": "ไม่พบห้องนี้"}
        me = room.player_by_token(token)
        if not me:
            return {"ok": False, "error": "โทเคนไม่ถูกต้อง"}
        me.last_seen = time.time()
        check_disconnect(room)
        return public_room(room, me)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, fmt, *args):
        sys_stderr = __import__("sys").stderr
        sys_stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _api_path(self):
        parsed = urlparse(self.path)
        return parsed.path.rstrip("/") or "/", parse_qs(parsed.query)

    def do_GET(self):
        path, q = self._api_path()
        if path.startswith("/api"):
            if path == "/api/info":
                write_json(self, {"ok": True, **server_info()})
                return
            if path in ("/api/room/create", "/api/room") and (
                path == "/api/room/create" or q.get("op", [""])[0] == "create"
            ):
                write_json(self, create_room(q.get("name", [""])[0]))
                return
            if path == "/api/room/state":
                code = (q.get("code", [""])[0] or "").strip().upper()
                token = q.get("token", [""])[0]
                try:
                    v = int(q.get("v", ["0"])[0] or 0)
                except ValueError:
                    v = 0
                wait = q.get("wait", ["0"])[0] in ("1", "true", "yes")
                write_json(self, wait_state(code, token, v, wait))
                return
            write_json(self, {"ok": False, "error": "not found", "path": path}, 404)
            return
        if path == "/":
            self.path = "/index.html"
        return SimpleHTTPRequestHandler.do_GET(self)

    def do_POST(self):
        path, q = self._api_path()
        body = read_json(self)
        if path == "/api/room/create":
            write_json(self, create_room(body.get("name") or q.get("name", [""])[0] or ""))
            return
        if path == "/api/room/join":
            write_json(self, join_room(body.get("code") or "", body.get("name") or ""))
            return
        if path == "/api/room/action":
            write_json(self, do_action(body))
            return
        write_json(self, {"ok": False, "error": "not found", "path": path}, 404)


def main():
    threading.Thread(target=janitor, daemon=True).start()
    ThreadingHTTPServer.allow_reuse_address = True
    try:
        httpd = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    except OSError as e:
        print("พอร์ต %d ถูกใช้แล้ว — ปิด python3 -m http.server หรือโปรเซสอื่นบนพอร์ตนี้ แล้วรันใหม่" % PORT)
        print(e)
        raise SystemExit(1)
    info = server_info()
    print("RO-World")
    print("เปิดเกม (เครื่องนี้):  %s" % info["local"])
    print("เปิดเกม (LAN / ไวไฟเดียวกัน):  %s" % info["lan"])
    print("สร้างห้อง / เข้าห้อง ได้จากเมนู PvP")
    print("กด Ctrl+C เพื่อหยุด")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nหยุดเซิร์ฟเวอร์แล้ว")
        httpd.server_close()


if __name__ == "__main__":
    main()
