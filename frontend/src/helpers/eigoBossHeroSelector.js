function shuffle(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function heroMatchesWorld(hero, worldId) {
  if (!worldId) return true;
  const normalizedWorldId = String(worldId).toLowerCase();
  return String(
    hero.worldId || hero.world_id || hero.element || normalizedWorldId,
  ).toLowerCase() === normalizedWorldId
    || String(hero.id || '').toLowerCase().includes(normalizedWorldId);
}

function heroMatchesStageCluster(hero, sourceStages = []) {
  if (!sourceStages.length) return true;
  const stageId = Number(hero.stageId || hero.stage_id || hero.stage || 0);
  return stageId ? sourceStages.includes(stageId) : false;
}

function takeWithFallback(primaryHeroes, fallbackHeroes, count) {
  const seen = new Set();
  const selected = [];

  [...primaryHeroes, ...fallbackHeroes].forEach((hero) => {
    if (!hero || selected.length >= count) return;
    const key = String(hero.id || hero.name || selected.length);
    if (seen.has(key)) return;
    seen.add(key);
    selected.push(hero);
  });

  return selected;
}

export function selectBossHeroParty({ bossConfig, availableHeroes = [], fallbackHeroes = [] } = {}) {
  const heroRule = bossConfig?.heroRule || {};
  const count = Math.max(1, Number(heroRule.count || 4));
  // TODO: Replace fallbackHeroes with real child-owned hero card data once backend ownership is available.
  const candidates = availableHeroes.length ? availableHeroes : fallbackHeroes;

  if (heroRule.type === 'stage_cluster') {
    const sourceStages = (heroRule.sourceStages || []).map(Number);
    const exactHeroes = candidates.filter((hero) => heroMatchesStageCluster(hero, sourceStages));
    return takeWithFallback(exactHeroes, fallbackHeroes, count);
  }

  if (heroRule.type === 'random_world') {
    const worldHeroes = shuffle(candidates.filter((hero) => heroMatchesWorld(hero, heroRule.worldId)));
    return takeWithFallback(worldHeroes, fallbackHeroes, count);
  }

  return takeWithFallback(candidates, fallbackHeroes, count);
}
