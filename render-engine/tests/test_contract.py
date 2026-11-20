import copy
import io
import json
import unittest
import zipfile

from atelier_engine import contract
from tests import fixtures


class ManifestTests(unittest.TestCase):
    def setUp(self):
        self.glb = fixtures.room_glb()
        self.manifest = fixtures.manifest(self.glb)

    def test_valid_manifest_is_normalised(self):
        clean = contract.validate_manifest(self.manifest)
        self.assertEqual(clean["render"]["passes"], ["beauty", "depth", "object_id"])
        direction = clean["lighting"]["sun"]["direction"]
        self.assertAlmostEqual(sum(v * v for v in direction), 1.0, places=6)
        self.assertEqual(clean["project"]["wallHeight"], 2.5)

    def test_window_pull_defaults_by_preset_and_is_bounded(self):
        self.assertEqual(contract.validate_manifest(self.manifest)["lighting"]["windowPull"], 1.5)
        for preset, hdri, expected in (("night", None, 0), ("studio", "studio", 0), ("day", None, 1.5)):
            data = copy.deepcopy(self.manifest)
            data["lighting"].update(preset=preset, hdri=hdri)
            self.assertEqual(contract.validate_manifest(data)["lighting"]["windowPull"], expected, preset)
        data = copy.deepcopy(self.manifest)
        data["lighting"]["windowPull"] = 0
        self.assertEqual(contract.validate_manifest(data)["lighting"]["windowPull"], 0)
        data["lighting"]["windowPull"] = 9
        with self.assertRaises(contract.PackageError):
            contract.validate_manifest(data)

    def test_rejects_wrong_format_and_version(self):
        for key, value, code in (("format", "other", "invalid_manifest"), ("schemaVersion", 2, "unsupported_version")):
            bad = copy.deepcopy(self.manifest)
            bad[key] = value
            with self.assertRaises(contract.PackageError) as ctx:
                contract.validate_manifest(bad)
            self.assertEqual(ctx.exception.code, code)

    def test_rejects_oversized_render(self):
        bad = copy.deepcopy(self.manifest)
        bad["render"].update(width=3840, height=4000)
        with self.assertRaises(contract.PackageError) as ctx:
            contract.validate_manifest(bad)
        self.assertEqual(ctx.exception.code, "invalid_manifest")
        bad["render"].update(width=3840, height=2400)
        with self.assertRaises(contract.PackageError) as ctx:
            contract.validate_manifest(bad)
        self.assertEqual(ctx.exception.code, "limit_exceeded")

    def test_rejects_non_finite_and_unknown_values(self):
        bad = copy.deepcopy(self.manifest)
        bad["camera"]["fovY"] = float("nan")
        with self.assertRaises(contract.PackageError):
            contract.validate_manifest(bad)
        bad = copy.deepcopy(self.manifest)
        bad["lighting"]["hdri"] = "../../etc/passwd"
        with self.assertRaises(contract.PackageError):
            contract.validate_manifest(bad)
        bad = copy.deepcopy(self.manifest)
        bad["render"]["passes"] = ["beauty", "shell"]
        with self.assertRaises(contract.PackageError):
            contract.validate_manifest(bad)

    def test_rejects_camera_on_target(self):
        bad = copy.deepcopy(self.manifest)
        bad["camera"]["target"] = list(bad["camera"]["position"])
        with self.assertRaises(contract.PackageError):
            contract.validate_manifest(bad)

    def test_coordinate_conversion(self):
        self.assertEqual(contract.to_blender([1.0, 2.0, 3.0]), (1.0, -3.0, 2.0))


class PackageTests(unittest.TestCase):
    def test_reads_valid_package(self):
        package = contract.read_package(fixtures.package())
        self.assertEqual(package.manifest["project"]["id"], "test-room")
        self.assertIn("scene.glb", package.files)
        self.assertEqual(len(package.sha256), 64)

    def test_rejects_unexpected_or_traversal_members(self):
        for name in ("../evil.py", "C:/evil", "scripts/run.py", "scene.blend"):
            with self.assertRaises(contract.PackageError) as ctx:
                contract.read_package(fixtures.package(extra={name: b"x"}))
            self.assertEqual(ctx.exception.code, "invalid_package")

    def test_rejects_hash_mismatch(self):
        glb = fixtures.room_glb()
        scene = fixtures.manifest(glb)
        scene["geometry"]["sha256"] = "0" * 64
        with self.assertRaises(contract.PackageError):
            contract.read_package(fixtures.package(glb, scene))

    def test_rejects_glb_with_external_uri(self):
        glb = fixtures.room_glb()
        length = int.from_bytes(glb[12:16], "little")
        gltf = json.loads(glb[20:20 + length])
        gltf["buffers"][0]["uri"] = "file:///etc/passwd"
        js = json.dumps(gltf).encode()
        js += b" " * ((4 - len(js) % 4) % 4)
        rest = glb[20 + length:]
        bad = b"glTF" + (2).to_bytes(4, "little") + (20 + len(js) + len(rest)).to_bytes(4, "little") + len(js).to_bytes(4, "little") + b"JSON" + js + rest
        with self.assertRaises(contract.PackageError) as ctx:
            contract.read_package(fixtures.package(bad, fixtures.manifest(bad)))
        self.assertEqual(ctx.exception.code, "invalid_geometry")

    def test_rejects_garbage(self):
        with self.assertRaises(contract.PackageError):
            contract.read_package(b"not a zip")
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("scene.json", "{}")
        with self.assertRaises(contract.PackageError):
            contract.read_package(buffer.getvalue())


if __name__ == "__main__":
    unittest.main()
