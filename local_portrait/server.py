"""Loopback-only, same-origin static UI and local portrait inference.

Run: python local_portrait/server.py
Only /api/local/compare accepts image data; it is never archived or logged.
The server has no outbound network operations. Startup requires built UI files.
"""
from __future__ import annotations

import io
import json
import mimetypes
import os
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit, parse_qs
from threading import BoundedSemaphore

from PIL import Image, UnidentifiedImageError

try:
    from .processing import compare, readiness
    from . import testset
except ImportError:
    from processing import compare, readiness
    import testset

ROOT = Path(__file__).resolve().parents[1]
DIST = (ROOT / "dist-stickerwall").resolve()
HOST = "127.0.0.1"
PORT = 8765
MAX_UPLOAD = 5 * 1024 * 1024
# Prevent concurrent heavy CPU inference requests.
INFERENCE_LOCK = BoundedSemaphore(1)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Never print paths, queries, image data, or request bodies.
        return

    def _headers(self, status, content_type, length):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(length))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self'; "
            "connect-src 'self'; img-src 'self' data: blob:; "
            "font-src 'self'; object-src 'none'; frame-ancestors 'none'; "
            "base-uri 'none'; form-action 'self'"
        )
        self.end_headers()

    def _send(self, status, body: bytes, mime="application/json; charset=utf-8"):
        self._headers(status, mime, len(body))
        self.wfile.write(body)

    def _json(self, status, payload):
        self._send(status, json.dumps(payload, ensure_ascii=False).encode("utf-8"))

    def _trusted(self):
        host = self.headers.get("Host", "")
        allowed = (f"127.0.0.1:{PORT}", f"localhost:{PORT}")
        if host not in allowed:
            return False
        origin = self.headers.get("Origin")
        if origin and origin not in (f"http://{allowed[0]}", f"http://{allowed[1]}"):
            return False
        if self.headers.get("Sec-Fetch-Site") == "cross-site":
            return False
        return True

    def do_GET(self):
        if not self._trusted():
            self._json(403, {"error": "Alleen lokaal gebruik toegestaan."})
            return
        route = urlsplit(self.path).path
        if route == "/api/local/status":
            self._json(200, {"local": True, "protocol": 8, "engines": readiness()})
            return
        if route.startswith("/api/local/testset/"):
            try:
                data = testset.read(route.rsplit("/",1)[1])
                if data is None:
                    self._json(404, {"error":"Testportret nog niet ingesteld."})
                else:
                    self._send(200, data, "image/png")
            except (ValueError,OSError) as exc:
                self._json(400, {"error":str(exc)})
            return
        if route == "/":
            route = "/stickerwall.html"
        # Never serve anything outside the isolated Vite build.
        file = (DIST / unquote(route).lstrip("/")).resolve()
        if not file.is_relative_to(DIST) or not file.is_file() or file.name.startswith("."):
            self._json(404, {"error": "Niet gevonden."})
            return
        data = file.read_bytes()
        mime = mimetypes.guess_type(str(file))[0] or "application/octet-stream"
        if mime.startswith("text/") or mime == "application/javascript":
            mime += "; charset=utf-8"
        self._send(200, data, mime)

    def do_POST(self):
        route = urlsplit(self.path).path
        if not self._trusted() or not (route == "/api/local/compare" or route.startswith("/api/local/testset/")):
            self._json(403, {"error": "Alleen dezelfde lokale pagina mag portretten verwerken."})
            return
        if self.headers.get("Content-Type", "").split(";")[0] != "image/png":
            self._json(415, {"error": "Alleen PNG ondersteund."})
            return
        try:
            count = int(self.headers.get("Content-Length", "-1"))
        except ValueError:
            count = -1
        if count < 1 or count > MAX_UPLOAD:
            self._json(413, {"error": "Foto te groot of ontbreekt."})
            return
        if not INFERENCE_LOCK.acquire(blocking=False):
            self._json(429, {"error": "Er wordt al een foto verwerkt."})
            return
        try:
            raw = self.rfile.read(count)
            if not raw.startswith(b"\x89PNG\r\n\x1a\n"):
                self._json(415, {"error": "Ongeldige PNG."})
                return
            try:
                with Image.open(io.BytesIO(raw)) as image:
                    # Check dimensions before decoding pixel data to bound memory use.
                    if image.width > 1024 or image.height > 1024 or image.width < 96 or image.height < 96:
                        self._json(400, {"error": "Afbeelding moet tussen 96 en 1024 pixels breed en hoog zijn."})
                        return
                    image.load()
                    source = image.convert("RGB")
            except (UnidentifiedImageError, ValueError, OSError):
                self._json(400, {"error": "Kan de afbeelding niet openen."})
                return
            if route.startswith("/api/local/testset/"):
                try:
                    testset.save(route.rsplit("/",1)[1], source)
                    self._json(200, {"saved":True})
                except (ValueError,OSError) as exc:
                    self._json(400, {"error":str(exc)})
                return
            # Ordinary inference remains in memory. Only explicit testset POSTs save.
            query = parse_qs(urlsplit(self.path).query)
            self._json(200, {"results": compare(source, include_references=query.get("references")==["1"], include_cartoons=query.get("cartoons")==["1"])})
        finally:
            INFERENCE_LOCK.release()

    def do_DELETE(self):
        route = urlsplit(self.path).path
        if not self._trusted() or not route.startswith("/api/local/testset/"):
            self._json(403, {"error":"Alleen lokaal toegestaan."})
            return
        try:
            testset.remove(route.rsplit("/",1)[1])
            self._json(200, {"removed":True})
        except (ValueError,OSError) as exc:
            self._json(400, {"error":str(exc)})


def main():
    if not (DIST / "stickerwall.html").is_file():
        raise SystemExit("Build ontbreekt: voer eerst npm run stickerwall:build uit.")
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Sticky Wall lokaal: http://{HOST}:{PORT}/stickerwall.html")
    print("Cartoonlab 0.8: Cartoon First, vaste lokale testset. Geen cloud-API.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
