"""Stand-in for Blender in server tests. Behaviour depends on project.name."""
import json
import os
import sys
import time
import zlib
import struct

job_dir = sys.argv[-1]
with open(os.path.join(job_dir, "scene.json"), "r", encoding="utf-8") as handle:
    name = json.load(handle)["project"]["name"]

print("ATELIER_PROGRESS stage=import", flush=True)
if name == "fail":
    with open(os.path.join(job_dir, "error.json"), "w", encoding="utf-8") as handle:
        json.dump({"status": "failed", "code": "import_failed", "message": "Geometría rota."}, handle)
    sys.exit(1)
if name == "slow":
    for i in range(300):
        print(f"Fra:1 | Sample {i}/300", flush=True)
        time.sleep(0.05)
for i in (4, 8, 16):
    print(f"Fra:1 Mem:1M | Scene, ViewLayer | Sample {i}/16", flush=True)


def png(width=2, height=2):
    raw = b"".join(b"\x00" + b"\x80\x80\x80" * width for _ in range(height))
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


with open(os.path.join(job_dir, "beauty.png"), "wb") as handle:
    handle.write(png())
with open(os.path.join(job_dir, "result.json"), "w", encoding="utf-8") as handle:
    json.dump({"status": "succeeded", "device": "FAKE", "renderSeconds": 0.01}, handle)
print("ATELIER_PROGRESS stage=done", flush=True)
