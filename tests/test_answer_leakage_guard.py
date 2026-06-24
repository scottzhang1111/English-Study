import random
import unittest

import app as app_module


class AnswerLeakageGuardTests(unittest.TestCase):
    def test_phrase_core_words_are_blocked(self):
        self.assertTrue(
            app_module.has_answer_leakage(
                'My brother is able to swim fast. (____)',
                'be able to do',
            )
        )
        self.assertTrue(
            app_module.has_answer_leakage(
                'Behave yourself, Steve, or Mother will get angry. This is a common situation. (____)',
                'behave oneself',
            )
        )
        self.assertTrue(
            app_module.has_answer_leakage(
                'We cleaned the room at the end of class. (____)',
                'at the end of ~',
            )
        )

    def test_simple_word_forms_are_blocked(self):
        self.assertTrue(app_module.has_answer_leakage('She behaved well today. (____)', 'behave'))
        self.assertTrue(app_module.has_answer_leakage('I used this word yesterday. (____)', 'use'))
        self.assertTrue(app_module.has_answer_leakage('He is using a new tool. (____)', 'use'))

    def test_safe_question_is_allowed(self):
        self.assertFalse(
            app_module.has_answer_leakage(
                'My brother can swim fast. (____)',
                'be able to do',
            )
        )

    def test_ai_question_normalization_rejects_leaked_choice_question(self):
        question = {
            'type': 'Grammar',
            'question': 'My brother is able to swim fast. (____)',
            'choices': ['be able to do', 'ask for', 'event', 'be filled with'],
            'correct': 'be able to do',
            'id': '924',
            'word': 'be able to do',
            'explanation_jp': '',
            'example': 'My brother is able to swim fast.',
            'example_jp': '',
            'japanese': '〜することができる',
        }
        self.assertIsNone(app_module._normalize_ai_question(question))

    def test_rule_question_generation_skips_leaked_entries(self):
        random.seed(7)
        entries = [
            {
                'ID': '1',
                'English': 'be able to do',
                'Japanese': '〜することができる',
                'Example_English': 'My brother is able to swim fast.',
                'Example_Japanese': '',
            },
            {
                'ID': '2',
                'English': 'behave oneself',
                'Japanese': '行儀よくする',
                'Example_English': 'Behave yourself, Steve, or Mother will get angry.',
                'Example_Japanese': '',
            },
            {
                'ID': '3',
                'English': 'remove',
                'Japanese': '取り除く',
                'Example_English': 'Please _____ your shoes here.',
                'Example_Japanese': '',
            },
            {
                'ID': '4',
                'English': 'foreign',
                'Japanese': '外国の',
                'Example_English': 'She has many _____ friends.',
                'Example_Japanese': '',
            },
            {
                'ID': '5',
                'English': 'message',
                'Japanese': '伝言',
                'Example_English': 'I left a short _____ for him.',
                'Example_Japanese': '',
            },
            {
                'ID': '6',
                'English': 'dollar',
                'Japanese': 'ドル',
                'Example_English': 'This ticket costs one _____.',
                'Example_Japanese': '',
            },
        ]
        questions = app_module.generate_rule_questions(entries)
        self.assertEqual(20, len(questions))
        for question in questions:
            self.assertTrue(app_module.is_safe_choice_question(question), question)


if __name__ == '__main__':
    unittest.main()
