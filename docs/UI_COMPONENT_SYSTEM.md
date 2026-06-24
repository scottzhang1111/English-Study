# Eigo World UI Component System

This document answers: **When implementing an Eigo World mobile UI, which official component should be used?**

Visual style is defined by [EIGO_UI_SYSTEM.md](./EIGO_UI_SYSTEM.md). This document defines component choices.

## 0. Official Vs Legacy Priority

Use the central export for Eigo components:

```jsx
import {
  CompactPageHeader,
  EQPageShell,
  EQFantasyCard,
  EQFantasyButton,
  EQFantasyBadge,
  EQChoiceButton,
  EQProgressBar,
  EQQuestionCard,
  EQAudioButton,
  EQBottomNav,
} from '../components/eigo';
```

For files in deeper folders, adjust the relative path to the same central module: `frontend/src/components/eigo/index.js`.

| UI area | Official component | Legacy / avoid component | Migration note |
|---|---|---|---|
| Bottom navigation | `EQBottomNav` | Root `BottomNav` from `frontend/src/components/BottomNav.jsx` | `EQBottomNav` is the only official mobile bottom nav. Do not add page-local nav bars. |
| Page layout | `EQPageShell` for new screens; `EQMobileShell` for existing shell-owned pages | `WebLearningLayout` for mobile pages, page-local full-screen wrappers | Prefer `EQPageShell withBottomNav` for new core mobile pages. |
| Functional learning header | `CompactPageHeader` | `HeaderBar`, oversized local hero headers | Use compact headers on lesson/detail/quiz pages. |
| Hub/overview header | `EQHeroHeader` | Page-local hero systems | Use only for hubs, set lists, or overview pages, not dense learning flows. |
| Cards | `EQFantasyCard` | `FeatureCard`, ad hoc white cards | `EQQuestCard` and `EQInfoCard` may remain as semantic wrappers when styled in the fantasy family. |
| Quest card | `EQQuestCard` or `EQFantasyCard as="article"` | `FeatureCard`, local menu cards | Use for selectable lessons, quests, stages, and paths. |
| Info card | `EQInfoCard` or `EQPanel` | White definition blocks, admin cards | Use compact headings and badge rows. |
| Question card | `EQQuestionCard` plus official `EQChoiceButton` | Page-local white question cards | `EQQuestionCard` is UI-only and does not contain quiz logic. |
| Buttons | `EQFantasyButton` | Expanding `GoldQuestButton`, generic inline buttons | `EQPrimaryButton`/`EQSecondaryButton` can remain in primitive pages but should map visually to `EQFantasyButton` later. |
| Badges | `EQFantasyBadge` | Raw colored spans, browser/default badges | `EQBadge` can remain in primitive pages but new screens should prefer `EQFantasyBadge`. |
| Choice buttons | `EQChoiceButton` exported from `../components/eigo` | Default `frontend/src/components/eigo/EQChoiceButton.jsx` direct import, local choice buttons | The central export currently points to the primitives implementation; treat that as official. Merge duplicate implementation later. |
| Progress | `EQProgressBar`; `CompactPageHeader` progress for header-only progress | Many page-local progress bars | `EQProgressBar` is UI-only and should receive already-computed values. |
| Audio/TTS | `EQAudioButton` for UI; existing `TtsButton` behavior may be called by pages | Page-local unstyled speech buttons | `EQAudioButton` contains no audio implementation logic. |
| Modals | None yet | Browser/default dialogs, white modal systems | Add `EQModal` later only when needed. |

## 1. Layout

### Official Page Shell

Use `EQPageShell` from `frontend/src/components/eigo/EQFantasyUI.jsx` for new Eigo World mobile pages.

Preferred import:

```jsx
import { EQPageShell } from '../components/eigo';
```

Use it when:

- The page is a core Eigo mobile screen.
- The page needs `EQBottomNav`.
- The page should have constrained mobile content width with fantasy background styling.

Recommended pattern:

```jsx
<EQPageShell withBottomNav contentClassName="..." bottomNavClassName="...">
  ...
</EQPageShell>
```

### Existing Lightweight Shell

Use `EQMobileShell` for existing pages that already own their page background and bottom-nav placement.

Do not create new shell components unless neither `EQPageShell` nor `EQMobileShell` can support the layout.

### Bottom Padding Rule

Any page with `EQBottomNav` must reserve bottom space:

- Use `EQPageShell withBottomNav` when possible.
- If manually rendering `EQBottomNav`, ensure page content has `padding-bottom` of at least the nav height plus safe-area inset.
- Primary actions must not sit behind the fixed nav.

## 2. Headers

### Official Header Components

Use these in priority order:

1. `CompactPageHeader` for functional learning pages that need a visual fantasy header, helper image, progress, or BGM action.
2. `EQPageHeader` for dense content pages that need a compact structural header.
3. `EQHeroHeader` for hub, set-list, or celebratory pages where a larger visual header is useful.

Preferred imports:

```jsx
import { CompactPageHeader, EQPageHeader, EQHeroHeader } from '../components/eigo';
```

### Quest Header

`QuestHeader` may remain in existing quest flows such as flashcard/quiz sequences. For new work, prefer `CompactPageHeader` or a small page-local header based on the same visual rules.

### Do Not

- Do not create large hero headers for functional learning pages.
- Do not introduce generic admin/dashboard headers into Eigo mobile learning screens.
- Do not duplicate back controls when the header already provides one.

## 3. Cards

### Official Card Components

Use:

- `EQFantasyCard` for new gold-border fantasy cards.
- `EQQuestCard` for selectable quests, lessons, stages, and learning paths. It is a semantic wrapper and should stay visually aligned to `EQFantasyCard`.
- `EQInfoCard` for stats, summaries, definitions, grammar notes, and progress details. It is a semantic wrapper and should stay visually aligned to `EQFantasyCard`.
- `EQPanel` for lower-level dark/gold panels in content-heavy pages.

Preferred import:

```jsx
import { EQFantasyCard, EQQuestCard, EQInfoCard, EQPanel } from '../components/eigo';
```

### Card Mapping

| UI need | Official component | Notes |
|---|---|---|
| Quest Cards | `EQQuestCard` or `EQFantasyCard as="article"` | Whole card may be tappable when it is the primary action. |
| Question Cards | `EQQuestionCard` plus `EQChoiceButton` | Prompt, choices, feedback, and next action stay close together. |
| Info Cards | `EQInfoCard` or `EQPanel` | Use compact headings and short text. |
| Reward Cards | Existing reward/card collection components; use `EQFantasyCard` for new reward surfaces. | Keep visual card reward system. |
| Locked Cards | `EQQuestCard`/`EQFantasyCard` with `is-locked` class or disabled state. | Show lock as a badge/state, not a separate system. |

### Existing Cards

`EQCard` and `MagicPanel` are allowed for existing pages. New pages should prefer `EQFantasyCard`, `EQPanel`, or `EQQuestCard`.

`FeatureCard` should not be used for new Eigo mobile screens.

## 4. Buttons

### Official Button Component

Use `EQFantasyButton` from `EQFantasyUI.jsx` for new Eigo World mobile actions.

Preferred import:

```jsx
import { EQFantasyButton } from '../components/eigo';
```

Variants:

- `variant="gold"`: primary action.
- `variant="dark"` or a subdued class: secondary action.
- Ghost/outline actions: use a dark outlined page-local style until an official variant is added.
- Disabled/locked: use the native `disabled` prop plus visible opacity/filter state.

### Legacy Buttons

- `EQPrimaryButton` and `EQSecondaryButton` remain valid in pages using `EQFantasyPrimitives`.
- `GoldQuestButton` remains valid in existing quest flows but should not be expanded as a second button system.
- Do not import root-level or page-local generic buttons for new Eigo mobile UI.

### Gold Primary Action Rule

Every functional screen should have one clear gold primary action. Secondary actions should be darker, outlined, or visually quieter.

## 5. Badges

### Official Badge Component

Use `EQFantasyBadge` for new badges.

Use `EQBadge` where a page already uses primitive components.

Preferred import:

```jsx
import { EQFantasyBadge } from '../components/eigo';
```

Recommended badge variants/classes:

- `New`: new content or unstarted lessons.
- `Done`: completed content.
- `Lv`: level or difficulty.
- `Review`: review/wrong-answer flows.
- `Boss`: major challenge or final quiz.
- `Locked`: unavailable stages or content.

Keep badge text short. Badges communicate state; they should not compete with the primary action.

## 6. Progress

### Current Official Options

Use `EQProgressBar` for reusable lesson, quiz, and world progress.

Preferred import:

```jsx
import { EQProgressBar } from '../components/eigo';
```

`EQProgressBar` props:

- `value`
- `max`
- `label`
- `className`
- `showText = true`

Rules:

- Pass already-computed learning values; the component has no business logic.
- It clamps display value between `0` and `max`.
- Use `CompactPageHeader` progress props when progress belongs in the header.
- Use `QuestProgressStepper` for multi-step quest flows.

## 7. Question And Audio Components

### Question Cards

Use `EQQuestionCard` for reusable quiz/detail question containers.

Preferred import:

```jsx
import { EQQuestionCard, EQChoiceButton } from '../components/eigo';
```

`EQQuestionCard` props:

- `title`
- `subtitle`
- `children`
- `footer`
- `className`

Rules:

- It is UI-only and contains no quiz scoring, answer checking, fetch, or progress logic.
- Keep prompt, choices, feedback, and next action inside the same dark/gold surface.
- Use official `EQChoiceButton` for choices.

### Audio Buttons

Use `EQAudioButton` for pronunciation/listening/playback actions.

Preferred import:

```jsx
import { EQAudioButton } from '../components/eigo';
```

`EQAudioButton` props:

- `children`
- `onClick`
- `disabled`
- `playing`
- `label`
- `className`

Rules:

- It is UI-only and contains no `speechSynthesis`, TTS, or audio playback implementation.
- Pages should pass their existing playback handler to `onClick`.
- Use `label` for the accessible button label when visible text is not enough.

## 8. Navigation

`EQBottomNav` is the official bottom navigation for Eigo World mobile.

Preferred import:

```jsx
import { EQBottomNav } from '../components/eigo';
```

Rules:

- Do not duplicate bottom navigation inside page content.
- Do not use the older root `BottomNav` for new Eigo mobile pages.
- Keep `EQBottomNav` fixed at the bottom for core app areas.
- Hide/replace bottom nav only for focused flows where an existing pattern already does so.

Back navigation:

- Prefer the page header's back action.
- `EQBackPill` is acceptable for existing world/card pages.

## 9. Missing Components

Add these later only if existing components cannot reasonably be extended:

- `EQStatusBadge`: standardized `New`, `Learning`, `Review`, `Passed`, `Locked` states.
- `EQModal`: dark fantasy modal/dialog with focus management.
- `EQTabs`: fantasy segmented tabs for filters and modes.

Before adding any of these, check whether `EQFantasyCard`, `EQFantasyButton`, `EQFantasyBadge`, `EQPanel`, `EQChoiceButton`, `EQProgressBar`, `EQQuestionCard`, `EQAudioButton`, or `CompactPageHeader` can be extended.

## 10. Migration Guidance

When updating an existing mobile page:

1. Keep API, routes, progress, quiz scoring, and learning logic unchanged.
2. Replace page-local duplicate UI patterns with official components incrementally.
3. Preserve `EQBottomNav` behavior and bottom padding.
4. Avoid large visual rewrites unless requested.
5. Verify with `cd frontend && npm run build`.

Recommended first migration after this audit:

- `GrammarQuestPage` / grammar quiz UI, because it can now use the official `EQQuestionCard`, `EQChoiceButton`, `EQProgressBar`, and `EQAudioButton` pattern.
