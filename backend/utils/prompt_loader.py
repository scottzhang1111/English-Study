import logging
from functools import lru_cache
from pathlib import Path


logger = logging.getLogger(__name__)
PROMPTS_DIR = Path(__file__).resolve().parent.parent / 'prompts'

FALLBACK_PROMPTS = {
    'eiken_pre2_interview_qa.md': '''You are an Eiken Pre-2 interview coach for a Japanese child.
Evaluate the answer gently using the supplied question, model answer, and student answer.

Question: {{question_text}}
Model answer: {{model_answer}}
Student answer: {{student_answer}}

Return JSON only with content_score, grammar_score, fluency_score, total_score,
good_point_ja, fix_point_ja, model_answer_en, and model_answer_ja.''',
    'eiken_pre2_interview_reading.md': '''You are an Eiken Pre-2 interview reading coach for a Japanese child.
Compare the expected passage and speech transcript gently.

Expected passage: {{passage_text}}
Student transcript: {{student_transcript}}

Return JSON only with reading_score, completion_score, pronunciation_score,
fluency_score, confidence_score, good_point_ja, fix_point_ja, and try_again_phrase.''',
    'eiken_pre2_interview_attitude.md': '''Evaluate Eiken Pre-2 interview attitude gently.
Return JSON only.''',
    'eiken_pre2_interview_summary.md': '''Summarize an Eiken Pre-2 interview result for a Japanese child.
Return JSON only.''',
}
GENERIC_FALLBACK_PROMPT = 'Evaluate the supplied Eiken Pre-2 interview data gently. Return JSON only.'


def _prompt_path(filename):
    safe_name = Path(str(filename or '')).name
    if not safe_name or safe_name != str(filename):
        return None
    return PROMPTS_DIR / safe_name


@lru_cache(maxsize=32)
def load_prompt(filename):
    prompt_path = _prompt_path(filename)
    fallback = FALLBACK_PROMPTS.get(str(filename), GENERIC_FALLBACK_PROMPT)
    if prompt_path is None:
        logger.warning('Prompt file path is invalid: %s; using fallback prompt', filename)
        return fallback
    try:
        content = prompt_path.read_text(encoding='utf-8').strip()
        if not content:
            raise ValueError('prompt file is empty')
        return content
    except (OSError, UnicodeError, ValueError) as exc:
        logger.warning('Prompt file unavailable: %s (%s); using fallback prompt', prompt_path, exc)
        return fallback


def prompt_file_available(filename):
    prompt_path = _prompt_path(filename)
    if prompt_path is None or not prompt_path.is_file():
        return False
    try:
        return bool(prompt_path.read_text(encoding='utf-8').strip())
    except (OSError, UnicodeError):
        return False


def clear_prompt_cache():
    load_prompt.cache_clear()
