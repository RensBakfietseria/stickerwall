"""Manual source-only updater. Never imported by the portrait server."""
from __future__ import annotations

import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import socket
import stat
import subprocess
import sys
import tempfile
import urllib.request
import zipfile

REPO = "RensBakfietseria/stickerwall"
CHANNEL = "stickerwall-local-stable"
STATE = ".stickerwall-update-state.json"
LOCK = ".stickerwall-update.lock"
ROOT_FILES = {"stickerwall.html", "STICKERWALL.md", "LICENSE", "package.json",
              "package-lock.json", "vite.stickerwall.config.ts", "tsconfig.json", "update.cmd"}
REQUIRED = {"stickerwall.html", "package.json", "package-lock.json",
            "vite.stickerwall.config.ts", "src/stickerwall/main.ts",
            "local_portrait/setup.ps1", "local_portrait/start.ps1",
            "local_portrait/server.py", "local_portrait/update.py", "update.cmd"}
MAX_ZIP = 32 * 1024 * 1024


def digest(data):
    return hashlib.sha256(data).hexdigest()


def safe_path(name):
    if not name or "\\" in name or ":" in name or name.startswith("/"):
        raise ValueError("Ongeldig archiefpad")
    parts = name.split("/")
    if any(p in ("", ".", "..") or p.endswith((" ", ".")) for p in parts):
        raise ValueError("Ongeldig archiefpad")
    return parts


def managed(name):
    parts = safe_path(name)
    if any(p.startswith(".") for p in parts):
        return False
    if name in ROOT_FILES:
        return True
    if parts[0] in ("src", "public"):
        return len(parts) > 1
    return (parts[0] == "local_portrait" and len(parts) > 1
            and not any(p in ("assets", "__pycache__", "models", "photos", "portraits", "data") for p in parts[1:])
            and PurePosixPath(name).suffix.lower() in (".py", ".ps1", ".mjs", ".js", ".ts", ".json", ".txt", ".md"))


def archive_files(payload):
    files, seen, prefixes = {}, set(), set()
    total = 0
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        for entry in archive.infolist():
            if entry.is_dir():
                continue
            parts = safe_path(entry.filename)
            if len(parts) < 2:
                raise ValueError("Geen GitHub-projectarchief")
            prefixes.add(parts[0])
            rel = "/".join(parts[1:])
            if not managed(rel):
                continue
            if stat.S_ISLNK(entry.external_attr >> 16) or rel.casefold() in seen:
                raise ValueError("Onveilig of dubbel bronbestand")
            seen.add(rel.casefold())
            total += entry.file_size
            if total > 64 * 1024 * 1024:
                raise ValueError("Updatearchief te groot")
            files[rel] = archive.read(entry)
    if len(prefixes) != 1 or not REQUIRED <= files.keys():
        raise ValueError("Onvolledige Stickerwall-release")
    return files


def download(url, limit):
    request = urllib.request.Request(url, headers={"User-Agent": "Stickerwall-local-updater/1"})
    with urllib.request.urlopen(request, timeout=60) as response:
        data = response.read(limit + 1)
    if len(data) > limit:
        raise ValueError("Download te groot")
    return data


def latest_commit():
    info = json.loads(download(f"https://api.github.com/repos/{REPO}/branches/{CHANNEL}", 1_000_000))
    sha = info["commit"]["sha"]
    if not isinstance(sha, str) or not re.fullmatch(r"[a-f0-9]{40}", sha):
        raise ValueError("Ongeldige release-commit")
    return sha


def target(root, rel):
    if not managed(rel):
        raise ValueError(f"Bestand buiten beheerde code: {rel}")
    out = root / rel
    if not out.resolve().is_relative_to(root) or out.is_symlink():
        raise ValueError(f"Onveilig doelpad: {rel}")
    return out


def read_state(root):
    path = root / STATE
    return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}


def setup(root, python_changed, node_changed):
    env = dict(os.environ)
    env["STICKERWALL_REFRESH_PYTHON"] = "1" if python_changed else "0"
    env["STICKERWALL_REFRESH_NODE"] = "1" if node_changed else "0"
    subprocess.run(["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass",
                    "-File", str(root / "local_portrait/setup.ps1")],
                   cwd=root, env=env, check=True)


def apply_release(root, files, commit, install=setup):
    root = root.resolve()
    old_state = read_state(root)
    originals, changed = {}, {}
    hashes = {p: digest(data) for p, data in files.items()}
    for rel, data in files.items():
        dest = target(root, rel)
        previous = dest.read_bytes() if dest.is_file() else None
        if previous != data:
            # Refuse to overwrite edits after the first managed installation.
            old_hash = old_state.get("files", {}).get(rel)
            if old_hash and previous is not None and digest(previous) != old_hash:
                raise ValueError(f"Lokaal gewijzigde code; update gestopt: {rel}")
            changed[rel] = data
            originals[rel] = previous
    for rel, old_hash in old_state.get("files", {}).items():
        if rel not in files:
            dest = target(root, rel)
            if dest.is_file():
                previous = dest.read_bytes()
                if digest(previous) != old_hash:
                    raise ValueError(f"Lokaal gewijzigde code; update gestopt: {rel}")
                originals[rel] = previous
    dist = root / "dist-stickerwall"
    if old_state.get("commit") == commit and not originals and (dist / "stickerwall.html").is_file():
        print(f"Al bijgewerkt: {commit[:10]}")
        return False
    py_changed = "local_portrait/requirements.txt" in originals
    node_changed = any(p in originals for p in ("package.json", "package-lock.json"))
    with tempfile.TemporaryDirectory(prefix="sw-update-") as work:
        backup = Path(work) / "dist"
        had_dist = dist.exists()
        if had_dist:
            if not dist.is_dir() or dist.is_symlink() or not dist.resolve().is_relative_to(root):
                raise ValueError("Onveilig buildpad")
            shutil.copytree(dist, backup)
        try:
            for rel, data in changed.items():
                dest = target(root, rel)
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(data)
            for rel in originals.keys() - changed.keys():
                target(root, rel).unlink()
            print(f"Release {commit[:10]}: {len(originals)} gewijzigde bronbestanden.")
            install(root, py_changed, node_changed)
            if not (dist / "stickerwall.html").is_file():
                raise RuntimeError("Nieuwe websitebuild ontbreekt")
            tmp = root / (STATE + ".tmp")
            tmp.write_text(json.dumps({"commit": commit, "files": hashes}, indent=2), encoding="utf-8")
            tmp.replace(root / STATE)
        except BaseException:
            print("Update mislukt: vorige broncode en websitebuild herstellen.", file=sys.stderr)
            for rel, previous in originals.items():
                dest = target(root, rel)
                if previous is None:
                    dest.unlink(missing_ok=True)
                else:
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    dest.write_bytes(previous)
            if dist.exists():
                shutil.rmtree(dist)
            if had_dist:
                shutil.copytree(backup, dist)
            (root / (STATE + ".tmp")).unlink(missing_ok=True)
            print("Gewijzigde afhankelijkheden worden niet automatisch teruggedraaid. Voer zo nodig de herstelde setup opnieuw uit.", file=sys.stderr)
            raise
    print(f"Update geslaagd: {commit[:10]}. Start Stickerwall zoals gebruikelijk.")
    return True


def assert_server_stopped():
    with socket.socket() as probe:
        try:
            probe.bind(("127.0.0.1", 8765))
        except OSError as exc:
            raise RuntimeError("Sluit eerst het oude Stickerwall-servervenster met Ctrl+C (poort 8765 bezet).") from exc


def main():
    root = Path(__file__).resolve().parents[1]
    try:
        if not (root / "stickerwall.html").is_file() or not (root / "local_portrait/setup.ps1").is_file():
            raise ValueError("Geen bestaande Stickerwall-installatie")
        assert_server_stopped()
        lock = root / LOCK
        try:
            fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except FileExistsError as exc:
            raise RuntimeError("Een update loopt al of is onderbroken. Controleer dit voordat je de lock verwijdert.") from exc
        os.close(fd)
        try:
            print("Controleren op vrijgegeven Stickerwall-update...")
            sha = latest_commit()
            if read_state(root).get("commit") == sha and (root / "dist-stickerwall/stickerwall.html").is_file():
                print(f"Geen nieuwe update ({sha[:10]}).")
                return 0
            payload = download(f"https://codeload.github.com/{REPO}/zip/{sha}", MAX_ZIP)
            apply_release(root, archive_files(payload), sha)
            return 0
        finally:
            lock.unlink(missing_ok=True)
    except (Exception, KeyboardInterrupt) as exc:
        print(f"Update afgebroken: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
