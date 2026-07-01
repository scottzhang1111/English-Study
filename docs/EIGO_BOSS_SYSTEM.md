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

- 50% from Stage 1-9 words/questions
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

- Mini Boss HP: 400
- World Boss HP: 600

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

When a child defeats a Boss for the first time, they obtain that Boss card.

Boss Card fields:

- boss_id
- world_id
- stage_id
- boss_name
- rarity
- image_path
- defeated_at
- best_rank
- best_score
- clear_count

Collection UI direction:

- add a Boss Cards section/tab to Card Collection
- obtained Boss cards show the full card
- locked Boss cards show silhouette / locked state
- show progress like `1 / 24`

V1:

- only Wind Stage 4 Boss card reward
- show in Card Collection
- no upgrade system yet

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

- normal
- mini_boss
- world_boss

Unlock flow:

- If Stage 1-3 cleared: Stage 4 Mini Boss unlocks
- If Stage 4 Boss cleared: Stage 5 unlocks
- If Stage 5-7 cleared: Stage 8 Mini Boss unlocks
- If Stage 8 Boss cleared: Stage 9 unlocks
- If Stage 9 cleared: Stage 10 World Boss unlocks
- If Stage 10 World Boss cleared: next world unlocks

UI:

- Boss nodes should look larger / more dangerous
- show Boss icon or Boss silhouette
- show locked / available / cleared state

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

This section is a proposal only. Do not implement migrations yet.

Potential table: `bosses`

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

Potential table: `child_boss_progress`

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

Potential table: `child_boss_cards`

- id
- child_id
- boss_id
- obtained_at
- rank_when_obtained
- is_new
- created_at

Potential table: `boss_attempts`

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

Potential table: `boss_attempt_items`

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

- complete Stage 1-3
- unlock Stage 4 Boss
- Boss questions come from Stage 1-3
- clear Boss
- obtain Boss card
- unlock Stage 5
- Boss card visible in Card Collection

V1 should prove:

- study map integration
- boss review logic
- reward card collection
- hero skill basics
- no backend overengineering

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
2. Should Boss clear require 100% Boss HP defeat, or correct rate threshold?
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

- add mock Boss Card reward to Card Collection

Priority backlog before expanding Boss features:

- Gate the next normal stage behind Mini Boss clear. For Wind Stage 4 Mini Boss, Stage 5 must remain locked until the Boss clear state is persisted for the selected child.
- Persist Boss Card ownership after reward claim and show the obtained Boss Card in Card Collection for the selected child.
- Implement both items with backend-backed child progress/reward data, not localStorage-only state.
