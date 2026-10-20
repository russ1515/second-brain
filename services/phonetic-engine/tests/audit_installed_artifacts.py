"""Print dependency footprint and immutable model identities; no audio needed."""

import argparse
import importlib.metadata
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from phonetic_engine import artifact_fingerprints, file_sha256


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--package-root", type=Path, required=True)
    options = parser.parse_args()
    root = options.package_root.resolve(strict=True)
    groups = {}
    total_bytes, total_files = 0, 0
    for entry in root.rglob("*"):
        if entry.is_symlink() or not entry.is_file():
            continue
        resolved = entry.resolve(strict=True)
        if not resolved.is_relative_to(root):
            continue
        relative = resolved.relative_to(root)
        size = resolved.stat().st_size
        total_bytes += size
        total_files += 1
        group = "/".join(relative.parent.parts[:2]) or "."
        value = groups.setdefault(group, {"bytes": 0, "fileCount": 0})
        value["bytes"] += size
        value["fileCount"] += 1
    from pocketsphinx import get_model_path
    model_path = get_model_path("en-us/en-us")
    lexicon_path = get_model_path("en-us/cmudict-en-us.dict")
    language_model_path = get_model_path("en-us/en-us.lm.bin")
    fingerprints = artifact_fingerprints(model_path, lexicon_path)
    print(json.dumps({"package": "pocketsphinx", "version": importlib.metadata.version("pocketsphinx"),
        "totalBytes": total_bytes, "fileCount": total_files,
        "subfolders": dict(sorted(groups.items())),
        "modelArtifactSha256": fingerprints.model_sha256,
        "lexiconSha256": fingerprints.lexicon_sha256,
        "lexiconBytes": Path(lexicon_path).stat().st_size,
        "secondaryLanguageModelSha256": file_sha256(Path(language_model_path)),
        "secondaryLanguageModelBytes": Path(language_model_path).stat().st_size,
        "modelFiles": [{"name": name, "bytes": size, "sha256": digest}
                       for name, size, digest in fingerprints.manifest],
        "audioProcessed": False, "networkCalls": 0}, sort_keys=True))


if __name__ == "__main__":
    main()
