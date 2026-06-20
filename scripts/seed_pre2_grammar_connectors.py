import argparse
import json
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import app  # noqa: E402


LESSONS = [
    {
        "lesson_id": "G-PREP2-CONJ-01",
        "title": "接続詞①：理由・条件・時間をつなぐ",
        "category": "接続詞",
        "grammar_point": "because / if / when",
        "jp_explanation": "理由、条件、時間を表す文をつなぎます。",
        "jp_example": "雨が降っていたので、私は家にいました。",
        "en_example": "I stayed home because it was raining.",
        "learning_goal": "because / if / when を文の意味に合わせて選べる。",
        "display_order": 120,
        "sections": [
            ["because = 理由", "理由を説明するときに使うよ。", "I stayed home because it was raining.", "雨が降っていたので、私は家にいました。"],
            ["if = 条件", "もし～なら、という条件を表すよ。", "If it rains tomorrow, we will stay home.", "明日雨なら、私たちは家にいます。"],
            ["when = 時間", "～するとき、という時間を表すよ。", "Call me when you arrive.", "着いたら電話してください。"],
        ],
        "quizzes": [
            ("I stayed home ( ) it was raining.", ["because", "if", "when", "before"], 0, "雨が降っていた理由を表すので because。"),
            ("( ) it rains tomorrow, we will stay home.", ["If", "Because", "Before", "Although"], 0, "『もし雨なら』という条件なので If。"),
            ("Call me ( ) you arrive.", ["when", "why", "which", "what"], 0, "『着いたとき』なので when。"),
            ("I was late ( ) the train stopped.", ["because", "if", "when", "which"], 0, "遅れた理由を表すので because。"),
            ("( ) you need help, please ask me.", ["If", "Because", "Who", "Which"], 0, "『もし助けが必要なら』という条件なので If。"),
            ("She smiled ( ) she saw the dog.", ["when", "if", "before", "what"], 0, "『犬を見たとき』なので when。"),
            ("We can go out ( ) the weather is good.", ["if", "because", "who", "why"], 0, "『天気がよければ』という条件なので if。"),
            ("He went to bed early ( ) he was tired.", ["because", "when", "if", "where"], 0, "疲れていた理由を表すので because。"),
        ],
    },
    {
        "lesson_id": "G-PREP2-CONJ-02",
        "title": "接続詞②：前後・逆接をつなぐ",
        "category": "接続詞",
        "grammar_point": "before / after / although",
        "jp_explanation": "前後の順番や『～だけれど』という逆接を表します。",
        "jp_example": "暗くなる前に家に帰りなさい。",
        "en_example": "Come home before it gets dark.",
        "learning_goal": "before / after / although を文脈で選べる。",
        "display_order": 121,
        "sections": [
            ["before = ～する前に", "先に起きることを表すよ。", "Wash your hands before you eat.", "食べる前に手を洗いなさい。"],
            ["after = ～した後で", "後に起きることを表すよ。", "I did my homework after I got home.", "帰宅した後で宿題をしました。"],
            ["although = ～だけれど", "反対の内容をつなぐよ。", "Although it was cold, we went outside.", "寒かったけれど、私たちは外へ行きました。"],
        ],
        "quizzes": [
            ("Wash your hands ( ) you eat.", ["before", "after", "although", "because"], 0, "食べる前なので before。"),
            ("I watched TV ( ) I finished my homework.", ["after", "before", "although", "if"], 0, "宿題を終えた後なので after。"),
            ("( ) it was raining, we played soccer.", ["Although", "Before", "After", "When"], 0, "雨だったけれど、という逆接なので Although。"),
            ("Come home ( ) it gets dark.", ["before", "after", "because", "who"], 0, "暗くなる前なので before。"),
            ("She went shopping ( ) she cleaned her room.", ["after", "although", "before", "which"], 0, "掃除した後なので after。"),
            ("( ) he is young, he speaks English well.", ["Although", "After", "Before", "Where"], 0, "若いけれど上手、という逆接なので Although。"),
            ("Brush your teeth ( ) you go to bed.", ["before", "after", "although", "why"], 0, "寝る前なので before。"),
            ("I took a bath ( ) I came home.", ["after", "although", "before", "who"], 0, "帰宅した後なので after。"),
        ],
    },
    {
        "lesson_id": "G-PREP2-REL-01",
        "title": "関係代名詞①：人と物を説明する",
        "category": "関係代名詞",
        "grammar_point": "who / which",
        "jp_explanation": "名詞の後ろから、人や物を説明します。",
        "jp_example": "私はフランス語を話す女の子を知っています。",
        "en_example": "I know a girl who speaks French.",
        "learning_goal": "人には who、物には which を選べる。",
        "display_order": 122,
        "sections": [
            ["who = 人", "人を説明するときに使うよ。", "I know a girl who speaks French.", "私はフランス語を話す女の子を知っています。"],
            ["which = 物・動物", "物や動物を説明するときに使うよ。", "This is the book which I bought yesterday.", "これは私が昨日買った本です。"],
            ["後ろから説明", "関係代名詞は前の名詞を後ろから説明するよ。", "The boy who is running is my brother.", "走っている少年は私の兄です。"],
        ],
        "quizzes": [
            ("I know a girl ( ) speaks French.", ["who", "which", "what", "where"], 0, "girl は人なので who。"),
            ("This is the book ( ) I bought yesterday.", ["which", "who", "why", "when"], 0, "book は物なので which。"),
            ("The man ( ) lives next door is a doctor.", ["who", "which", "where", "what"], 0, "man は人なので who。"),
            ("I lost the pen ( ) my father gave me.", ["which", "who", "where", "why"], 0, "pen は物なので which。"),
            ("The dog ( ) has long ears is cute.", ["which", "who", "what", "when"], 0, "dog は動物なので which。"),
            ("Do you know the boy ( ) is playing soccer?", ["who", "which", "where", "why"], 0, "boy は人なので who。"),
            ("She read a story ( ) made her cry.", ["which", "who", "what", "where"], 0, "story は物なので which。"),
            ("The teacher ( ) taught us math retired.", ["who", "which", "when", "what"], 0, "teacher は人なので who。"),
        ],
    },
    {
        "lesson_id": "G-PREP2-REL-02",
        "title": "関係代名詞②：thatで説明する",
        "category": "関係代名詞",
        "grammar_point": "that",
        "jp_explanation": "that は人にも物にも使える関係代名詞です。",
        "jp_example": "これは私が探していたかばんです。",
        "en_example": "This is the bag that I was looking for.",
        "learning_goal": "who / which の代わりに that を使える場面を理解する。",
        "display_order": 123,
        "sections": [
            ["that = 人にも物にも使える", "that は who や which の代わりに使えるよ。", "I have a friend that lives in Canada.", "私にはカナダに住んでいる友だちがいます。"],
            ["物を説明する that", "物を後ろから説明できるよ。", "This is the bag that I was looking for.", "これは私が探していたかばんです。"],
            ["よく使う形", "会話でも試験でもよく出る形だよ。", "The movie that we watched was exciting.", "私たちが見た映画はわくわくしました。"],
        ],
        "quizzes": [
            ("This is the bag ( ) I was looking for.", ["that", "where", "when", "why"], 0, "bag を説明する関係代名詞なので that。"),
            ("I have a friend ( ) lives in Canada.", ["that", "where", "what", "when"], 0, "friend を説明する that。"),
            ("The movie ( ) we watched was exciting.", ["that", "why", "where", "when"], 0, "movie を説明する that。"),
            ("The cake ( ) she made was delicious.", ["that", "who", "where", "why"], 0, "cake を説明する that。"),
            ("He is the singer ( ) I like best.", ["that", "which", "where", "when"], 0, "人にも that を使えます。"),
            ("I found the key ( ) I lost yesterday.", ["that", "who", "why", "where"], 0, "key を説明する that。"),
            ("The bike ( ) he bought is new.", ["that", "when", "where", "what"], 0, "bike を説明する that。"),
            ("She met a woman ( ) knew my mother.", ["that", "which", "where", "why"], 0, "woman を説明する that。"),
        ],
    },
    {
        "lesson_id": "G-PREP2-RELADV-01",
        "title": "関係副詞：場所・時間・理由をつなぐ",
        "category": "関係副詞",
        "grammar_point": "where / when / why",
        "jp_explanation": "場所、時間、理由を説明するときに使います。",
        "jp_example": "ここは私が育った町です。",
        "en_example": "This is the town where I grew up.",
        "learning_goal": "where / when / why を意味で選べる。",
        "display_order": 124,
        "sections": [
            ["where = 場所", "場所を説明するときに使うよ。", "This is the town where I grew up.", "ここは私が育った町です。"],
            ["when = 時間", "時間を説明するときに使うよ。", "I remember the day when we met.", "私たちが会った日を覚えています。"],
            ["why = 理由", "理由を説明するときに使うよ。", "Do you know the reason why she left?", "彼女が去った理由を知っていますか。"],
        ],
        "quizzes": [
            ("This is the restaurant ( ) we had dinner.", ["where", "what", "who", "why"], 0, "restaurant は場所なので where。"),
            ("I remember the day ( ) we first met.", ["when", "where", "why", "who"], 0, "day は時間なので when。"),
            ("Do you know the reason ( ) she was angry?", ["why", "where", "when", "which"], 0, "reason は理由なので why。"),
            ("This is the park ( ) we play soccer.", ["where", "when", "why", "who"], 0, "park は場所なので where。"),
            ("I will never forget the year ( ) I moved here.", ["when", "where", "why", "what"], 0, "year は時間なので when。"),
            ("Tell me the reason ( ) you were late.", ["why", "where", "when", "who"], 0, "reason は理由なので why。"),
            ("The school ( ) I study is old.", ["where", "when", "why", "which"], 0, "school は場所なので where。"),
            ("Sunday is the day ( ) I visit my grandmother.", ["when", "where", "why", "what"], 0, "day は時間なので when。"),
        ],
    },
    {
        "lesson_id": "G-PREP2-WHCLAUSE-01",
        "title": "疑問詞節：文の中の「なに・だれ・どこ・なぜ」",
        "category": "疑問詞節",
        "grammar_point": "what / who / where / why",
        "jp_explanation": "疑問詞を文の一部として使います。",
        "jp_example": "私は彼が何を欲しがっているか知っています。",
        "en_example": "I know what he wants.",
        "learning_goal": "文の中で what / who / where / why を使い分ける。",
        "display_order": 125,
        "sections": [
            ["what = なに", "『何を～か』を表すよ。", "I know what he wants.", "私は彼が何を欲しがっているか知っています。"],
            ["where = どこ", "『どこで・どこに～か』を表すよ。", "Can you tell me where she lives?", "彼女がどこに住んでいるか教えてくれますか。"],
            ["why = なぜ", "『なぜ～か』を表すよ。", "I don't know why he left.", "私は彼がなぜ去ったのか知りません。"],
        ],
        "quizzes": [
            ("I know ( ) he wants.", ["what", "which", "who", "when"], 0, "『何を欲しがっているか』なので what。"),
            ("Can you tell me ( ) she lives?", ["where", "why", "what", "which"], 0, "住んでいる場所なので where。"),
            ("I don't know ( ) he left early.", ["why", "where", "which", "who"], 0, "理由を表すので why。"),
            ("Do you know ( ) made this cake?", ["who", "what", "where", "when"], 0, "人をたずねるので who。"),
            ("Please tell me ( ) you bought.", ["what", "where", "why", "who"], 0, "買ったものなので what。"),
            ("I wonder ( ) they are going.", ["where", "what", "which", "who"], 0, "行き先なので where。"),
            ("She asked me ( ) I was sad.", ["why", "where", "what", "which"], 0, "悲しい理由なので why。"),
            ("We don't know ( ) will come.", ["who", "where", "why", "which"], 0, "来る人なので who。"),
        ],
    },
    {
        "lesson_id": "G-PREP2-COMPOUND-REL-01",
        "title": "複合関係詞：whatever / whenever の魔法",
        "category": "複合関係詞",
        "grammar_point": "whatever / whoever / whenever / wherever",
        "jp_explanation": "『何でも』『誰でも』『いつでも』『どこでも』を表します。",
        "jp_example": "好きなものを何でも選んでいいです。",
        "en_example": "You can choose whatever you like.",
        "learning_goal": "複合関係詞を意味で選べる。",
        "display_order": 126,
        "sections": [
            ["whatever = 何でも", "ものを自由に選ぶ感じだよ。", "You can choose whatever you like.", "好きなものを何でも選んでいいです。"],
            ["whenever = いつでも", "時間が自由な感じだよ。", "Visit us whenever you have time.", "時間があるときはいつでも訪ねてください。"],
            ["wherever = どこでも", "場所が自由な感じだよ。", "I will follow you wherever you go.", "あなたがどこへ行ってもついて行きます。"],
            ["whoever = 誰でも", "人が誰でも、という意味だよ。", "Whoever wins the game will get a prize.", "試合に勝った人は誰でも賞をもらえます。"],
        ],
        "quizzes": [
            ("You can choose ( ) you like.", ["whatever", "whenever", "wherever", "whoever"], 0, "好きなものを何でも、なので whatever。"),
            ("Visit us ( ) you have time.", ["whenever", "whatever", "whoever", "which"], 0, "時間があるときはいつでも、なので whenever。"),
            ("I will follow you ( ) you go.", ["wherever", "whatever", "whenever", "who"], 0, "どこへ行っても、なので wherever。"),
            ("( ) wins the game will get a prize.", ["Whoever", "Whatever", "Whenever", "Which"], 0, "勝つ人は誰でも、なので Whoever。"),
            ("Take ( ) you need.", ["whatever", "whenever", "wherever", "whoever"], 0, "必要なものは何でも、なので whatever。"),
            ("You may call me ( ) you want.", ["whenever", "whatever", "wherever", "whoever"], 0, "いつでも電話してよい、なので whenever。"),
            ("Sit ( ) you like.", ["wherever", "whatever", "whenever", "whoever"], 0, "好きな場所ならどこでも、なので wherever。"),
            ("( ) comes first can sit here.", ["Whoever", "Whatever", "Whenever", "Wherever"], 0, "最初に来た人は誰でも、なので Whoever。"),
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


def ensure_content_column(conn):
    if "content_json" not in column_names(conn, "grammar_lessons"):
        conn.execute("ALTER TABLE grammar_lessons ADD COLUMN content_json TEXT")


def normalize_sections(sections):
    return [
        {
            "smallTitle": small_title,
            "explanationJa": explanation,
            "exampleEn": example_en,
            "exampleJa": example_ja,
        }
        for small_title, explanation, example_en, example_ja in sections
    ]


def upsert_lesson(conn, lesson):
    conn.execute(
        """
        INSERT INTO grammar_lessons (
            lesson_id, level, category, title, grammar_point, jp_explanation,
            jp_example, en_example, learning_goal, display_order, is_active, content_json
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
            content_json = excluded.content_json
        """,
        (
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
            json.dumps({"sections": normalize_sections(lesson["sections"])}, ensure_ascii=False),
        ),
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


def seed(apply_changes):
    if not apply_changes:
        total_quizzes = sum(len(lesson["quizzes"]) for lesson in LESSONS)
        print(f"Dry run: would seed {len(LESSONS)} lessons and {total_quizzes} quizzes.")
        print("Use --apply to write changes.")
        return

    conn = app.get_db_connection()
    try:
        ensure_content_column(conn)
        for lesson in LESSONS:
            upsert_lesson(conn, lesson)
            for index, quiz in enumerate(lesson["quizzes"], start=1):
                upsert_quiz(conn, lesson, index, quiz)
        conn.commit()
    finally:
        conn.close()
    print(f"Seeded {len(LESSONS)} eiken_pre2 connector/relative grammar lessons.")


def main():
    parser = argparse.ArgumentParser(description="Seed eiken_pre2 connector and relative grammar lessons.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the configured database.")
    args = parser.parse_args()
    seed(args.apply)


if __name__ == "__main__":
    main()
