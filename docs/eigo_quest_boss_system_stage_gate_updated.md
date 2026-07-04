# Eigo Quest Boss System Stage Gate Update

## Study Map Integration

- Normal stage progress comes from `child_world_stage_progress`.
- A normal stage with `status = 'cleared'` must display as cleared.
- A normal stage with `status = 'in_progress'` must display as available / in progress.
- Boss gate logic must not lock a normal stage that already has historical progress.

## Normal Stage Unlock Rules

- Stage 1 available by default.
- Stage 2 available after Stage 1 is cleared.
- Stage 3 available after Stage 2 is cleared.
- Stage 4 available after Stage 3 is cleared.
- Stage 5 available after Mini Boss 1 is cleared.
- Stage 6 available after Stage 5 is cleared.
- Stage 7 available after Stage 6 is cleared.
- Stage 8 available after Stage 7 is cleared.
- Stage 9 available after Mini Boss 2 is cleared.
- Stage 10 available after Stage 9 is cleared.

## Boss Gate Compatibility

- If Stage 5 or later already has `cleared` or `in_progress`, Mini Boss 1 is treated as satisfied for map display.
- If Stage 9 or later already has `cleared` or `in_progress`, Mini Boss 2 is treated as satisfied for map display.
- If Stage 10 is already cleared, the World Boss is treated as available for map display.

## Node State Priority

### Normal stage nodes

1. If the stage is cleared in `child_world_stage_progress`, show `cleared`.
2. If the stage is in progress in `child_world_stage_progress`, show `available` / `in_progress`.
3. Otherwise use the unlock rule.
4. If no rule is satisfied, show `locked`.

### Boss nodes

1. If the boss is cleared, show `cleared`.
2. Otherwise if the gate condition is satisfied, show `available`.
3. Otherwise show `locked`.
