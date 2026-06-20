import json
import os
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import app  # noqa: E402


LESSONS = [
    {
        "lesson_id": "G-PREP2-PATTERN-DOING",
        "title": "Doing",
        "category": "高頻句型",
        "grammar_point": "動名詞・分詞搭配: doing を使う表現",
        "jp_explanation": "前置詞の後や特定の動詞・表現の後では、動詞を doing 形にします。",
        "jp_example": "私は日本語を学ぶことに興味があります。",
        "en_example": "I am interested in learning Japanese.",
        "learning_goal": "doing を使う準2級頻出表現を、文の中で選べるようにする。",
        "display_order": 101,
        "patterns": [
            ["good at doing", "～するのが得意だ", "He is good at swimming."],
            ["interested in doing", "～に興味がある", "I am interested in learning Japanese."],
            ["look forward to doing", "～を楽しみに待つ", "I'm looking forward to seeing you."],
            ["be used to doing", "～することに慣れている", "I am used to living alone."],
            ["stop doing", "～するのをやめる", "He stopped smoking."],
            ["give up doing", "～するのをあきらめる", "Never give up dreaming."],
            ["feel like doing", "～したい気がする", "I feel like having a drink."],
            ["keep doing", "～し続ける", "She kept on crying."],
            ["have trouble in doing", "～するのに苦労する", "I have trouble speaking English."],
            ["be busy doing", "～するのに忙しい", "She is busy preparing for the exam."],
            ["spend time doing", "～することに時間を費やす", "I spent three hours reading this book."],
            ["prevent ... from doing", "～するのを妨げる", "The rain prevented us from going out."],
            ["can't help doing", "～せずにはいられない", "I can't help laughing."],
            ["be worth doing", "～する価値がある", "This movie is worth watching."],
            ["do you mind doing?", "～してもいいですか", "Do you mind opening the window?"],
        ],
        "quizzes": [
            ("I am interested ___ learning English.", ["in", "on", "at", "for"], 0, "interested in doing が正しい形です。"),
            ("She stopped ___ last year.", ["smoke", "smoking", "smoked", "to smoke"], 1, "stop doing は『～するのをやめる』です。"),
            ("He is good ___ playing tennis.", ["to", "in", "at", "for"], 2, "good at doing で『～するのが得意だ』です。"),
            ("I'm looking forward to ___ you.", ["see", "saw", "seeing", "seen"], 2, "look forward to の to は前置詞なので doing を使います。"),
            ("I am used to ___ alone.", ["live", "living", "lived", "to live"], 1, "be used to doing は『～に慣れている』です。"),
            ("Never give up ___.", ["dream", "dreaming", "to dream", "dreamed"], 1, "give up の後は doing を使います。"),
            ("I feel like ___ a drink.", ["have", "having", "to have", "had"], 1, "feel like doing で『～したい気がする』です。"),
            ("She kept on ___ during the movie.", ["cry", "crying", "to cry", "cried"], 1, "keep doing / keep on doing で『～し続ける』です。"),
            ("I have trouble ___ English.", ["speak", "speaking", "to speak", "spoke"], 1, "have trouble in doing の in は省略されることもあります。"),
            ("This book is worth ___.", ["read", "reading", "to read", "reads"], 1, "be worth doing で『～する価値がある』です。"),
        ],
    },
    {
        "lesson_id": "G-PREP2-PATTERN-DO",
        "title": "Do",
        "category": "高頻句型",
        "grammar_point": "使役動詞・原形搭配: do を使う表現",
        "jp_explanation": "make / let / help などの後では、動詞の原形を使うことがあります。",
        "jp_example": "この音楽は私を幸せな気持ちにします。",
        "en_example": "This music makes me feel happy.",
        "learning_goal": "使役動詞や used to do の後に動詞の原形を選べるようにする。",
        "display_order": 102,
        "patterns": [
            ["make sb do sth", "人に～させる", "This music makes me feel happy."],
            ["used to do", "以前は～したものだ", "I used to smoke, but I quit."],
            ["let sb do sth", "人に～させる・許す", "Please let me know your answer."],
            ["help sb (to) do sth", "人が～するのを助ける", "He helped me move the desk."],
        ],
        "quizzes": [
            ("This music makes me ___ happy.", ["feel", "to feel", "feeling", "felt"], 0, "make + 人 + 動詞の原形 を使います。"),
            ("Please let me ___ your answer.", ["know", "to know", "knowing", "known"], 0, "let + 人 + 動詞の原形 を使います。"),
            ("He helped me ___ the desk.", ["move", "moving", "moved", "to moving"], 0, "help + 人 + (to) + 動詞の原形 です。"),
            ("I used to ___ coffee every morning.", ["drink", "drinking", "drank", "to drink"], 0, "used to do で『以前は～したものだ』です。"),
            ("My father made me ___ my room.", ["clean", "to clean", "cleaning", "cleaned"], 0, "make + 人 + 動詞の原形 です。"),
            ("The teacher let us ___ early.", ["leave", "to leave", "leaving", "left"], 0, "let + 人 + 動詞の原形 です。"),
            ("She used to ___ in Osaka.", ["live", "living", "lived", "to live"], 0, "used to の後は動詞の原形です。"),
            ("Can you help me ___ this box?", ["carry", "carrying", "carried", "to carrying"], 0, "help me carry / help me to carry が自然です。"),
            ("His joke made everyone ___.", ["laugh", "to laugh", "laughing", "laughed"], 0, "make + 人 + 動詞の原形 を使います。"),
            ("Let him ___ the question first.", ["answer", "to answer", "answering", "answered"], 0, "let + 人 + 動詞の原形 です。"),
        ],
    },
    {
        "lesson_id": "G-PREP2-PATTERN-TO-DO",
        "title": "To Do",
        "category": "高頻句型",
        "grammar_point": "不定式搭配: to do を使う表現",
        "jp_explanation": "want / decide などの後や It is ... to do の形では、不定詞 to do を使います。",
        "jp_example": "世界中を旅行したいです。",
        "en_example": "I want to travel around the world.",
        "learning_goal": "to do を使う準2級頻出表現を、文の中で選べるようにする。",
        "display_order": 103,
        "patterns": [
            ["want to do", "～したい", "I want to travel around the world."],
            ["decide to do", "～することに決める", "He decided to buy a new car."],
            ["It is ... to do", "～することは…だ", "It is important to study English."],
        ],
        "quizzes": [
            ("I want ___ around the world.", ["travel", "traveling", "to travel", "traveled"], 2, "want to do で『～したい』です。"),
            ("He decided ___ a new car.", ["buy", "buying", "to buy", "bought"], 2, "decide to do で『～することに決める』です。"),
            ("It is important ___ English.", ["study", "studying", "to study", "studied"], 2, "It is ... to do の形です。"),
            ("She wants ___ a doctor.", ["become", "becoming", "to become", "became"], 2, "want の後は to do を使います。"),
            ("They decided ___ at home.", ["stay", "staying", "to stay", "stayed"], 2, "decide to do が正しい形です。"),
            ("It is easy ___ this question.", ["answer", "answering", "to answer", "answered"], 2, "It is ... to do の形です。"),
            ("I hope ___ you again.", ["see", "seeing", "to see", "saw"], 2, "hope to do で『～することを望む』です。"),
            ("We need ___ early tomorrow.", ["leave", "leaving", "to leave", "left"], 2, "need to do で『～する必要がある』です。"),
            ("He promised ___ me.", ["help", "helping", "to help", "helped"], 2, "promise to do で『～すると約束する』です。"),
            ("It is fun ___ with friends.", ["talk", "talking", "to talk", "talked"], 2, "It is ... to do で『～することは…だ』です。"),
        ],
    },
]


def column_names(conn, table):
    if app.use_postgres():
        rows = conn.execute(
            """
            SELECT column_name AS name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = ?
            """,
            (table,),
        ).fetchall()
        return {row["name"] for row in rows}
    return {row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}


def ensure_patterns_column(conn):
    if "patterns_json" in column_names(conn, "grammar_lessons"):
        return
    conn.execute("ALTER TABLE grammar_lessons ADD COLUMN patterns_json TEXT")


def normalize_patterns(patterns):
    return [
        {
            "pattern": pattern,
            "meaningJa": meaning,
            "exampleEn": example,
        }
        for pattern, meaning, example in patterns
    ]


def upsert_lesson(conn, lesson):
    params = (
        lesson["lesson_id"],
        "eiken_pre2",
        lesson["category"],
        lesson["title"],
        lesson["grammar_point"],
        lesson["jp_explanation"],
        lesson["jp_example"],
        lesson["en_example"],
        lesson["learning_goal"],
        lesson["display_order"],
        1,
        json.dumps(normalize_patterns(lesson["patterns"]), ensure_ascii=False),
    )
    conn.execute(
        """
        INSERT INTO grammar_lessons (
            lesson_id, level, category, title, grammar_point, jp_explanation,
            jp_example, en_example, learning_goal, display_order, is_active, patterns_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(lesson_id) DO UPDATE SET
            level = excluded.level,
            category = excluded.category,
            title = excluded.title,
            grammar_point = excluded.grammar_point,
            jp_explanation = excluded.jp_explanation,
            jp_example = excluded.jp_example,
            en_example = excluded.en_example,
            learning_goal = excluded.learning_goal,
            display_order = excluded.display_order,
            is_active = excluded.is_active,
            patterns_json = excluded.patterns_json
        """,
        params,
    )


def upsert_quiz(conn, lesson, quiz_index, quiz):
    quiz_id = f"Q-{lesson['lesson_id'].replace('G-', '')}-{quiz_index:02d}"
    question, choices, answer_index, explanation = quiz
    conn.execute(
        """
        INSERT INTO grammar_quizzes (
            quiz_id, lesson_id, question_jp, choice_a, choice_b, choice_c,
            choice_d, answer_index, explanation_jp, difficulty
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(quiz_id) DO UPDATE SET
            lesson_id = excluded.lesson_id,
            question_jp = excluded.question_jp,
            choice_a = excluded.choice_a,
            choice_b = excluded.choice_b,
            choice_c = excluded.choice_c,
            choice_d = excluded.choice_d,
            answer_index = excluded.answer_index,
            explanation_jp = excluded.explanation_jp,
            difficulty = excluded.difficulty
        """,
        (
            quiz_id,
            lesson["lesson_id"],
            f"空所に入る最も適切なものはどれですか。{question}",
            choices[0],
            choices[1],
            choices[2],
            choices[3],
            answer_index,
            explanation,
            2,
        ),
    )


def main():
    conn = app.get_db_connection()
    try:
        ensure_patterns_column(conn)
        for lesson in LESSONS:
            upsert_lesson(conn, lesson)
            for index, quiz in enumerate(lesson["quizzes"], start=1):
                upsert_quiz(conn, lesson, index, quiz)
        conn.commit()
    finally:
        conn.close()
    print(f"Seeded {len(LESSONS)} eiken_pre2 grammar pattern lessons.")


if __name__ == "__main__":
    main()
