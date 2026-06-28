# Eigo Quest Game Loop Design

## 1. Purpose

Eigo Quest is not only an English learning app.
It should feel like a fantasy adventure where children learn words, clear stages, collect hero cards, and challenge bosses.

The core idea is:

```text
Learning = Power Up
Quiz = Battle
Cards = Hero Companions
Boss = Milestone Challenge
World Map = Main Progression
```

The system should make daily English learning feel like progressing through a game world.

---

## 2. Core Learning Loop

The basic loop is:

```text
Learn 20 words
↓
Take a Stage Quiz
↓
Clear the Stage
↓
Receive a Card Reward
↓
Unlock the next Stage
```

Children should not feel that they are simply memorizing words.
They should feel that they are clearing fantasy stages and gaining companions.

---

## 3. World Structure

Eigo Quest has eight fantasy worlds:

```text
Wind / Fire / Water / Thunder / Forest / Rock / Shadow / Light
```

Each world is divided into stages.

Recommended structure:

```text
1 Stage = 20 words
1 World = 10 stages
Stage 4 = Mini Boss 1
Stage 8 = Mini Boss 2
Stage 10 = World Boss
```

This avoids making children review too many words at once while still giving a meaningful boss challenge every few stages.

---

## 4. Boss Battle Concept

Boss battles are not action games.
They are English quiz battles with RPG presentation.

Battle logic:

```text
Correct answer → Hero attacks Boss
Wrong answer → Boss counterattacks
Boss HP reaches 0 → Clear
Player HP reaches 0 → Try Again
```

Boss battles should be used as milestone checks.

Recommended boss placement:

```text
Stage 4: Mini Boss 1
Stage 8: Mini Boss 2
Stage 10: World Boss
```

---

## 5. Card System Concept

Cards are not just collection items.
They should become the child’s hero companions.

Card roles:

```text
Stage Clear Reward
Mini Boss Reward
World Boss Reward
Battle Party Member
Collection / Card Library Item
```

For V1, cards should mainly provide visual motivation and battle presentation.
Do not overbuild complex card skills, deck building, or card upgrades too early.

---

## 6. First Playable Prototype

The first playable prototype is called:

```text
風の試練
```

Purpose:

```text
Test the feeling of:
Hero cards → Answer questions → Attack Boss → Clear / Fail
```

Implementation scope:

```text
Frontend only
Use existing local card assets
No backend change
No DB change
No app.py change
No Godot integration
```

Prototype battle setup:

```text
Wind world first 4 cards = Battle heroes
Dedicated wind mini boss card = Boss
Mock English questions = Battle questions
Correct answer = Boss HP decreases
Wrong answer = Player HP decreases
Clear = Show result and reward button
Fail = Show retry button
```

Confirmed V1 assets:

```text
Card back:
frontend/public/assets/eigo-quest/cards/back/wind-cover.png

Hero cards:
frontend/public/assets/eigo-quest/cards/wind/wind-guardian1.png
frontend/public/assets/eigo-quest/cards/wind/wind-guardian2.png
frontend/public/assets/eigo-quest/cards/wind/wind-guardian3.png
frontend/public/assets/eigo-quest/cards/wind/wind-guardian4.png

Boss card:
frontend/public/assets/eigo-quest/cards/boss/wind-mini-boss1.png
```

Test route:

```text
/boss-battle-v1
```

Temporary test entry:

```text
/cards page → small button → 風の試練テスト
```

---

## 7. Asset Directory Rule

Use clear asset separation for Eigo Quest card-related images.

```text
Card backs:
frontend/public/assets/eigo-quest/cards/back

Hero cards:
frontend/public/assets/eigo-quest/cards/{world}

Boss cards:
frontend/public/assets/eigo-quest/cards/boss

Learning Hub / Grammar display cards:
frontend/public/assets/eigo-quest/learning-hub
```

Important rule:

```text
Boss Battle must use Boss cards from:
frontend/public/assets/eigo-quest/cards/boss

Boss Battle should not use Learning Hub / Grammar display cards as enemy Boss images.
```

Recommended file naming rule:

```text
Use lowercase English filenames.
Use hyphens instead of spaces.
Avoid Japanese characters in filenames.
Avoid spaces in filenames.
```

Good examples:

```text
wind-mini-boss1.png
wind-mini-boss2.png
wind-world-boss.png
fire-mini-boss1.png
fire-world-boss.png
```

Avoid:

```text
wind mini boss1.png
風ボス1.png
Wind Boss 1.png
```

---

## 8. Technical Principles

### Do

```text
Use React frontend
Use existing public assets
Reuse existing fantasy UI components
Keep mobile layout compact
Keep BottomNav unchanged
Keep current login and child switching unchanged
Keep existing quiz, grammar, and study flows safe
```

### Do Not

```text
Do not modify app.py for V1
Do not add backend APIs for V1
Do not add DB tables for V1
Do not introduce Godot
Do not copy external card framework code
Do not build Deck Builder yet
Do not build complex card skill systems yet
Do not refactor StudyMap during the first prototype
Do not use Learning Hub / Grammar display cards as Boss Battle enemy images
```

---

## 9. UI Direction

The boss battle UI should follow the current Eigo Quest fantasy style:

```text
Deep navy background
Gold borders
Cyan glow
Yellow primary buttons
Card-like panels
Compact mobile-first layout
```

Recommended battle screen layout:

```text
Header: 風の試練
↓
Boss card image
Boss name
Boss HP bar
↓
Player HP bar
↓
4 hero cards
↓
Question panel
↓
Answer buttons
```

The first version should fit mostly within one mobile screen and avoid heavy scrolling.

---

## 10. Future Expansion

After the first playable prototype works, expand in this order:

```text
1. Connect Stage 4 to Mini Boss
2. Connect Stage 8 to Mini Boss
3. Connect Stage 10 to World Boss
4. Use real word quiz data instead of mock questions
5. Save boss clear result
6. Save card rewards
7. Show owned / locked cards in CardsPage
8. Add simple card effects
9. Add world-specific bosses
10. Add grammar and Eiken boss challenges
```

The priority is always:

```text
Learning flow first
Game presentation second
Complex game systems later
```

---

## 11. Product Rule

The game system must support learning.
It should never make the learning flow slower, confusing, or harder to maintain.

The best version of Eigo Quest is:

```text
A learning app that feels like an RPG,
not a game that accidentally contains English questions.
```
