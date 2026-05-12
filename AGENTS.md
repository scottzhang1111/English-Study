
# Eiken Vocab Lab
Do not solve state problems by adding more localStorage state.
## Project Goal

This is a gamified English vocabulary learning app for children in Japan.

Goals:
- Help children memorize pronunciation
- Help children understand word usage through example sentences
- Make learning feel like a game
- Encourage daily study habits
- Use a Pokémon-style reward and collection system
- Support child-specific learning progress, review, and rewards

## Product Direction

The core learning flow should be:

1. Select a child
2. Show today's target vocabulary list
3. Let the child study each word with pronunciation, meaning, and example sentences
4. Run a small quiz after the target words
5. Record correct and wrong answers
6. Prioritize wrong or weak words in future review
7. Award Pokémon EXP after learning or quiz progress
8. Unlock new Pokémon when the current Pokémon reaches max level

Keep this flow stable before adding large new features.

## UI Style

- Soft pastel colors
- Rounded corners
- Friendly for elementary school children
- Minimal but playful
- Smooth animations
- Avoid overly complex layouts
- Prefer large readable text
- Use encouraging Japanese copy for children

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
- Keep the current design language.
- Avoid breaking existing features.
- Keep components reasonably small.
- Do not introduce unnecessary dependencies.
- Do not change routing or API contracts unless needed.
- When fixing a bug, prefer the smallest safe change.
- When a larger change is necessary, explain why in the final summary.

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
- Pokémon / pet EXP
- Pokémon unlock logic
- Eiken attempt records
- AI question generation / answer checking
- database migrations and persistence

## Source of Truth

The backend database is the source of truth for real learning data.

Use backend database tables such as:

- children
- daily_study_log
- child_vocab_progress
- child_pokemon_collection
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
- pet EXP
- Pokémon unlock state
- Eiken attempt results

If existing pages use localStorage for these items, gradually migrate them to backend APIs instead of expanding the localStorage logic.

Important:

Do not solve state problems by adding more localStorage state.

If a feature needs persistence, child-specific progress, pet EXP, wrong answers, or learning history, implement or use a backend API instead of storing it only in the browser.

## Child ID Rule

All child-specific API calls must pass the selected child id.

Examples:

- getHomeData(childId)
- getDailyWords({ childId, limit })
- getFlashcardData({ childId, word })
- markMastered({ childId, vocabId, word })
- submitPracticeAnswer({ childId, ... })
- addPokemonExp(childId, exp)
- getProgressData({ childId })
- getPetsData(childId)
- getEikenQuestions({ childId, ... })
- getReviewList(childId)

If selected_child_id is missing, the page should redirect to the child selection page instead of calling APIs with an empty childId.

## Do Not Duplicate Systems

Do not maintain two parallel systems for:

- children
- daily progress
- vocabulary mastery
- wrong answer history
- pet EXP
- Pokémon collection

Prefer backend API + database over localStorage.

If a page currently uses utility files such as:

- childStorage
- dailyLearningStorage
- vocabProgressStorage

do not expand those systems. Migrate them gradually to backend-backed APIs.

## Pokémon System

- Pokémon are rewards for studying.
- Every child can own multiple Pokémon.
- Studying and quizzes can give EXP.
- Max-level Pokémon should unlock a new Pokémon.
- The active Pokémon should be child-specific.
- Use local/backend cache for PokeAPI data.
- Do not call PokeAPI repeatedly from the frontend.
- Pokémon display names should avoid mojibake or corrupted text.
- Prefer Japanese Pokémon names when available.
- If PokeAPI is unavailable, use cached or fallback data.

The Pokémon system should be backed by the backend database, especially:

- owned Pokémon
- active Pokémon
- EXP
- level
- unlock state

Do not store Pokémon progress only in localStorage.

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
8. Pokémon EXP increases for the selected child.
9. Wrong answers appear in review for the selected child only.
10. Refresh the browser and confirm progress still comes from backend data.