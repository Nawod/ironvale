"""Package the existing Render-hosted Kingdom Lanka game for itch.io."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / "distribution" / "itch" / "index.html"
output = ROOT / "releases" / "kingdom-lanka-itch.zip"
html = source.read_text(encoding="utf-8")
assert 'src="https://ironvale.onrender.com/"' in html
assert 'allowfullscreen' in html
output.parent.mkdir(exist_ok=True)
with ZipFile(output, "w", compression=ZIP_DEFLATED) as archive:
    archive.writestr("index.html", html.encode("utf-8"))
with ZipFile(output) as archive:
    assert archive.namelist() == ["index.html"]
    assert archive.testzip() is None
    assert archive.read("index.html").decode("utf-8") == html
report = {"file": output.name, "bytes": output.stat().st_size,
          "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
          "files": 1, "mode": "fullscreen Render embed", "gameHost": "https://ironvale.onrender.com/",
          "standaloneOfflineBuild": False}
(output.parent / "kingdom-lanka-itch-info.json").write_text(json.dumps(report, indent=2)+"\n", encoding="utf-8")
print(json.dumps(report, indent=2))
