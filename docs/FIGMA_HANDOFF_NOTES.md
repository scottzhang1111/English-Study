# Figma Handoff Notes For Eigo World UI

Figma is the visual design reference for Eigo World. React components remain the implementation source for behavior, props, data wiring, and accessibility.

Use [EIGO_UI_SYSTEM.md](./EIGO_UI_SYSTEM.md) for visual rules and [UI_COMPONENT_SYSTEM.md](./UI_COMPONENT_SYSTEM.md) for implementation component choices.

## Suggested Figma Pages

1. `00 Cover`
   - Product name, mobile-first goal, latest design-system version.
2. `01 Colors`
   - Dark fantasy backgrounds, gold borders, cyan focus/glow, status colors, disabled/locked states.
3. `02 Typography`
   - Japanese mobile heading scale, compact card titles, question text, button labels, badge text.
4. `03 Components`
   - Component set mirroring official React components.
5. `04 Page Templates`
   - Learning hub, lesson list, lesson detail, quiz, review, reward, settings templates.
6. `05 Screens`
   - Actual product screens and variants.

## Official Components To Mirror In Figma

| Code component | Suggested Figma component name | Usage |
|---|---|---|
| `EQPageShell` | `Layout/Page Shell` | Mobile page background, safe-area spacing, max-width frame, optional bottom nav. |
| `EQMobileShell` | `Layout/Mobile Shell Legacy` | Existing page wrapper; mirror only for legacy templates. |
| `EQBottomNav` | `Navigation/Bottom Nav` | Official fixed mobile bottom navigation. |
| `CompactPageHeader` | `Header/Compact Quest Header` | Functional learning pages with title, helper image, progress, or BGM action. |
| `EQPageHeader` | `Header/Page Header Compact` | Dense content pages with short title, subtitle, meta, actions. |
| `EQHeroHeader` | `Header/Hero Quest Header` | Hub/list/celebration pages; not default for functional learning pages. |
| `QuestHeader` | `Header/Quest Flow Header` | Existing flashcard/quiz flow header. |
| `EQFantasyCard` | `Card/Fantasy Card` | Default gold-border content card. |
| `EQPanel` | `Card/Panel` | Compact information or question panels. |
| `EQQuestCard` | `Card/Quest Card` | Selectable stage, lesson, journey, or learning path. |
| `EQInfoCard` | `Card/Info Card` | Stats, summaries, grammar notes, definitions, progress details. |
| `EQCard` | `Card/Legacy Glow Card` | Existing older card surface; avoid as default for new designs. |
| `EQFantasyButton` | `Button/Fantasy Button` | Official button set: primary gold, secondary dark, disabled/locked. |
| `EQPrimaryButton` | `Button/Primary Primitive` | Existing primitive gold button. |
| `EQSecondaryButton` | `Button/Secondary Primitive` | Existing primitive secondary button. |
| `GoldQuestButton` | `Button/Gold Quest Legacy` | Existing quest-flow gold button; visually align with `Button/Fantasy Button`. |
| `EQFantasyBadge` | `Badge/Fantasy Badge` | Official badge set for New, Done, Lv, Review, Boss, Locked. |
| `EQBadge` | `Badge/Primitive Badge` | Existing tone-based primitive badge. |
| `EQChoiceButton` | `Quiz/Choice Button` | A/B/C/D choices with default, selected, correct, wrong, disabled states. |
| `QuestProgressStepper` | `Progress/Quest Stepper` | Multi-step learning quest progress. |
| Future `EQProgressBar` | `Progress/Bar` | Lesson, quiz, world progress; create after React component exists. |
| Future `EQQuestionCard` | `Quiz/Question Card` | Prompt, choice stack, feedback, next action; create after React component exists. |
| Future `EQAudioButton` | `Button/Audio Button` | TTS/play action for examples and words. |
| Future `EQModal` | `Overlay/Modal` | Dark fantasy modal/dialog. |
| Future `EQTabs` | `Navigation/Tabs` | Fantasy segmented filters and modes. |

## Component State Checklist

For each Figma component, include these variants where relevant:

- Default
- Pressed
- Focus
- Disabled
- Locked
- Selected
- Correct
- Wrong
- Loading
- Empty state

## Visual Tokens To Capture

- Page background: dark navy/violet gradient, subtle stars/glow.
- Card fill: translucent dark blue.
- Card border: warm gold, soft inner highlight.
- Primary action: gold button with readable dark text.
- Secondary action: dark outlined/subdued.
- Focus/selected: cyan glow.
- Correct: green.
- Wrong/needs review: warm red/rose, child-friendly.
- Locked/disabled: muted gray-blue.

## Handoff Rule

Figma may define the visual target, but implementation should reuse the official React components documented in `docs/UI_COMPONENT_SYSTEM.md`.

When Figma introduces a visual variant:

1. First check whether the React component already supports it through props or class variants.
2. Prefer extending an existing component variant.
3. Add a new component only when it represents a genuinely new reusable pattern.
4. Do not create duplicate button, card, header, question, or bottom-nav systems.
