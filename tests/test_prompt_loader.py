import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.utils import prompt_loader


PROMPT_FILENAMES = [
    'eiken_pre2_interview_reading.md',
    'eiken_pre2_interview_qa.md',
    'eiken_pre2_interview_attitude.md',
    'eiken_pre2_interview_summary.md',
]


class PromptLoaderTests(unittest.TestCase):
    def setUp(self):
        prompt_loader.clear_prompt_cache()

    def tearDown(self):
        prompt_loader.clear_prompt_cache()

    def test_interview_prompt_files_exist_and_contain_json_instruction(self):
        for filename in PROMPT_FILENAMES:
            with self.subTest(filename=filename):
                self.assertTrue((prompt_loader.PROMPTS_DIR / filename).is_file())
                content = prompt_loader.load_prompt(filename)
                self.assertTrue(content)
                self.assertIn('Return JSON only', content)

    def test_load_prompt_reads_utf8_file(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            prompt_dir = Path(temp_dir)
            (prompt_dir / 'sample.md').write_text('日本語 prompt\nReturn JSON only', encoding='utf-8')
            with patch.object(prompt_loader, 'PROMPTS_DIR', prompt_dir):
                prompt_loader.clear_prompt_cache()
                content = prompt_loader.load_prompt('sample.md')
        self.assertEqual('日本語 prompt\nReturn JSON only', content)

    def test_missing_prompt_logs_warning_and_returns_fallback(self):
        with tempfile.TemporaryDirectory() as temp_dir, patch.object(
            prompt_loader,
            'PROMPTS_DIR',
            Path(temp_dir),
        ), self.assertLogs(prompt_loader.logger, level='WARNING') as logs:
            prompt_loader.clear_prompt_cache()
            content = prompt_loader.load_prompt('eiken_pre2_interview_qa.md')
        self.assertIn('Return JSON only', content)
        self.assertTrue(any('using fallback prompt' in message for message in logs.output))

    def test_invalid_prompt_path_uses_fallback(self):
        with self.assertLogs(prompt_loader.logger, level='WARNING'):
            content = prompt_loader.load_prompt('../secret.md')
        self.assertIn('Return JSON only', content)


if __name__ == '__main__':
    unittest.main()
