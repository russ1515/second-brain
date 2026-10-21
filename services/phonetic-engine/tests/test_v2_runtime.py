"""Resource/offline boundary tests; these do not claim real model execution."""
import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from v2.runtime import LocalWav2Vec2Runtime, MIN_AVAILABLE_MEMORY_BYTES
from v2.errors import V2EvidenceError

class RuntimeBoundaryTests(unittest.TestCase):
    def test_low_or_unknown_memory_prevents_native_import_and_model_load(self):
        for available in (None, 0, MIN_AVAILABLE_MEMORY_BYTES - 1):
            runtime = LocalWav2Vec2Runtime(Path.cwd() / 'not-installed', Path.cwd() / 'no-dictionary')
            with patch('v2.runtime.available_memory_bytes', return_value=available):
                with self.assertRaises(V2EvidenceError) as caught:
                    runtime.load()
            self.assertEqual(str(caught.exception), 'LOCAL_RESOURCE_MEMORY_INSUFFICIENT')
            self.assertEqual(caught.exception.resource['availableMemoryBytes'], available)
            self.assertFalse(caught.exception.resource['measuredModelMemory'])
            self.assertIsNone(runtime.model)

    def test_relative_model_paths_and_missing_artifacts_fail_before_loading(self):
        with patch('v2.runtime.available_memory_bytes', return_value=8 * 1024**3):
            with self.assertRaisesRegex(V2EvidenceError, 'LOCAL_MODEL_PATH_REQUIRED'):
                LocalWav2Vec2Runtime('relative', 'relative').load()
            with tempfile.TemporaryDirectory() as directory:
                with self.assertRaisesRegex(V2EvidenceError, 'LOCAL_MODEL_ARTIFACT_INVALID'):
                    LocalWav2Vec2Runtime(Path(directory), Path(directory) / 'dict').load()

    def test_assess_never_loads_implicitly_and_cannot_increase_concurrency(self):
        runtime = LocalWav2Vec2Runtime(Path.cwd(), Path.cwd() / 'dict')
        with self.assertRaisesRegex(V2EvidenceError, 'LOCAL_MODEL_NOT_LOADED'):
            runtime.assess(b'not-an-audio', 'A technical reference.')
        with self.assertRaisesRegex(V2EvidenceError, 'LOCAL_RESEARCH_CONCURRENCY_LIMIT'):
            LocalWav2Vec2Runtime(Path.cwd(), Path.cwd() / 'dict', threads=2)

    def test_runtime_contains_no_unsafe_pickle_remote_code_or_tokenizer_fallback(self):
        source = (Path(__file__).resolve().parents[1] / 'v2' / 'runtime.py').read_text(encoding='utf-8')
        for required in ('weights_only=True', 'local_files_only=True', 'trust_remote_code=False',
                         'HF_HUB_OFFLINE', 'TRANSFORMERS_OFFLINE'):
            self.assertIn(required, source)
        self.assertNotIn('weights_only=False', source)
        self.assertNotIn('AutoProcessor', source)
        self.assertNotIn('from phonemizer', source)
        self.assertNotIn('import phonemizer', source)

if __name__ == '__main__':
    unittest.main()
