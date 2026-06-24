# Eigo World UI Component Inventory

This audit maps the current reusable frontend UI components to the mobile UI rules in [EIGO_UI_SYSTEM.md](./EIGO_UI_SYSTEM.md). It is documentation only; it does not migrate pages.

Current direction confirmed from `AGENTS.md` and `docs/EIGO_UI_SYSTEM.md`:

- Dark fantasy mobile backgrounds with navy, violet, night-sky depth.
- Dark translucent cards with warm gold borders.
- Compact functional mobile headers, not oversized hero sections.
- Quest cards, question cards, info cards, gold primary buttons, fantasy badges.
- `EQBottomNav` is the official fixed bottom navigation for core mobile areas.

Notes:

- `frontend/src/components/common/` and `frontend/src/components/ui/` do not currently exist.
- Most mobile product UI components live in `frontend/src/components/eigo/`.
- Some older or web/admin components still live in `frontend/src/components/` and are not aligned with the Eigo World mobile style.

## Status Legend

- **Official**: preferred component for new Eigo World mobile UI.
- **Semantic wrapper**: acceptable wrapper when it keeps the official fantasy visual style.
- **Legacy**: keep for existing pages, but avoid in new Eigo mobile work.
- **Risky**: likely to conflict with the mobile style rules if reused without restyling.
- **Candidate for later merge**: useful component, but overlaps with another official pattern.

## Normalized Status Summary

| Status | Components |
|---|---|
| **Official** | `EQPageShell`, `EQBottomNav`, `CompactPageHeader`, `EQFantasyCard`, `EQFantasyButton`, `EQFantasyBadge`, `EQFantasyDropdown`, central-exported `EQChoiceButton` |
| **Semantic wrapper** | `EQMobileShell`, `EQPageHeader`, `EQPanel`, `EQQuestCard`, `EQInfoCard`, `FantasyMenuTile` |
| **Legacy** | Root `BottomNav`, `HeaderBar`, `FeatureCard`, `WebLearningLayout` for mobile pages, `AppDashboardLayout` for mobile pages |
| **Risky** | `WrongQuestionCard`, white/light page cards, browser/default dialogs, page-local bottom navs |
| **Candidate for later merge** | Duplicate `EQChoiceButton.jsx`, `EQPrimaryButton`, `EQSecondaryButton`, `GoldQuestButton`, `EQCard`, `MagicPanel`, `QuestHeader`, `QuestProgressStepper`, `AudioButton`, `TtsButton` |

## Inventory

| Component | File path | Purpose | Props / variants visible | Used by pages | Relationship to `EIGO_UI_SYSTEM.md` | Recommendation |
|---|---|---|---|---|---|---|
| `EQPageShell` | `frontend/src/components/eigo/EQFantasyUI.jsx` | Newer fantasy page shell with optional `EQBottomNav`. | `className`, `contentClassName`, `withBottomNav`, `bottomNavClassName`, `maxWidth`. | `DailyReviewPage`, `Eiken3SetListPage`, `EssayCheckPage`, `GrammarPage`, interview pages. | Best fit for full Eigo mobile pages: dark page base plus bottom-nav integration. | **Official** for new mobile pages. |
| `EQMobileShell` | `frontend/src/components/eigo/EQMobileShell.jsx` | Lightweight `<main>` wrapper for older mobile screens. | `className`, passthrough props. | `LearningHubPage`, `FlashcardPage`, `QuizPage`, `GrammarQuestPage`, `StudyMapPage`, `World*`, card pages, review pages. | Useful base shell but styling depends on page classes. | **Semantic wrapper**; prefer `EQPageShell` for new screens when bottom nav is needed. |
| `EQBottomNav` | `frontend/src/components/eigo/EQBottomNav.jsx` | Official Eigo Quest bottom navigation with fantasy nav assets. | `items`, `className`. | Most core mobile pages including learning, grammar, cards, settings. | Directly matches Bottom Nav Usage rule. | **Official**. Do not duplicate. |
| `BottomNav` | `frontend/src/components/BottomNav.jsx` | Older generic bottom nav with white/light styling. | No props. | Not preferred by current Eigo pages; legacy root component. | Conflicts with dark fantasy bottom nav direction. | **Legacy** for mobile; use `EQBottomNav`. |
| `EQHeroHeader` | `frontend/src/components/eigo/EQFantasyUI.jsx` | Large visual fantasy header with background and helper/fairy image. | `eyebrow`, `title`, `subtitle`, `bgImage`, `helperImage`, `elementLabel`, `progressText`, `badges`. | `DailyReviewPage`, `Eiken3SetListPage`, `EssayCheckPage`, interview pages. | Good for hub/list/landing-like quest screens; can be too large for functional learning pages. | **Official for hub/overview pages only**. Avoid on dense lesson/detail/quiz pages. |
| `CompactPageHeader` | `frontend/src/components/eigo/CompactPageHeader.jsx` | Compact fantasy header with background image, progress, helper image, action. | `title`, `subtitle`, `backgroundImage`, `elementLabel`, `progressText`, `progressValue`, `progressMax`, `metaItems`, `helperImage`, `guidanceText`, `variant`, `action`. | `FlashcardPage`, `QuizPage`, `StudyMapPage`, `DailyWordUnitPage`, `Eiken*`, `GrammarReviewPage`, `ProgressPage`. | Strong match for compact mobile header rule. | **Official** for functional mobile pages needing a visual header. |
| `QuestHeader` | `frontend/src/components/eigo/QuestComponents.jsx` | Quest-flow header with back button, title, subtitle, star. | `title`, `subtitle`, `backTo`, `backLabel`, `className`. | `FlashcardPage`, `QuizPage`. | Fits predictable top actions, but older styling and encoded text artifacts exist. | **Candidate for later merge** into a compact header variant. |
| `EQPageHeader` | `frontend/src/components/eigo/EQFantasyPrimitives.jsx` | Primitive page header with eyebrow, icon, meta, actions. | `eyebrow`, `title`, `subtitle`, `icon`, `meta`, `actions`, `children`. | `ProgressPage`, `LearnedWordsPage`, `VocabWrongReviewPage`, review pages. | Good compact structural header; less asset-rich than `CompactPageHeader`. | **Semantic wrapper** for content-heavy non-hero pages. |
| `EQFantasyCard` | `frontend/src/components/eigo/EQFantasyUI.jsx` | Newer fantasy card with header/body/footer/actions and icon support. | `as`, `eyebrow`, `title`, `subtitle`, `icon`, `iconImage`, `cornerDecoration`, `actions`, `footer`, `glow`, `hideHeader`. | `DailyReviewPage`, `Eiken3SetListPage`, `EssayCheckPage`, `GrammarPage`, interview pages. | Strong match for gold-border cards and info/quest card surfaces. | **Official** for new cards. |
| `EQPanel` | `frontend/src/components/eigo/EQFantasyPrimitives.jsx` | Primitive gold/dark panel. | `as`, `title`, `eyebrow`, `footer`, `tone`, `style`. | `ReviewPage`, `ProgressPage`, `LearnedWordsPage`, `GrammarFormPracticePage`, `EikenReviewPage`. | Fits info cards and question containers when styled by primitives CSS. | **Semantic wrapper** as lower-level panel. |
| `EQCard` | `frontend/src/components/eigo/EQCard.jsx` | Older simple card wrapper using `eq-glow-card` or `eq-card`. | `glow`, `className`, children. | `QuizPage`, `HomePage`, `FlashcardPage`, `World*`, `CardCollectionPage`. | Often matches dark/glow card rule, but less expressive than newer cards. | **Candidate for later merge**; prefer `EQFantasyCard`/`EQPanel` for new work. |
| `MagicPanel` | `frontend/src/components/eigo/QuestComponents.jsx` | Motion-enabled quest panel. | `as`, `className`, children; defaults to `motion.section`. | `FlashcardPage`, `QuizPage`. | Useful for quest/question panels but older flow-specific abstraction. | **Candidate for later merge**; do not expand unless quest flow needs motion. |
| `EQQuestCard` | `frontend/src/components/eigo/EQFantasyPrimitives.jsx` | Primitive selectable quest card. | `as`, `icon`, `title`, `subtitle`, `meta`, `badges`, `action`, `featured`, `tone`. | `GrammarReviewPage`. | Directly maps to Quest Cards rule. | **Semantic wrapper** for selectable journeys/stages. |
| `FantasyMenuTile` | `frontend/src/components/eigo/FantasyMenuTile.jsx` | Menu tile for fantasy navigation. | `title`, `subtitle`, `icon`, `to`, `onClick`, `active`, etc. | Limited use; exported. | Fits quest/menu tiles when compact. | **Semantic wrapper** as optional tile variant. |
| `EQInfoCard` | `frontend/src/components/eigo/EQFantasyPrimitives.jsx` | Primitive info/stat card. | `icon`, `title`, `value`, `badges`, `footer`, `tone`. | `ProgressPage`, `LearnedWordsPage`, `EikenPage`. | Directly maps to Info Cards rule. | **Semantic wrapper** for stats/summary/detail info. |
| `EQChoiceButton` | `frontend/src/components/eigo/EQChoiceButton.jsx` and `EQFantasyPrimitives.jsx` | Answer choice button with selected/correct/wrong states. | `badge`, `label`, `selected`, `correct`, `wrong`, `state`, `feedback`. | `QuizPage`, `GrammarFormPracticePage`, `EikenPage`. | Directly maps to Question Cards choice states. | **Official via central export**; duplicate file is a **candidate for later merge**. |
| `PurificationQuizMobile` | `frontend/src/components/eigo/PurificationQuizMobile.jsx` | Full mobile quiz experience for purification/review flows. | Flow-specific props. | `DailyWordUnitPage`, `FlashcardPage`. | Implements question-card patterns in a full component. | **Keep flow component**, but do not use as generic question primitive. |
| `WrongQuestionCard` | `frontend/src/components/WrongQuestionCard.jsx` | Review card for Eiken wrong questions. | `question`, `mode`, `selectedAnswer`, `locked`, `onSelect`. | `EikenPre2WrongReviewPage`, `EikenPre2PracticePage`. | Currently has white/light card styling, conflicting with dark fantasy rule. | **Risky** for Eigo mobile style; restyle or replace later. |
| `EQFantasyButton` | `frontend/src/components/eigo/EQFantasyUI.jsx` | Newer fantasy button. | `as`, `icon`, `iconImage`, `trailingIcon`, `backgroundImage`, `variant`, `fullWidth`, `disabled`. | `DailyReviewPage`, `GrammarPage`, `GrammarQuestPage`, `EssayCheckPage`, interview pages. | Best match for gold primary button rule. | **Official** for new primary/secondary actions. |
| `EQPrimaryButton` | `frontend/src/components/eigo/EQFantasyPrimitives.jsx` | Primitive gold primary button. | `as`, `icon`, `fullWidth`, passthrough. | `ProgressPage`, `LearnedWordsPage`, `VocabWrongReviewPage`, `EikenPage`. | Good gold action primitive. | **Candidate for later merge**; prefer `EQFantasyButton` for new fantasy UI. |
| `EQSecondaryButton` | `frontend/src/components/eigo/EQFantasyPrimitives.jsx` | Primitive secondary button. | `as`, `icon`, `fullWidth`, passthrough. | `EikenPage`, `EssayCheckResultPage`, `LearnedWordsPage`. | Matches subdued secondary action rule. | **Candidate for later merge** into `EQFantasyButton` variants. |
| `GoldQuestButton` | `frontend/src/components/eigo/QuestComponents.jsx` | Older motion gold quest button. | `asLink`, `to`, `disabled`, `className`. | `CardRewardPage`, `DailyWordUnitPage`, `FlashcardPage`, `QuizPage`. | Good visual match, but flow-specific and overlaps with `EQFantasyButton`. | **Candidate for later merge**; do not expand as a second system. |
| `AudioButton` | `frontend/src/components/eigo/QuestComponents.jsx` | Quest-styled audio button. | `tone`, `className`, button props. | `QuizPage`. | Fits icon button rule for TTS/audio. | **Candidate for later merge** into future `EQAudioButton`. |
| `TtsButton` | `frontend/src/components/TtsButton.jsx` | Generic speech synthesis button. | `text`, `label`, `className`, `disabled`. | Eiken, Flashcard, Quiz, Vocab pages. | Behavior useful; styling depends on caller and may not be fantasy. | **Candidate for later merge**; preserve behavior for official audio button. |
| `EQFantasyBadge` | `frontend/src/components/eigo/EQFantasyUI.jsx` | Newer fantasy badge. | `variant`, `icon`, `iconImage`, `as`. | `DailyReviewPage`, `Eiken3SetListPage`, `EssayCheckPage`, interview pages. | Best match for fantasy badges. | **Official** for new badges. |
| `EQBadge` | `frontend/src/components/eigo/EQFantasyPrimitives.jsx` | Primitive badge with tone. | `tone`, `label`, `as`. | `ProgressPage`, `LearnedWordsPage`, review pages. | Matches badges through tone variables. | **Semantic wrapper**; prefer `EQFantasyBadge` for new screens. |
| `EQFantasyDropdown` | `frontend/src/components/eigo/EQFantasyUI.jsx` | Fantasy dropdown/select. | `label`, `value`, `defaultValue`, `options`, `onChange`, `placeholder`, `disabled`, `menuLabel`. | `Eiken3SetListPage`. | Good option-set control. | **Official** dropdown. |
| `BgmToggle` | `frontend/src/components/eigo/BgmToggle.jsx` | BGM on/off control. | `className`, `showLabel`. | `DailyWordUnitPage`, `QuizPage`, `SettingsPage`, `StudyMapPage`. | Utility control, not a core card/button. | **Keep specialized**. |
| `EQBackPill` | `frontend/src/components/eigo/EQBackPill.jsx` | Back link/button pill. | `to`, `children`, `className`; button mode when `to` falsy. | `CardCollectionPage`, `World*`, `InterviewGuidePage`. | Useful predictable back action; pill style not always header-aligned. | **Semantic wrapper** for existing pages; prefer header back button where appropriate. |
| `EQBrandHeader` | `frontend/src/components/eigo/EQBrandHeader.jsx` | Brand/title header. | `title`, `subtitle`, `icon`, etc. | `HomePage`. | Specific to home/brand surface. | **Keep specialized** for home/brand surfaces. |
| `SpiritDialogueBox` | `frontend/src/components/eigo/SpiritDialogueBox.jsx` | Dialogue panel with spirit character. | `title`, `message`, `steps`, etc. | Limited/exported. | Fits fantasy guide moments, not standard page layout. | **Keep specialized** for guided moments. |
| `SpiritAssistant` | `frontend/src/components/eigo-quest/SpiritAssistant.jsx` | Animated/helper spirit character. | `worldName`, `mood`, `messages`, `position`, etc. | Used through guide/header patterns. | Supports quest feeling. | **Keep specialized**, but prefer existing header helper image for simple pages. |
| `QuestProgressStepper` | `frontend/src/components/eigo/QuestComponents.jsx` | Multi-step quest progress. | `current`, `completed`, `className`. | `FlashcardPage`, `QuizPage`. | Progress component for multi-step flows. | **Candidate for later merge** when `EQProgressBar`/progress primitives are added. |
| `WorldMiniBanner` | `frontend/src/components/eigo/QuestComponents.jsx` | Small world banner with progress. | `worldId`, `day`, `learned`, `total`. | `QuizPage`. | Good quest context card. | **Keep specialized** for quest context. |
| `CaptureAnimation` | `frontend/src/components/CaptureAnimation.jsx` | Battle/reward capture animation. | `monster`, `phase`, `result`. | Battle flow. | Specialized reward/game UI. | **Keep specialized**. |
| `PetDisplay` | `frontend/src/components/PetDisplay.jsx` | Pet/partner display. | `pet`, display callbacks. | Pet-related pages. | Specialized, outside core mobile component system. | **Keep specialized**. |
| `FeatureCard` | `frontend/src/components/FeatureCard.jsx` | Generic feature card. | `icon`, `title`, `description`, `to`, `featured`, `tone`. | Older feature/menu surfaces. | Potentially overlaps with quest cards. | **Legacy** for Eigo mobile; prefer `EQQuestCard`/`EQFantasyCard`. |
| `HeaderBar` | `frontend/src/components/HeaderBar.jsx` | Older generic header bar. | `subtitle`, `showBack`, `backTo`. | `HomePage`, `AiPracticePage`, pet/legacy pages. | Generic web/app header, not official fantasy header. | **Legacy** for new Eigo mobile; prefer `CompactPageHeader`/`EQPageHeader`. |
| `WebLearningLayout` | `frontend/src/components/WebLearningLayout.jsx` | Web/desktop layout shell. | `title`, `subtitle`, sidebars/panels. | `FlashcardPage`, `QuizPage`, `EikenPre2PracticePage`, parent manager, vocab expansion. | Useful desktop/web mode but not mobile source of truth. | **Legacy for mobile**, keep for web/desktop contexts. |
| `AppDashboardLayout` | `frontend/src/components/AppDashboardLayout.jsx` | Dashboard layout with sidebar/header. | `title`, `subtitle`, `childName`, etc. | Admin/dashboard-style pages. | Not aligned with fantasy mobile learning UI. | **Legacy for mobile**, keep for dashboard only. |

## Duplicate Or Risky Areas

- **Buttons:** `EQFantasyButton` is official. `EQPrimaryButton`, `EQSecondaryButton`, `GoldQuestButton`, generic page buttons, and inline buttons are candidates for later merge or legacy usage.
- **Cards:** `EQFantasyCard` is official. `EQPanel`, `EQQuestCard`, and `EQInfoCard` are semantic wrappers. `EQCard` and `MagicPanel` are candidates for later merge. `FeatureCard` is legacy for mobile.
- **Headers:** `CompactPageHeader` is official for functional learning pages. `EQHeroHeader` is official only for hub/overview pages. `QuestHeader` is a later-merge candidate, and `HeaderBar` is legacy for mobile.
- **Bottom nav:** `EQBottomNav` is official. Older root `BottomNav` is legacy and should not be used for new Eigo World mobile pages.
- **Question choices:** the central-exported `EQChoiceButton` is official. The duplicate file implementation should be merged later before broad quiz UI migration.
- **Light/white cards:** `WrongQuestionCard`, older parent/admin pages, and some web layouts are risky if reused in Eigo World mobile flows.
