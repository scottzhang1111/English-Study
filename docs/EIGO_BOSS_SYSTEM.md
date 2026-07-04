# Eigo Quest Boss System

## 1. Product Goal

Boss Battle is not just a mini game. It is a milestone review system that connects learning, review, card rewards, and world progression.

Core loop:

```text
Learning Stage
-> Stage Quiz
-> Boss Battle checkpoint
-> Review previous stages
-> Clear Boss
-> Unlock next stages / obtain Boss Card
```

Boss Battle should make children feel:

- challenge
- achievement
- collection reward
- progress through fantasy worlds

The battle presentation can feel like a fantasy card game, but the product purpose is learning-first: children answer review questions, see their progress, and receive a meaningful card reward after clearing a milestone.

## 2. World Structure

Eigo Quest has 8 worlds:

1. Wind World / 風の世界
2. Fire World / 火の世界
3. Water World / 水の世界
4. Thunder World / 雷の世界
5. Forest World / 森の世界
6. Rock World / 岩の世界
7. Shadow World / 影の世界
8. Light World / 光の世界

Each world has 10 stages.

Boss placement per world:

- Stage 4: Mini Boss 1
- Stage 8: Mini Boss 2
- Stage 10: World Boss

Total boss count:

```text
8 worlds x 3 bosses = 24 bosses
```

## 3. Stage Structure

Each world follows this stage structure:

- Stage 1: normal learning
- Stage 2: normal learning
- Stage 3: normal learning
- Stage 4: normal learning
- Mini Boss 1 battle
- Stage 5: normal learning
- Stage 6: normal learning
- Stage 7: normal learning
- Stage 8: normal learning
- Mini Boss 2 battle
- Stage 9: normal learning
- Stage 10: normal learning
- World Boss battle

Mini Boss 1 Boss:

- reviews Stages 1-3
- acts as the first checkpoint
- confirms the child can remember the first cluster of words before moving forward

Mini Boss 2 Boss:

- reviews Stages 5-7
- includes some earlier review from Stages 1-4
- checks whether earlier learning still holds after more stages

World Boss battle:

- reviews the full world
- acts as the final world clear condition
- gives the child a strong sense of world completion

## 4. Boss Review Question Logic

Boss questions should come from learning history, not random unrelated content.

Mini Boss 1 Boss question source:

- 70% from Stage 1-4 words/questions
- 20% from mistakes in Stage 1-4
- 10% from high-frequency / important words

Mini Boss 2 Boss question source:

- 60% from Stage 5-8 words/questions
- 25% from Stage 1-4 review
- 15% from mistakes / weak words

World Boss battle question source:

- 50% from Stage 1-10 words/questions
- 30% from mistakes / weak words
- 20% from important words / mixed review

Question count V1:

- Mini Boss: 20 questions
- World Boss: 30 questions

Question format V1:

- 4-choice quiz
- same style as existing word quiz
- no typing in V1
- no listening in V1

Future question sources:

- grammar review
- listening review
- mixed skill Boss
- FSRS due-word priority

## 5. Boss Battle Rules

V1 battle rules should stay simple and easy for children to understand.

Player:

- HP: 100

Boss:

- Mini Boss HP: 320
- World Boss HP: 480

HP balance rationale:

- V1 should allow children to clear Boss battles at around 80% correct rate.
- Base damage assumption: 1 correct answer deals about 20 damage.
- Mini Boss: 20 questions x 80% x 20 damage = 320 HP.
- World Boss: 30 questions x 80% x 20 damage = 480 HP.
- Do not change question count or question source logic for this balance change.

Correct answer:

- active hero attacks
- Boss HP decreases
- combo increases
- hero skill may trigger

Wrong answer:

- Boss counterattacks
- Player HP decreases
- combo resets
- active hero may stay or advance depending on the selected V1 rule

Clear condition:

- Boss HP <= 0

Fail condition:

- Player HP <= 0
- or question deck exhausted while Boss is still alive

V1 should avoid complex timing, manual skills, mana systems, deck building, or hidden calculations.

## 6. Hero Skill System

V1 design principle:

- skills trigger automatically on correct answer
- no manual skill button
- no cooldown
- no mana/energy
- easy for children to understand

Skill types:

1. Damage Skill
   - adds fixed extra damage

2. Combo Skill
   - adds bonus damage when combo is high

3. Heal Skill
   - heals player HP after a correct answer

4. Defense Skill
   - reduces damage from the next Boss counterattack

Example Wind Hero skills:

Hero 1:

- name: 風の守護者 1
- skill: 風刃斬り
- type: damage
- effect: normal wind slash attack

Hero 2:

- name: 風の守護者 2
- skill: 疾風突き
- type: damage_bonus
- effect: +2 damage

Hero 3:

- name: 風の守護者 3
- skill: 譌矩｢ｨ騾｣謦・
- type: combo_bonus
- effect: extra damage when combo >= 2

Hero 4:

- name: 風の守護者 4
- skill: 風の加護
- type: heal
- effect: heal player HP on correct answer

## 7. Boss Card Collection

When a child defeats a Boss for the first time, they obtain that Boss Card.

V1 implementation direction:

- Persist Boss Card ownership in the backend.
- Show obtained Boss Cards in Card Collection.
- Do not rely on localStorage-only Boss rewards.
- Do not build the full 24-card Boss album before the first loop works.
- First target: Wind Stage 4 Mini Boss.

Boss Card fields:

- boss_id
- card_id
- world_id
- stage_id
- boss_type
- boss_name
- rarity
- image_path
- card_image_path
- obtained_at
- clear_count
- is_new

V1 recommended persistence strategy:

- Reuse the existing card ownership system if possible.
- Prefer using the existing `heroes` / `child_heroes` flow instead of creating a new Boss-only table immediately.
- Treat Boss Cards as special cards with a stable `card_id` / `hero_id`.
- Use a stable id pattern such as:
  - `wind-stage-4-mini-boss-1-card`
  - `wind-stage-8-mini-boss-2-card`
  - `wind-stage-10-world-boss-card`

Duplicate prevention:

- A child should receive each Boss Card only once.
- Re-clearing the same Boss should not create duplicate ownership rows.
- The reward response should return `is_new: false` when the child already owns the card.

Collection UI direction:

- Add a Boss Cards section/tab to Card Collection when feasible.
- V1 may also show obtained Boss Cards inside the existing Card Collection list if adding tabs is too much.
- Obtained Boss Cards show the full card.
- Locked Boss Cards may show silhouette / locked state later.
- Show progress like `1 / 24` after the Boss card list is stable.

V1:

- Wind Stage 4 Mini Boss Card reward.
- Boss Card is written to DB.
- Boss Card is visible in Card Collection for the selected child.
- No upgrade system yet.
- Locked Boss Cards are optional in V1.

Future:

- S rank shiny card
- animated card
- Boss card album by world
- re-challenge for better rank

## 8. Boss Clear Rank

Rank examples:

S Rank:

- correct rate >= 90%
- player HP >= 70

A Rank:

- correct rate >= 80%

B Rank:

- clear Boss

C Rank:

- failed but reached Boss HP below 30%

Use ranks for:

- motivation
- card border variation
- parent progress view
- re-challenge reason

V1:

- store clear / not clear
- optionally calculate rank frontend-only
- DB rank can be added later

## 9. Study Map Integration

Boss nodes should appear in Study Map as special stage nodes.

Boss stage node types:

- `normal`
- `mini_boss`
- `world_boss`

### 9.1 Source of Truth

Study Map must separate **normal Stage progress** from **Boss Gate progress**.

Normal Stage progress source:

- `child_world_stage_progress`
- A normal stage with `status = 'cleared'` must always display as cleared.
- A normal stage with `status = 'in_progress'` must display as available / in progress.
- Boss Gate logic must not lock a normal stage that already has historical progress.

Boss progress source:

- V1 may use existing backend-backed reward / card ownership state if Boss clear progress is not yet separated.
- Future implementation may use `child_boss_progress`.
- Do not use localStorage-only Boss clear state for final product behavior.

### 9.2 Normal Stage Unlock Rules

For normal stage nodes:

- Stage 1 is available by default.
- Stage 2 is available after Stage 1 is cleared.
- Stage 3 is available after Stage 2 is cleared.
- Stage 4 is available after Stage 3 is cleared.
- Stage 5 is available after Mini Boss 1 is cleared.
- Stage 6 is available after Stage 5 is cleared.
- Stage 7 is available after Stage 6 is cleared.
- Stage 8 is available after Stage 7 is cleared.
- Stage 9 is available after Mini Boss 2 is cleared.
- Stage 10 is available after Stage 9 is cleared.

Important rule:

- If a normal stage already exists as `cleared` or `in_progress` in `child_world_stage_progress`, it must not be locked by missing Boss progress.
- Existing learning progress must always win over gate calculation for that specific normal stage.

### 9.3 Boss Node Unlock Rules

For Boss nodes:

- Mini Boss 1 unlocks after Stage 4 is cleared.
- Mini Boss 2 unlocks after Stage 8 is cleared.
- World Boss unlocks after Stage 10 is cleared.
- The next world unlocks after the current world's World Boss is cleared.

### 9.4 Legacy Progress Compatibility

Boss Gate was added after some children had already cleared later stages.

Therefore Study Map must support old progress safely.

Compatibility rules:

- If Stage 5 or any later stage is already `cleared` or `in_progress`, treat Mini Boss 1 gate as satisfied for map display.
- If Stage 9 or any later stage is already `cleared` or `in_progress`, treat Mini Boss 2 gate as satisfied for map display.
- If Stage 10 is already cleared, World Boss should be available even if World Boss clear progress is missing.
- Do not roll back or hide previously cleared stages.
- Do not delete or rewrite existing `child_world_stage_progress` rows just to satisfy Boss Gate.

Example:

```text
child_id = 33
wind stage 1-10 = cleared
fire stage 1-10 = cleared
water stage 1-5 = cleared
water stage 6 = in_progress
```

Expected map display:

```text
Wind:
- Stage 1-10: cleared
- Mini Boss 1: treated as gate satisfied for map display
- Mini Boss 2: treated as gate satisfied for map display
- World Boss: available unless already cleared

Fire:
- Stage 1-10: cleared
- Mini Boss 1: treated as gate satisfied for map display
- Mini Boss 2: treated as gate satisfied for map display
- World Boss: available unless already cleared

Water:
- Stage 1-5: cleared
- Stage 6: available / in_progress
- Mini Boss 1: treated as gate satisfied for map display because Stage 5 is cleared
- Mini Boss 2: locked until Stage 8 is cleared
- World Boss: locked until Stage 10 is cleared
```

### 9.5 Recommended Frontend Helpers

Recommended helper behavior:

```text
hasStageCleared(worldId, stageNumber)
hasStageInProgress(worldId, stageNumber)
hasReachedStage(worldId, stageNumber)
isBossCleared(bossId)
isMiniBoss1GateSatisfied(worldId)
isMiniBoss2GateSatisfied(worldId)
isWorldBossAvailable(worldId)
```

Suggested logic:

```text
isMiniBoss1GateSatisfied(worldId):
  true if Mini Boss 1 is cleared
  OR Stage 5 or higher is cleared / in_progress

isMiniBoss2GateSatisfied(worldId):
  true if Mini Boss 2 is cleared
  OR Stage 9 or higher is cleared / in_progress

isWorldBossAvailable(worldId):
  true if Stage 10 is cleared
```

Node state priority:

```text
For normal stage nodes:
1. If stage is cleared in child_world_stage_progress -> cleared
2. If stage is in_progress in child_world_stage_progress -> available / in_progress
3. Else calculate availability from unlock rules
4. Else locked

For boss nodes:
1. If boss is cleared -> cleared
2. If required stage is cleared -> available
3. Else locked
```

### 9.6 UI

Boss nodes should look larger / more dangerous.

UI should show:

- Boss icon or Boss silhouette
- locked / available / cleared state
- clear distinction between normal stages and Boss checkpoints

## 10. Failure Flow

Boss failure should still support learning.

When player fails:

- show encouragement
- show missed words/questions
- offer review
- offer retry

Failure result page should include:

- incorrect questions
- weak words
- retry Boss
- review first

Text direction:

- あと少し！
- この単語をもう一度復習しよう
- もう一度挑戦

V1:

- show simple failed state
- retry button
- return to review / map

Future:

- generate weak-word mini review
- add FSRS review queue

## 11. Data Model Proposal

V1 should avoid overengineering.

Recommended V1 approach:

- Reuse existing `heroes` / `child_heroes` or the current card ownership system.
- Add Boss Cards as special card records if the existing schema can support them.
- Do not create all Boss-specific tables until the first Boss reward loop is stable.
- If existing schema cannot represent Boss Cards, report the minimum required schema change before implementing it.

Potential future table: `bosses`

- id
- boss_id
- world_id
- stage_id
- boss_type
- name_ja
- name_en
- hp
- image_path
- card_image_path
- rarity
- unlock_stage
- created_at
- updated_at

Potential future table: `child_boss_progress`

- id
- child_id
- boss_id
- status
- best_rank
- best_score
- best_correct_rate
- best_remaining_hp
- clear_count
- first_cleared_at
- last_attempted_at

Potential future table: `child_boss_cards`

- id
- child_id
- boss_id
- obtained_at
- rank_when_obtained
- is_new
- created_at

Potential future table: `boss_attempts`

- id
- child_id
- boss_id
- started_at
- finished_at
- result
- score
- correct_count
- total_questions
- remaining_hp
- boss_remaining_hp
- rank

Potential future table: `boss_attempt_items`

- id
- attempt_id
- question_id
- source_type
- source_stage_id
- word_id
- grammar_point_id
- is_correct
- selected_answer
- correct_answer

## 12. Frontend Route Proposal

Current prototype:

- `/boss-battle-v1`

Product route proposal:

- `/boss-battle/:bossId`
- or `/boss-battle?worldId=wind&stageId=4`

Recommended V1 route:

- keep `/boss-battle-v1` for prototype
- add parameterized support later: `/boss-battle?bossId=wind-mini-01`

Do not remove `/boss-battle-v1` until the product route is stable.

## 13. Backend API Proposal

Documentation only.

Potential APIs:

`GET /api/bosses`

- list bosses by world / child

`GET /api/bosses/:bossId`

- boss detail

`GET /api/bosses/:bossId/questions`

- generated boss review question deck

`POST /api/bosses/:bossId/attempt/start`

- create attempt

`POST /api/bosses/:bossId/attempt/finish`

- save result
- unlock next stage
- grant Boss card

V1 minimum API if no Boss clear API exists:

`POST /api/children/:childId/bosses/:bossId/clear`

- confirms Boss clear
- grants Boss Card
- prevents duplicate card ownership
- returns reward payload

`GET /api/children/:childId/boss-cards`

- list obtained Boss cards

V1 can be frontend mock first. Backend can be added after flow is stable.

## 14. V1 Implementation Scope

V1 should not build all 24 bosses at once.

V1 minimum product loop:

World:

- Wind only

Boss:

- Stage 4 Mini Boss only

Flow:

- complete Stage 1-4
- unlock Stage 4 Mini Boss
- Boss questions come from Stage 1-4
- clear Boss
- obtain Boss Card
- Boss Card is persisted in DB
- Boss Card is visible in Card Collection
- unlock Stage 5

V1 should prove:

- study map integration
- boss review logic
- reward card collection
- hero skill basics
- no backend overengineering

### V1 Boss Card Implementation Requirements

For the first backend-backed Boss Card loop:

1. Boss clear trigger
   - Detect Boss clear only after the Boss Battle result is confirmed.
   - Failure must not grant Boss Card.
   - Re-clearing the same Boss must not duplicate the card.

2. Reward function
   - Add or reuse a function like `grant_child_boss_card(child_id, boss_id)`.
   - It should return a reward payload:
     ```json
     {
       "reward_type": "boss_card",
       "card_id": "wind-stage-4-mini-boss-1-card",
       "boss_id": "wind-stage-4-mini-boss-1",
       "name_ja": "...",
       "image_path": "...",
       "rarity": "boss",
       "is_new": true
     }
     ```

3. Persistence
   - Prefer writing Boss Card ownership to the existing `child_heroes` or current card ownership table.
   - Use existing uniqueness rules if available.
   - If no unique constraint exists, check ownership before insert.

4. Card Collection
   - Card Collection must read and display Boss Card ownership.
   - V1 can show only obtained Boss Cards.
   - Locked Boss Cards / silhouette states can be added later.

5. Safety
   - Do not change normal Stage reward logic.
   - Do not change Daily Review.
   - Do not change `/today-review-quiz`.
   - Do not change Stage Quiz clear/reward behavior while implementing Boss Card persistence.


## 15. V2 Scope

After V1 works:

- Wind Stage 8 Mini Boss
- Wind Stage 10 World Boss
- Boss Card Collection tab
- clear rank
- retry for better rank
- better failure review

## 16. V3 Scope

After Wind world works:

- expand to all 8 worlds
- 24 Boss data
- world-specific Hero skills
- world-specific Boss effects
- FSRS-driven Boss review
- parent progress report

## 17. Design Principles

Boss Battle must stay learning-first.

Rules:

- battle should motivate learning
- do not make game mechanics too complex
- children should understand why they lost
- wrong answers should become review material
- rewards should connect to progress
- UI should be magical but not block readability

## 18. Open Questions

1. Should Boss Battle include grammar questions or only words in V1?
2. Boss HP balance is set so around 80% correct rate can clear V1 Boss battles. Should later versions use rank-based thresholds in addition to HP?
3. Should failed Boss attempts still give partial rewards?
4. Should Hero skills be tied to collected Hero cards or fixed party?
5. Should Boss cards have rarity variations by rank?
6. Should Stage 10 World Boss unlock next world immediately?
7. How much should parent dashboard show Boss progress?
8. Should Boss questions include only current world words or cross-world review?

## 19. Immediate Next Steps

After this document is created, do not implement everything.

Next coding step should be Step B:

- create frontend-only Boss config structure for Wind Stage 4
- include boss metadata
- include stage mapping
- include review question source rule
- include boss card reward metadata

Step C:

- connect Study Map Stage 4 to `/boss-battle-v1` or `/boss-battle?bossId=wind-mini-01`

Step D:

- implement real Boss Card reward persistence
- grant Wind Stage 4 Mini Boss Card after Boss clear
- write ownership to DB through the existing card ownership system if possible
- show the obtained Boss Card in Card Collection

Priority backlog before expanding Boss features:

- Fix Study Map unlock calculation so normal stage progress from `child_world_stage_progress` is always respected.
- Add Boss Gate compatibility for historical children who cleared Stage 5+ or Stage 9+ before Boss progress existed.
- Gate future uncompleted stages behind Mini Boss clear, but never lock stages that are already `cleared` or `in_progress`.
- For Wind Stage 4 Mini Boss, Stage 5 should remain locked only for children who have not cleared/in-progress Stage 5+ and have not cleared Mini Boss 1.
- Persist Boss Card ownership after reward claim and show the obtained Boss Card in Card Collection for the selected child.
- Implement Boss Gate and Boss Card ownership with backend-backed child progress/reward data, not localStorage-only state.
- Avoid duplicate Boss Card ownership rows when the same child clears the same Boss again.
- Do not modify `/today-review-quiz`, Stage Quiz question generation, Daily Review, or normal Stage rewards while implementing Boss Gate compatibility or Boss Card persistence.
