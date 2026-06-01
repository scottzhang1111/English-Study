
# Eigo Quest / 英語クエスト
Do not solve state problems by adding more localStorage state.
## Repo Quick Rules

- Stack: React/Vite frontend, Flask backend, SQLite/PostgreSQL.
- Main app folder: `frontend/src`.
- Build command: `cd frontend && npm run build`.
- Mobile UI source of truth: `docs/EIGO_UI_SYSTEM.md`.
- Do not modify backend unless asked.
- Do not refactor unrelated pages.
- Prefer small focused diffs.
- Always report changed files and build result.

## Project Goal

This is a dark fantasy adventure English vocabulary learning app for children in Japan.

Goals:
- Help children memorize pronunciation
- Help children understand word usage through example sentences
- Make learning feel like a fantasy quest mobile game
- Encourage daily study habits
- Use a card-based reward and collection system
- Support child-specific learning progress, review, and rewards

## Product Direction

The core learning flow should be:

1. Select a child
2. Show today's target vocabulary list
3. Let the child study each word with pronunciation, meaning, and example sentences
4. Run a small quiz after the target words
5. Record correct and wrong answers
6. Prioritize wrong or weak words in future review
7. Award card-based quest rewards after learning or quiz progress
8. Unlock or upgrade cards through child-specific reward flows

Keep this flow stable before adding large new features.

## Target Mobile UI Style

- Dark fantasy adventure learning app.
- Deep navy background with subtle stars.
- Purple glowing cards and glowing borders.
- Cyan glow for progress, focus, and selected states.
- Gold/yellow primary action buttons.
- Large rounded cards.
- Large touch targets for children.
- Mobile-first layout.
- Japanese UI text.
- Clean layout, not too crowded.
- Card-based learning UI.
- Fixed bottom navigation for primary app sections.
- Similar to a fantasy quest mobile game, while keeping learning content easy to read.
- Smooth animations that support the quest feeling without distracting from study.

Wrong answers should feel encouraging, not punishing.

## Learning Philosophy

The app should encourage:

- Active recall
- Repetition
- Listening
- Speaking
- Sentence usage
- Small daily learning habits

The app should NEVER punish children harshly.

Use warm feedback for mistakes, such as:

- "もう一度やってみよう"
- "ここを覚えれば大丈夫"
- "正解を見てから次に進もう"

Avoid harsh wording such as:

- "failed"
- "bad"
- "wrong again"

unless it is only used internally in code.

## Important Rules

- Do NOT refactor the whole project unless explicitly asked.
- Prefer incremental changes.
- Keep the Eigo Quest dark fantasy mobile design language.
- Avoid breaking existing features.
- Keep components reasonably small.
- Do not introduce unnecessary dependencies.
- Do not change routing or API contracts unless needed.
- When fixing a bug, prefer the smallest safe change.
- When a larger change is necessary, explain why in the final summary.

## Frontend UI Change Rules

- Do not modify backend unless explicitly requested.
- Do not modify database unless explicitly requested.
- Do not modify API behavior unless explicitly requested.
- Do not modify quiz scoring logic.
- Do not modify learning progress logic.
- Only update frontend UI components unless explicitly requested.
- Keep existing routes and click behavior.
- Keep all existing data connections.
- If data is missing, use safe fallback values for display only.
- Make small incremental changes.
- After each task, run: `cd frontend && npm run build`.
- Report changed files and build result.

## Architecture Direction

At the current stage, do NOT perform a large frontend/backend repository split.

Keep the existing Flask + React project structure, but make the responsibility boundary clear.

React frontend should handle:

- UI rendering
- page state
- user interactions
- audio playback
- calling backend APIs

Flask backend should handle:

- child profiles
- daily learning progress
- vocabulary selection
- mastered / wrong word records
- quiz result persistence
- card rewards, upgrade materials, badges, and unlock logic
- Eiken attempt records
- AI question generation / answer checking
- database migrations and persistence

## Source of Truth

The backend database is the source of truth for real learning data.

Use backend database tables such as:

- children
- daily_study_log
- child_vocab_progress
- child card / reward collection tables
- ai_study_records
- ai_wrong_answers
- eiken_pre2_attempts
- eiken_pre2_student_answers

Do not create new localStorage-based systems for real learning data.

## localStorage Rule

localStorage may only be used for lightweight UI/session convenience.

Allowed:

- selected_child_id

Avoid using localStorage for:

- child profile data
- daily learning records
- vocabulary progress
- mastered words
- wrong answers
- card reward unlock state
- Eiken attempt results

If existing pages use localStorage for these items, gradually migrate them to backend APIs instead of expanding the localStorage logic.

Important:

Do not solve state problems by adding more localStorage state.

If a feature needs persistence, child-specific progress, rewards, wrong answers, or learning history, implement or use a backend API instead of storing it only in the browser.

## Child ID Rule

All child-specific API calls must pass the selected child id.

Examples:

- getHomeData(childId)
- getDailyWords({ childId, limit })
- getFlashcardData({ childId, word })
- markMastered({ childId, vocabId, word })
- submitPracticeAnswer({ childId, ... })
- getProgressData({ childId })
- getEikenQuestions({ childId, ... })
- getReviewList(childId)

If selected_child_id is missing, the page should redirect to the child selection page instead of calling APIs with an empty childId.

## Do Not Duplicate Systems

Do not maintain two parallel systems for:

- children
- daily progress
- vocabulary mastery
- wrong answer history
- card rewards
- upgrade materials
- badge collection

Prefer backend API + database over localStorage.

If a page currently uses utility files such as:

- childStorage
- dailyLearningStorage
- vocabProgressStorage

do not expand those systems. Migrate them gradually to backend-backed APIs.

## Card Reward System

- The reward system is card-based, not pet EXP based.
- Daily quests can reward hero cards.
- Grammar quests can reward skill cards.
- Wrong review can reward upgrade materials.
- Eiken can reward badges or rare cards.
- Rewards, badges, materials, ownership, upgrades, and unlock state should be child-specific and backend-backed.
- Do not add pet EXP, Pokémon EXP, or `addPetExp` to new flows unless explicitly asked.

## API and Data Rules

- Keep API responses stable where possible.
- Prefer adding optional fields over breaking existing response shapes.
- For child-specific data, always include childId in requests.
- Backend should validate childId before writing records.
- Frontend should not guess important learning state if the backend can provide it.
- Frontend fallback data is acceptable for display safety, but it should not become the source of truth.

## Deployment Direction

For now, do not force a complete deployment-level frontend/backend split.

Current recommended approach:

- Keep React frontend and Flask backend in the same project.
- During local development, React may run on localhost:5173 and Flask on localhost:5000.
- In production MVP, Flask may serve the React build and keep `/api/*` routes as backend APIs.

Future deployment option:

- React frontend can be deployed to Vercel.
- Flask backend can be deployed to Render, Railway, Fly.io, or another Python host.
- In that case, the frontend must use `VITE_API_BASE_URL` to call the backend.
- Do not assume `/api/*` exists on Vercel unless the backend is actually deployed there.

## Technical Rules

- Prefer TypeScript for new frontend files when practical.
- Existing JavaScript files may be edited without converting the whole project.
- Prefer reusable components.
- Keep API calls centralized in the API helper file.
- Avoid unnecessary dependencies.
- Keep API calls reasonably cached, but do not cache child-specific learning state incorrectly.
- Write tests for important pure logic when practical.
- Run build checks after changes.

Recommended checks:

Frontend:
- npm run build

Backend:
- python -m py_compile app.py

If a command cannot be run, mention why in the final summary.

## Implementation Priority

When modifying the app, prioritize:

1. Keep the learning flow stable.
2. Use backend database as the source of truth.
3. Pass childId consistently.
4. Avoid large unrelated refactors.
5. Keep UI changes minimal unless explicitly requested.
6. Preserve child-friendly UX.
7. Run build/test checks after modifications.

Recommended verification after changes:

1. Select child A.
2. Start daily learning.
3. Complete one word.
4. Home progress increases for child A.
5. Switch to child B.
6. Child B progress is separate.
7. Complete a quiz.
8. Card rewards, badges, or materials update for the selected child when applicable.
9. Wrong answers appear in review for the selected child only.
10. Refresh the browser and confirm progress still comes from backend data.

## Frontend Data Source Rule

Do not hardcode real app data in frontend components.

The frontend should prioritize backend/database data for:

* vocabulary lists
* children
* daily learning progress
* mastered words
* wrong answers
* quiz history
* card rewards
* hero/card ownership
* badges and materials
* world unlock/progress state

Frontend hardcoded data is only acceptable as temporary UI fallback, mock data, or display placeholder.

If backend data exists or can be provided by an API, use the backend data first.

When mock or fallback data is used, keep it clearly separated from real learning logic and do not let it become the source of truth.

Do not duplicate backend data models inside React components.
If a component currently uses hardcoded real data, gradually replace it with backend API data instead of expanding the hardcoded dataset.
