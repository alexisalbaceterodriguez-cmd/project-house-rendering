import json
import os
import shutil
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request

from atelier_engine import server as srv
from tests import fixtures

FAKE = os.path.join(os.path.dirname(__file__), "fake_render.py")


def named_package(name: str) -> bytes:
    glb = fixtures.room_glb()
    scene = fixtures.manifest(glb)
    scene["project"]["name"] = name
    return fixtures.package(glb, scene)


class ServerTests(unittest.TestCase):
    def setUp(self):
        self.data_dir = tempfile.mkdtemp(prefix="atelier-test-")
        self.start()

    def start(self):
        config = srv.Config(port=0, data_dir=self.data_dir, command=[sys.executable, FAKE], max_queue=3, keep_jobs=50)
        self.server, self.store, self.worker = srv.make_server(config)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.base = f"http://127.0.0.1:{self.server.server_address[1]}"

    def stop(self):
        self.worker.stop.set()
        self.server.shutdown()
        self.server.server_close()
        self.worker.join(timeout=5)

    def tearDown(self):
        self.stop()
        shutil.rmtree(self.data_dir, ignore_errors=True)

    def request(self, method, path, body=None, headers=None):
        req = urllib.request.Request(self.base + path, data=body, method=method, headers=headers or {})
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                raw = response.read()
                return response.status, dict(response.headers), raw
        except urllib.error.HTTPError as error:
            return error.code, dict(error.headers), error.read()

    def submit(self, package, key=None):
        headers = {"Content-Type": "application/zip"}
        if key:
            headers["Idempotency-Key"] = key
        status, _, raw = self.request("POST", "/renders", package, headers)
        return status, json.loads(raw)

    def wait(self, job_id, final=("succeeded", "failed", "canceled"), timeout=15):
        deadline = time.time() + timeout
        while time.time() < deadline:
            _, _, raw = self.request("GET", f"/renders/{job_id}")
            job = json.loads(raw)
            if job["status"] in final:
                return job
            time.sleep(0.05)
        self.fail(f"job {job_id} did not finish")

    def test_health_and_cors(self):
        status, headers, raw = self.request("GET", "/health", headers={"Origin": "http://localhost:5173"})
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(raw)["engine"], "blender-cycles")
        self.assertEqual(headers.get("Access-Control-Allow-Origin"), "http://localhost:5173")
        _, headers, _ = self.request("GET", "/health", headers={"Origin": "https://evil.example"})
        self.assertIsNone(headers.get("Access-Control-Allow-Origin"))
        status, headers, _ = self.request("OPTIONS", "/renders", headers={"Origin": "https://alexisalbaceterodriguez-cmd.github.io", "Access-Control-Request-Private-Network": "true"})
        self.assertEqual(status, 204)
        self.assertEqual(headers.get("Access-Control-Allow-Private-Network"), "true")

    def test_render_lifecycle_and_outputs(self):
        status, job = self.submit(named_package("ok"))
        self.assertEqual(status, 201)
        done = self.wait(job["id"])
        self.assertEqual(done["status"], "succeeded", done)
        self.assertEqual(done["progress"]["fraction"], 1.0)
        self.assertEqual(done["result"]["device"], "FAKE")
        _, _, raw = self.request("GET", f"/renders/{job['id']}/outputs")
        names = {o["name"] for o in json.loads(raw)["outputs"]}
        self.assertTrue({"beauty.png", "result.json", "scene.json"} <= names)
        status, headers, png = self.request("GET", f"/renders/{job['id']}/outputs/beauty.png")
        self.assertEqual(status, 200)
        self.assertEqual(headers["Content-Type"], "image/png")
        self.assertTrue(png.startswith(b"\x89PNG"))
        status, _, _ = self.request("GET", f"/renders/{job['id']}/outputs/render.log")
        self.assertEqual(status, 404)
        status, _, _ = self.request("GET", f"/renders/{job['id']}/outputs/..%2Fjob.json")
        self.assertEqual(status, 404)

    def test_reuse_by_content_and_idempotency_key(self):
        package = named_package("ok")
        _, first = self.submit(package, key="abc")
        status, second = self.submit(package)
        self.assertEqual(status, 200)
        self.assertTrue(second["reused"])
        self.assertEqual(first["id"], second["id"])
        status, third = self.submit(named_package("other"), key="abc")
        self.assertEqual(third["id"], first["id"])
        self.assertNotIn("idempotencyKey", third)

    def test_structured_failure(self):
        _, job = self.submit(named_package("fail"))
        done = self.wait(job["id"])
        self.assertEqual(done["status"], "failed")
        self.assertEqual(done["error"]["code"], "import_failed")
        # A failed job is not reused: the same request renders again.
        status, retry = self.submit(named_package("fail"))
        self.assertEqual(status, 201)
        self.assertNotEqual(retry["id"], job["id"])
        self.wait(retry["id"])

    def test_engine_revision_change_renders_again(self):
        _, job = self.submit(named_package("ok"), key="rev")
        self.wait(job["id"])
        self.assertEqual(job["engineRevision"], srv.ENGINE_REVISION)
        original = srv.ENGINE_REVISION
        srv.ENGINE_REVISION = "updated-script"
        try:
            status, again = self.submit(named_package("ok"), key="rev")
        finally:
            srv.ENGINE_REVISION = original
        self.assertEqual(status, 201)
        self.assertNotEqual(again["id"], job["id"])
        self.wait(again["id"])

    def test_invalid_package_is_rejected_before_queueing(self):
        status, body = self.submit(b"garbage")
        self.assertEqual(status, 422)
        self.assertEqual(body["error"]["code"], "invalid_package")
        status, _, _ = self.request("POST", "/renders", b"x", {"Content-Type": "text/plain"})
        self.assertEqual(status, 415)
        self.assertEqual(os.listdir(os.path.join(self.data_dir, "jobs")), [])

    def test_cancel_running_job(self):
        _, job = self.submit(named_package("slow"))
        self.wait(job["id"], final=("running",))
        status, _, _ = self.request("POST", f"/renders/{job['id']}/cancel")
        self.assertEqual(status, 202)
        done = self.wait(job["id"])
        self.assertEqual(done["status"], "canceled")

    def test_queue_limit(self):
        ids = [self.submit(named_package(f"slow-{i}" if i else "slow"))[1] for i in range(3)]
        status, body = self.submit(named_package("one-too-many"))
        self.assertEqual(status, 429)
        self.assertEqual(body["error"]["code"], "queue_full")
        for job in ids:
            self.request("POST", f"/renders/{job['id']}/cancel")

    def test_restart_marks_interrupted_jobs(self):
        _, job = self.submit(named_package("slow"))
        self.wait(job["id"], final=("running",))
        # Simulate a crash: forget the process and reload the store from disk.
        self.store.cancel_flags[job["id"]].set()
        self.stop()
        path = os.path.join(self.data_dir, "jobs", job["id"], "job.json")
        with open(path, "r", encoding="utf-8") as handle:
            saved = json.load(handle)
        saved["status"] = "running"
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(saved, handle)
        self.start()
        _, _, raw = self.request("GET", f"/renders/{job['id']}")
        self.assertEqual(json.loads(raw)["error"]["code"], "worker_interrupted")


if __name__ == "__main__":
    unittest.main()
