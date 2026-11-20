"""Download a portable Blender LTS build into render-engine/.blender/.

Only download.blender.org is used, and the archive is verified against the
SHA-256 list Blender publishes for the release before it is extracted.

    python scripts/install_blender.py            # Blender 4.5.16 LTS for this OS
    python scripts/install_blender.py --check    # show what would be installed
"""
from __future__ import annotations

import argparse
import hashlib
import os
import platform
import shutil
import sys
import tarfile
import tempfile
import urllib.request
import zipfile

VERSION = "4.5.16"
BASE = f"https://download.blender.org/release/Blender{VERSION.rsplit('.', 1)[0]}/"
ENGINE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = os.path.join(ENGINE_ROOT, ".blender")


def archive_name() -> str:
    system, machine = platform.system(), platform.machine().lower()
    if system == "Windows" and machine in ("amd64", "x86_64"):
        return f"blender-{VERSION}-windows-x64.zip"
    if system == "Linux" and machine in ("x86_64", "amd64"):
        return f"blender-{VERSION}-linux-x64.tar.xz"
    raise SystemExit(f"Plataforma no soportada por este instalador ({system} {machine}). Instala Blender {VERSION} y define ATELIER_BLENDER.")


def fetch(url: str, dest: str) -> None:
    request = urllib.request.Request(url, headers={"User-Agent": "atelier-render-engine-installer"})
    with urllib.request.urlopen(request, timeout=60) as response, open(dest, "wb") as out:
        total = int(response.headers.get("Content-Length") or 0)
        done = 0
        while chunk := response.read(1 << 20):
            out.write(chunk)
            done += len(chunk)
            if total:
                print(f"\r  {done / total:6.1%} de {total / 1e6:.0f} MB", end="", flush=True)
    print()


def expected_sha256(name: str) -> str:
    with urllib.request.urlopen(urllib.request.Request(BASE + f"blender-{VERSION}.sha256", headers={"User-Agent": "atelier-render-engine-installer"}), timeout=30) as response:
        for line in response.read().decode().splitlines():
            parts = line.split()
            if len(parts) == 2 and parts[1].lstrip("*") == name:
                return parts[0].lower()
    raise SystemExit(f"{name} no aparece en la lista oficial de SHA-256 de Blender {VERSION}.")


def safe_extract(archive: str, dest: str) -> None:
    root = os.path.realpath(dest)

    def check(member: str) -> None:
        if not os.path.realpath(os.path.join(dest, member)).startswith(root + os.sep):
            raise SystemExit(f"Ruta insegura dentro del archivo: {member}")

    if archive.endswith(".zip"):
        with zipfile.ZipFile(archive) as z:
            for member in z.namelist():
                check(member)
            z.extractall(dest)
    else:
        with tarfile.open(archive) as t:
            for member in t.getmembers():
                check(member.name)
            t.extractall(dest, filter="data") if sys.version_info >= (3, 12) else t.extractall(dest)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", action="store_true", help="solo mostrar el archivo y el destino")
    args = parser.parse_args()
    name = archive_name()
    folder = os.path.join(TARGET, name.removesuffix(".zip").removesuffix(".tar.xz"))
    print(f"Blender {VERSION}: {BASE}{name}\nDestino: {folder}")
    if os.path.isdir(folder):
        print("Ya está instalado.")
        return 0
    if args.check:
        return 0
    os.makedirs(TARGET, exist_ok=True)
    digest = expected_sha256(name)
    with tempfile.TemporaryDirectory(dir=TARGET) as tmp:
        archive = os.path.join(tmp, name)
        fetch(BASE + name, archive)
        sha = hashlib.sha256()
        with open(archive, "rb") as f:
            while chunk := f.read(1 << 20):
                sha.update(chunk)
        if sha.hexdigest() != digest:
            raise SystemExit(f"SHA-256 no coincide ({sha.hexdigest()} ≠ {digest}); archivo descartado.")
        print("SHA-256 verificado. Extrayendo…")
        extract = os.path.join(tmp, "x")
        safe_extract(archive, extract)
        shutil.move(os.path.join(extract, os.listdir(extract)[0]), folder)
    print(f"Listo. El motor encontrará Blender en {folder}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
