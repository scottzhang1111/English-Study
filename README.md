<h1 align="center">⚔️ Eigo Quest · 英語クエスト</h1>

<p align="center">
  A dark-fantasy English vocabulary adventure for children in Japan.<br/>
  Learn words, clear stages, collect hero cards, and challenge bosses — every day.
</p>

<p align="center">
  <b>English</b> · <a href="README.ja.md">日本語</a>
</p>

<p align="center">
  <img src="frontend/public/assets/eigo-quest/cards/wind/wind-guardian1.png" width="130" alt="Wind guardian card"/>
  <img src="frontend/public/assets/eigo-quest/cards/wind/wind-guardian2.png" width="130" alt="Wind guardian card"/>
  <img src="frontend/public/assets/eigo-quest/cards/boss/wind-mini-boss1.png" width="130" alt="Wind mini boss card"/>
  <img src="frontend/public/assets/eigo-quest/cards/wind/wind-guardian3.png" width="130" alt="Wind guardian card"/>
  <img src="frontend/public/assets/eigo-quest/cards/wind/wind-guardian4.png" width="130" alt="Wind guardian card"/>
</p>

## Concept

Eigo Quest is not a flashcard app with a game skin — it is designed so that **daily English
study feels like progressing through an RPG world**:

```text
Learning   =  Power Up
Quiz       =  Battle
Cards      =  Hero Companions
Boss       =  Milestone Challenge
World Map  =  Main Progression
```

The core loop: **learn 20 words → clear the stage quiz → earn a hero card → unlock the next
stage.** Wrong answers are never punished — weak words simply come back for review, with warm,
encouraging feedback (「もう一度やってみよう」).

## Features

### 🗺️ Adventure learning
- **8 elemental worlds** (Wind / Fire / Water / Thunder / Forest / Rock / Shadow / Light), each
  split into 10 stages of 20 words
- **Boss battles** as milestone checks — correct answers attack the boss, wrong answers trigger a
  counterattack (mini bosses at stages 4 & 8, world boss at stage 10)
- **Hero card collection** — stage clears, boss wins, and review streaks award collectible cards

### 📚 Study system
- Daily word units with **pronunciation, meaning, and example sentences**
- Stage quizzes with automatic tracking of correct / wrong answers
- **Weak-word review** — mistakes are prioritized in future sessions
- Grammar quests and form practice with their own review flow

### 🎓 Eiken (英検) preparation
- **Grade 3** vocabulary & phrase sets (with bundled CSV datasets)
- **Grade Pre-2** practice sets, wrong-answer review, and a real-exam simulation mode
- **AI interview practice** with scoring, and **AI essay checking** (powered by Google Gemini)

### 👨‍👩‍👧‍👦 Family friendly
- Multiple child profiles with fully separate progress, rewards, and review queues
- Parent dashboard, parent word manager, and family administration
- Mobile-first dark-fantasy UI with large touch targets and Japanese interface text

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + Tailwind CSS (mobile-first, `frontend/`) |
| Backend | Flask + gunicorn (`app.py`, REST APIs under `/api/*`) |
| Database | SQLite for local development · PostgreSQL (e.g. Neon/Render) in production |
| AI | Google Gemini via `google-genai` (question generation, interview scoring, essay check) |

## Getting started

**Backend** (Python 3.10+):

```bash
pip install -r requirements.txt
cp .env.example .env        # SQLite by default; set USE_POSTGRES/DATABASE_URL for Postgres
python app.py               # http://localhost:5000
```

**Frontend** (Node 18+):

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

For production, build the frontend (`npm run build`) and let Flask serve the build, keeping
`/api/*` as backend routes.

## Project structure

```
├── app.py                  # Flask backend: children, progress, quizzes, rewards, Eiken, AI
├── frontend/               # React + Vite + Tailwind mobile app
│   └── src/pages/          # Home, StudyMap, BossBattle, Cards, Eiken, Grammar, Parent…
├── docs/                   # design docs: game loop, boss system, UI system, components
├── data/                   # learning content
├── eiken*.csv              # Eiken vocabulary & phrase datasets
└── AGENTS.md               # contributor / AI-agent working rules (start here!)
```

Design documents worth reading first: `docs/EIGO_QUEST_GAME_LOOP.md` (game design),
`docs/EIGO_UI_SYSTEM.md` (visual language), `docs/UI_COMPONENT_SYSTEM.md` (component rules).

## Design principles

- The backend database is the **single source of truth** for learning data
- Every child-specific API call carries a `childId` — progress never leaks between children
- Mistakes get warm feedback, never punishment
- *"A learning app that feels like an RPG, not a game that accidentally contains English questions."*

## License / usage

Personal family project for private use. Not affiliated with Eiken® or the Eiken Foundation of Japan.
