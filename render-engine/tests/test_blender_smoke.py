"""Real Blender + Cycles render of a tiny generated room. Skipped without Blender."""
import json
import os
import shutil
import subprocess
import tempfile
import unittest

from atelier_engine import contract, server
from tests import fixtures

BLENDER = server.find_blender()


@unittest.skipUnless(BLENDER, "Blender no instalado (render-engine/.blender o ATELIER_BLENDER)")
class BlenderSmokeTest(unittest.TestCase):
    def test_renders_room_with_passes(self):
        job_dir = tempfile.mkdtemp(prefix="atelier-blender-")
        try:
            package = contract.read_package(fixtures.package())
            with open(os.path.join(job_dir, "scene.json"), "w", encoding="utf-8") as handle:
                json.dump(package.manifest, handle)
            with open(os.path.join(job_dir, "scene.glb"), "wb") as handle:
                handle.write(package.files["scene.glb"])
            completed = subprocess.run(
                [BLENDER, "-b", "--factory-startup", "--disable-autoexec", "-noaudio", "--python-exit-code", "1",
                 "-P", server.RENDER_SCRIPT, "--", "--job-dir", job_dir, "--device", os.environ.get("ATELIER_DEVICE", "AUTO")],
                capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=600)
            self.assertEqual(completed.returncode, 0, completed.stdout[-3000:])
            with open(os.path.join(job_dir, "result.json"), "r", encoding="utf-8") as handle:
                result = json.load(handle)
            self.assertEqual(result["status"], "succeeded")
            self.assertTrue(result["ceiling"], "camera below wall height should close the room")
            self.assertEqual(result["materials"]["glass"], 1)
            self.assertEqual(result["materials"]["translucent"], 1, "leaf material should pass light through")
            self.assertEqual(result["materials"]["sheer"], 1, "voile curtain should let light through")
            self.assertEqual(result["materials"]["flames"], 1, "candle flame should glow")
            self.assertGreater(result["image"]["meanLuminance"], 0.05, "render is black")
            self.assertLess(result["image"]["clippedRatio"], 0.5, "render is blown out")
            # Afternoon preset applies the default window pull and reports clipping by zone.
            self.assertEqual(result["world"]["windowPullEV"], 1.5)
            zones = result["image"]["zones"]
            self.assertEqual(set(zones), {"windowRatio", "clippedWindow", "clippedInterior", "meanInterior", "meanWindow"})
            self.assertLessEqual(zones["clippedInterior"], 0.05)
            with open(os.path.join(job_dir, "beauty.png"), "rb") as handle:
                self.assertTrue(handle.read(8).startswith(b"\x89PNG"))
            with open(os.path.join(job_dir, "passes.exr"), "rb") as handle:
                self.assertEqual(handle.read(4), b"\x76\x2f\x31\x01")  # OpenEXR magic
            with open(os.path.join(job_dir, "ids.json"), "r", encoding="utf-8") as handle:
                ids = json.load(handle)
            self.assertIn("sofa-1", {o["id"] for o in ids["objects"].values()})
        finally:
            shutil.rmtree(job_dir, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
