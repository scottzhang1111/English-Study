-- Sync Grammar Hero lesson rewards to the current grammar_lessons.lesson_id values.
-- Do not use legacy G-PREP2-* lesson ids here; current lesson ids are read from
-- grammar_lessons in display order so child_grammar_progress and rewards match.

CREATE TABLE IF NOT EXISTS grammar_lesson_rewards (
    lesson_id TEXT PRIMARY KEY,
    hero_id BIGINT NOT NULL REFERENCES heroes(id),
    reward_type TEXT NOT NULL DEFAULT 'lesson',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS grammar_completion_rewards (
    reward_key TEXT PRIMARY KEY,
    hero_id BIGINT NOT NULL REFERENCES heroes(id),
    required_mastered_lessons INTEGER NOT NULL DEFAULT 17,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

WITH hero_order (reward_order, hero_code) AS (
    VALUES
    (1, 'grammar-guardian-hecate'),
    (2, 'grammar-guardian-skoll'),
    (3, 'grammar-guardian-amaterasu'),
    (4, 'grammar-guardian-hermes'),
    (5, 'grammar-guardian-indra'),
    (6, 'grammar-guardian-poseidon'),
    (7, 'grammar-guardian-pegasus'),
    (8, 'grammar-guardian-aiolos'),
    (9, 'grammar-guardian-konohanasakuya'),
    (10, 'grammar-guardian-qingluan'),
    (11, 'grammar-guardian-freyja'),
    (12, 'grammar-guardian-fuhaku'),
    (13, 'grammar-guardian-vayu'),
    (14, 'grammar-guardian-kamaitachi'),
    (15, 'grammar-guardian-garuda'),
    (16, 'grammar-guardian-pangu'),
    (17, 'grammar-guardian-kagutsuchi')
),
current_lessons AS (
    SELECT lesson_id,
           ROW_NUMBER() OVER (ORDER BY display_order ASC, lesson_id ASC) AS reward_order
    FROM grammar_lessons
    WHERE level = 'eiken_pre2'
      AND COALESCE(is_active, 1) = 1
    ORDER BY display_order ASC, lesson_id ASC
    LIMIT 17
),
mapped_rewards AS (
    SELECT current_lessons.lesson_id, heroes.id AS hero_id
    FROM current_lessons
    JOIN hero_order ON hero_order.reward_order = current_lessons.reward_order
    JOIN heroes ON heroes.code = hero_order.hero_code
)
INSERT INTO grammar_lesson_rewards (lesson_id, hero_id, reward_type, is_active)
SELECT lesson_id, hero_id, 'lesson', 1
FROM mapped_rewards
ON CONFLICT (lesson_id) DO UPDATE SET
    hero_id = EXCLUDED.hero_id,
    reward_type = 'lesson',
    is_active = 1;

UPDATE grammar_lesson_rewards
SET is_active = 0
WHERE lesson_id LIKE 'G-PREP2-%'
  AND lesson_id NOT IN (
      SELECT lesson_id
      FROM grammar_lessons
      WHERE level = 'eiken_pre2'
        AND COALESCE(is_active, 1) = 1
  );

INSERT INTO grammar_completion_rewards (
    reward_key,
    hero_id,
    required_mastered_lessons,
    is_active
)
SELECT 'grammar-temple-complete', heroes.id, 17, 1
FROM heroes
WHERE heroes.code = 'grammar-legend-shinatsuhiko'
ON CONFLICT (reward_key) DO UPDATE SET
    hero_id = EXCLUDED.hero_id,
    required_mastered_lessons = 17,
    is_active = 1;

-- Verification:
-- This must return 0 rows.
SELECT child_grammar_progress.lesson_id AS progress_lesson_id
FROM child_grammar_progress
WHERE child_grammar_progress.lesson_id LIKE 'GR-P2-CORE-%'
  AND NOT EXISTS (
      SELECT 1
      FROM grammar_lesson_rewards
      WHERE grammar_lesson_rewards.lesson_id = child_grammar_progress.lesson_id
        AND COALESCE(grammar_lesson_rewards.is_active, 1) = 1
  )
GROUP BY child_grammar_progress.lesson_id
ORDER BY child_grammar_progress.lesson_id;
