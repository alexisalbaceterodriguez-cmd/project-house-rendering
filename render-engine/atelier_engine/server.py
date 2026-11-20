"""Local render API for Atelier 60 (stdlib only).

  POST /renders                     body: application/zip render package
  GET  /renders                     recent jobs
  GET  /renders/{id}                job state and progress
  GET  /renders/{id}/outputs        list of produced files
  GET  /renders/{id}/outputs/{name} download one whitelisted file
  POST /renders/{id}/cancel         cancel a queued or running job
  GET  /health                      engine and Blender status

Binds to 127.0.0.1 by default. It is meant to sit next to the editor (or
behind an authenticated gateway); never expose the worker directly to the
internet. Packages are validated in memory before anything touches disk and
Blender runs with --factory-startup --disable-autoexec.
"""
from __future__ import annotations

import glob
import hashlib
import json
import os
import queue
import re
import shutil
import subprocess
import sys
import threading
import time
import uuid
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

from . import contract

ENGINE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RENDER_SCRIPT = os.path.join(ENGINE_ROOT, "blender", "atelier_render.py")


def _engine_revision() -> str:
    """Hash of the Blender script and contract: a change invalidates job reuse."""
    digest = hashlib.sha256()
    for path in (RENDER_SCRIPT, os.path.join(os.path.dirname(os.path.abspath(__file__)), "contract.py")):
        with open(path, "rb") as handle:
            digest.update(handle.read())
    return digest.hexdigest()[:16]


ENGINE_REVISION = _engine_revision()
JOB_ID = re.compile(r"^[0-9a-f]{32}$")
OUTPUT_TYPES = {
    "beauty.png": "image/png",
    "preview.png": "image/png",
    "passes.exr": "image/x-exr",
    "result.json": "application/json",
    "ids.json": "application/json",
    "scene.json": "application/json",
}
FINAL = {"succeeded", "failed", "canceled"}
SAMPLE_LINE = re.compile(r"Sample (\d+)/(\d+)")
STAGE_LINE = re.compile(r"ATELIER_PROGRESS stage=(\w+)")
STAGE_PROGRESS = {"import": 0.03, "camera": 0.06, "lighting": 0.07, "configure": 0.08, "render": 0.1, "save": 0.97, "done": 1.0}
DEFAULT_ORIGINS = "https://alexisalbaceterodriguez-cmd.github.io"


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def find_blender() -> str | None:
    configured = os.environ.get("ATELIER_BLENDER")
    if configured:
        return configured if os.path.isfile(configured) else None
    name = "blender.exe" if os.name == "nt" else "blender"
    local = sorted(glob.glob(os.path.join(ENGINE_ROOT, ".blender", "blender-*", name)))
    if local:
        return local[-1]
    return shutil.which("blender")


class Config:
    def __init__(self, **overrides):
        env = os.environ
        self.host = overrides.get("host", env.get("ATELIER_HOST", "127.0.0.1"))
        self.port = int(overrides.get("port", env.get("ATELIER_PORT", "8765")))
        self.data_dir = os.path.abspath(overrides.get("data_dir", env.get("ATELIER_DATA_DIR", os.path.join(ENGINE_ROOT, "data"))))
        self.blender = overrides.get("blender", find_blender())
        self.device = overrides.get("device", env.get("ATELIER_DEVICE", "AUTO"))
        self.max_queue = int(overrides.get("max_queue", env.get("ATELIER_MAX_QUEUE", "8")))
        self.timeout = float(overrides.get("timeout", env.get("ATELIER_JOB_TIMEOUT", "1800")))
        self.keep_jobs = int(overrides.get("keep_jobs", env.get("ATELIER_KEEP_JOBS", "60")))
        origins = overrides.get("origins", env.get("ATELIER_ALLOWED_ORIGINS", DEFAULT_ORIGINS))
        self.origins = {o.strip().rstrip("/") for o in origins.split(",") if o.strip()}
        self.command = overrides.get("command")  # tests may replace Blender with a fake


class JobStore:
    """Persistent job registry: one directory and one job.json per job."""

    def __init__(self, config: Config):
        self.config = config
        self.root = os.path.join(config.data_dir, "jobs")
        os.makedirs(self.root, exist_ok=True)
        self.lock = threading.RLock()
        self.jobs: dict[str, dict] = {}
        self.cancel_flags: dict[str, threading.Event] = {}
        self.pending: queue.Queue[str] = queue.Queue()
        self._load()

    def _load(self) -> None:
        for path in glob.glob(os.path.join(self.root, "*", "job.json")):
            try:
                with open(path, "r", encoding="utf-8") as handle:
                    job = json.load(handle)
            except (OSError, ValueError):
                continue
            if not JOB_ID.match(str(job.get("id", ""))):
                continue
            self.jobs[job["id"]] = job
        for job in sorted(self.jobs.values(), key=lambda j: j["createdAt"]):
            if job["status"] == "running":
                self._finish(job, "failed", error={"code": "worker_interrupted", "message": "El motor se reinició durante el render. Vuelve a lanzarlo."})
            elif job["status"] == "queued":
                self.cancel_flags[job["id"]] = threading.Event()
                self.pending.put(job["id"])

    def job_dir(self, job_id: str) -> str:
        return os.path.join(self.root, job_id)

    def save(self, job: dict) -> None:
        path = os.path.join(self.job_dir(job["id"]), "job.json")
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as handle:
            json.dump(job, handle, ensure_ascii=False, indent=1)
        os.replace(tmp, path)

    def public(self, job: dict) -> dict:
        data = {k: v for k, v in job.items() if k not in {"idempotencyKey"}}
        return data

    def queued_count(self) -> int:
        return sum(1 for j in self.jobs.values() if j["status"] in {"queued", "running"})

    def create(self, package: contract.Package, idempotency_key: str | None) -> tuple[dict, bool]:
        with self.lock:
            for job in self.jobs.values():
                # Same request (Idempotency-Key) or same package content, rendered by this same
                # engine revision: reuse a live or successful job instead of rendering twice.
                # Failed or cancelled jobs, or an updated render script, render again.
                same = (idempotency_key and job.get("idempotencyKey") == idempotency_key) or job["packageSha256"] == package.sha256
                if same and job.get("engineRevision") == ENGINE_REVISION and job["status"] in {"queued", "running", "succeeded"}:
                    return job, False
            if self.queued_count() >= self.config.max_queue:
                raise contract.PackageError("queue_full", "La cola de render está llena. Espera a que terminen los trabajos en curso.")
            job_id = uuid.uuid4().hex
            directory = self.job_dir(job_id)
            os.makedirs(directory)
            for name, data in package.files.items():
                with open(os.path.join(directory, name), "wb") as handle:
                    handle.write(data)
            manifest = package.manifest
            job = {
                "id": job_id,
                "status": "queued",
                "createdAt": now(),
                "startedAt": None,
                "finishedAt": None,
                "packageSha256": package.sha256,
                "idempotencyKey": idempotency_key,
                "engineRevision": ENGINE_REVISION,
                "project": {"id": manifest["project"]["id"], "name": manifest["project"]["name"]},
                "settings": {
                    "width": manifest["render"]["width"],
                    "height": manifest["render"]["height"],
                    "samples": manifest["render"]["samples"],
                    "quality": manifest["render"]["quality"],
                    "lighting": manifest["lighting"]["preset"],
                    "passes": manifest["render"]["passes"],
                },
                "hasPreview": "preview.png" in package.files,
                "progress": {"stage": "queued", "fraction": 0.0, "sample": 0, "samples": manifest["render"]["samples"]},
                "error": None,
                "result": None,
            }
            self.jobs[job_id] = job
            self.cancel_flags[job_id] = threading.Event()
            self.save(job)
            self.pending.put(job_id)
            self._prune()
            return job, True

    def update(self, job_id: str, **changes) -> dict:
        with self.lock:
            job = self.jobs[job_id]
            job.update(changes)
            self.save(job)
            return job

    def _finish(self, job: dict, status: str, error: dict | None = None, result: dict | None = None) -> None:
        job["status"] = status
        job["finishedAt"] = now()
        job["error"] = error
        job["result"] = result
        if status == "succeeded":
            job["progress"] = {**job.get("progress", {}), "stage": "done", "fraction": 1.0}
        self.save(job)

    def finish(self, job_id: str, status: str, error: dict | None = None, result: dict | None = None) -> None:
        with self.lock:
            self._finish(self.jobs[job_id], status, error, result)

    def cancel(self, job_id: str) -> dict:
        with self.lock:
            job = self.jobs[job_id]
            if job["status"] in FINAL:
                return job
            self.cancel_flags.setdefault(job_id, threading.Event()).set()
            if job["status"] == "queued":
                self._finish(job, "canceled", error={"code": "canceled", "message": "Render cancelado."})
            return job

    def _prune(self) -> None:
        finished = sorted((j for j in self.jobs.values() if j["status"] in FINAL), key=lambda j: j["createdAt"])
        excess = len(self.jobs) - self.config.keep_jobs
        for job in finished[:max(0, excess)]:
            directory = self.job_dir(job["id"])
            if os.path.commonpath([directory, self.root]) == self.root:
                shutil.rmtree(directory, ignore_errors=True)
            self.jobs.pop(job["id"], None)
            self.cancel_flags.pop(job["id"], None)

    def outputs(self, job_id: str) -> list[dict]:
        directory = self.job_dir(job_id)
        files = []
        for name, content_type in OUTPUT_TYPES.items():
            path = os.path.join(directory, name)
            if os.path.isfile(path):
                files.append({"name": name, "contentType": content_type, "bytes": os.path.getsize(path), "url": f"/renders/{job_id}/outputs/{name}"})
        return files


class Worker(threading.Thread):
    """Single render worker: one Blender process at a time on this machine."""

    def __init__(self, store: JobStore):
        super().__init__(daemon=True, name="atelier-render-worker")
        self.store = store
        self.stop = threading.Event()

    def run(self) -> None:
        while not self.stop.is_set():
            try:
                job_id = self.store.pending.get(timeout=0.5)
            except queue.Empty:
                continue
            job = self.store.jobs.get(job_id)
            if job is None or job["status"] != "queued":
                continue
            try:
                self.render(job_id)
            except Exception as exc:  # never let one job kill the worker
                self.store.finish(job_id, "failed", error={"code": "internal_error", "message": f"Fallo del worker: {exc}"})

    def command(self, job_dir: str) -> list[str]:
        config = self.store.config
        if config.command:
            return [*config.command, job_dir]
        if not config.blender:
            raise FileNotFoundError("Blender no está instalado. Ejecuta «python scripts/install_blender.py» en render-engine/ o define ATELIER_BLENDER.")
        return [config.blender, "-b", "--factory-startup", "--disable-autoexec", "-noaudio", "--python-exit-code", "1",
                "-P", RENDER_SCRIPT, "--", "--job-dir", job_dir, "--device", config.device]

    def render(self, job_id: str) -> None:
        store = self.store
        cancel = store.cancel_flags.setdefault(job_id, threading.Event())
        job_dir = store.job_dir(job_id)
        started = time.time()
        store.update(job_id, status="running", startedAt=now(), progress={**store.jobs[job_id]["progress"], "stage": "starting", "fraction": 0.01})
        try:
            command = self.command(job_dir)
        except FileNotFoundError as exc:
            store.finish(job_id, "failed", error={"code": "engine_unavailable", "message": str(exc)})
            return
        log_path = os.path.join(job_dir, "render.log")
        flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        with open(log_path, "w", encoding="utf-8") as log:
            process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL,
                                       text=True, encoding="utf-8", errors="replace", bufsize=1, creationflags=flags)
            reader = threading.Thread(target=self._read, args=(job_id, process, log), daemon=True)
            reader.start()
            reason = None
            while process.poll() is None:
                if cancel.is_set():
                    reason = "canceled"
                elif time.time() - started > store.config.timeout:
                    reason = "timeout"
                if reason:
                    process.kill()
                    break
                time.sleep(0.2)
            process.wait()
            reader.join(timeout=5)
        if reason == "canceled":
            store.finish(job_id, "canceled", error={"code": "canceled", "message": "Render cancelado."})
            return
        if reason == "timeout":
            store.finish(job_id, "failed", error={"code": "timeout", "message": f"El render superó el límite de {int(store.config.timeout)} s."})
            return
        error_path = os.path.join(job_dir, "error.json")
        result_path = os.path.join(job_dir, "result.json")
        if process.returncode == 0 and os.path.isfile(result_path) and os.path.isfile(os.path.join(job_dir, "beauty.png")):
            with open(result_path, "r", encoding="utf-8") as handle:
                result = json.load(handle)
            result["wallSeconds"] = round(time.time() - started, 2)
            store.finish(job_id, "succeeded", result=result)
            return
        error = {"code": "render_failed", "message": f"Blender terminó con código {process.returncode}."}
        if os.path.isfile(error_path):
            try:
                with open(error_path, "r", encoding="utf-8") as handle:
                    data = json.load(handle)
                error = {"code": str(data.get("code", "render_failed"))[:60], "message": str(data.get("message", ""))[:500]}
            except (OSError, ValueError):
                pass
        store.finish(job_id, "failed", error=error)

    def _read(self, job_id: str, process: subprocess.Popen, log) -> None:
        store = self.store
        written = 0
        last_update = 0.0
        for line in process.stdout:  # type: ignore[union-attr]
            if written < 2_000_000:
                log.write(line)
                written += len(line)
            progress = dict(store.jobs[job_id]["progress"])
            changed = False
            stage = STAGE_LINE.search(line)
            if stage:
                progress["stage"] = stage.group(1)
                progress["fraction"] = max(progress.get("fraction", 0), STAGE_PROGRESS.get(stage.group(1), progress.get("fraction", 0)))
                changed = True
            sample = SAMPLE_LINE.search(line)
            if sample:
                done, total = int(sample.group(1)), max(1, int(sample.group(2)))
                progress.update(stage="render", sample=done, samples=total, fraction=max(progress.get("fraction", 0), 0.1 + 0.85 * done / total))
                changed = True
            if changed and (stage or time.time() - last_update > 0.3):
                last_update = time.time()
                store.update(job_id, progress=progress)


class Handler(BaseHTTPRequestHandler):
    server_version = "AtelierRender/1"
    store: JobStore
    config: Config

    def log_message(self, format: str, *args) -> None:  # keep logs short and free of bodies
        sys.stderr.write("[atelier-render] %s %s\n" % (self.address_string(), format % args))

    # ------------------------------------------------------------------ helpers
    def _cors(self) -> None:
        origin = (self.headers.get("Origin") or "").rstrip("/")
        if not origin:
            return
        parsed = urlparse(origin)
        local = parsed.hostname in {"localhost", "127.0.0.1", "[::1]", "::1"} and parsed.scheme in {"http", "https"}
        if local or origin in self.config.origins:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Idempotency-Key")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.send_header("Access-Control-Max-Age", "600")

    def _json(self, status: int, payload) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def _error(self, status: int, code: str, message: str) -> None:
        self._json(status, {"error": {"code": code, "message": message}})

    def _route(self) -> list[str]:
        return [part for part in urlparse(self.path).path.split("/") if part]

    def _job(self, job_id: str) -> dict | None:
        if not JOB_ID.match(job_id):
            return None
        return self.store.jobs.get(job_id)

    # ------------------------------------------------------------------ verbs
    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self) -> None:
        parts = self._route()
        if parts == ["health"]:
            self._json(200, {
                "status": "ok",
                "engine": "blender-cycles",
                "blender": bool(self.config.blender) or bool(self.config.command),
                "device": self.config.device,
                "queue": self.store.queued_count(),
                "maxQueue": self.config.max_queue,
                "limits": {"maxSide": contract.MAX_SIDE, "maxPixels": contract.MAX_PIXELS, "maxSamples": contract.MAX_SAMPLES, "maxPackageBytes": contract.MAX_PACKAGE_BYTES},
            })
            return
        if parts == ["renders"]:
            jobs = sorted(self.store.jobs.values(), key=lambda j: j["createdAt"], reverse=True)[:30]
            self._json(200, {"jobs": [self.store.public(j) for j in jobs]})
            return
        if len(parts) >= 2 and parts[0] == "renders":
            job = self._job(parts[1])
            if job is None:
                self._error(404, "not_found", "Trabajo de render no encontrado.")
                return
            if len(parts) == 2:
                self._json(200, self.store.public(job))
                return
            if len(parts) == 3 and parts[2] == "outputs":
                self._json(200, {"id": job["id"], "status": job["status"], "outputs": self.store.outputs(job["id"])})
                return
            if len(parts) == 4 and parts[2] == "outputs" and parts[3] in OUTPUT_TYPES:
                path = os.path.join(self.store.job_dir(job["id"]), parts[3])
                if not os.path.isfile(path):
                    self._error(404, "not_found", "Ese resultado no existe.")
                    return
                with open(path, "rb") as handle:
                    data = handle.read()
                self.send_response(200)
                self.send_header("Content-Type", OUTPUT_TYPES[parts[3]])
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Cache-Control", "private, max-age=3600")
                self.send_header("X-Content-Type-Options", "nosniff")
                self._cors()
                self.end_headers()
                self.wfile.write(data)
                return
        self._error(404, "not_found", "Ruta no encontrada.")

    def do_POST(self) -> None:
        parts = self._route()
        if parts == ["renders"]:
            self._submit()
            return
        if len(parts) == 3 and parts[0] == "renders" and parts[2] == "cancel":
            job = self._job(parts[1])
            if job is None:
                self._error(404, "not_found", "Trabajo de render no encontrado.")
                return
            self._json(202, self.store.public(self.store.cancel(job["id"])))
            return
        self._error(404, "not_found", "Ruta no encontrada.")

    def _submit(self) -> None:
        length = self.headers.get("Content-Length")
        if length is None or not length.isdigit():
            self._error(411, "length_required", "Falta Content-Length.")
            return
        size = int(length)
        if size > contract.MAX_PACKAGE_BYTES:
            self._error(413, "limit_exceeded", "El paquete supera el tamaño máximo.")
            return
        content_type = (self.headers.get("Content-Type") or "").split(";")[0].strip()
        if content_type not in {"application/zip", "application/octet-stream"}:
            self._error(415, "unsupported_media_type", "Envía el paquete como application/zip.")
            return
        key = (self.headers.get("Idempotency-Key") or "").strip()[:128] or None
        data = self.rfile.read(size)
        try:
            package = contract.read_package(data)
            job, created = self.store.create(package, key)
        except contract.PackageError as exc:
            self._error(429 if exc.code == "queue_full" else 422, exc.code, exc.message)
            return
        self._json(201 if created else 200, {**self.store.public(job), "reused": not created})


def make_server(config: Config | None = None) -> tuple[ThreadingHTTPServer, JobStore, Worker]:
    config = config or Config()
    store = JobStore(config)
    handler = type("AtelierHandler", (Handler,), {"store": store, "config": config})
    server = ThreadingHTTPServer((config.host, config.port), handler)
    server.daemon_threads = True
    worker = Worker(store)
    worker.start()
    return server, store, worker


def main() -> None:
    config = Config()
    server, store, worker = make_server(config)
    print(f"Atelier render engine on http://{config.host}:{server.server_address[1]}")
    print(f"  Blender: {config.blender or 'NO ENCONTRADO'}")
    print(f"  Datos:   {config.data_dir}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        worker.stop.set()
        server.server_close()


if __name__ == "__main__":
    main()
