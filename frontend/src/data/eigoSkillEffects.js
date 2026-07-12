const ELEMENT_LABELS = {
  wind: '風',
  fire: '炎',
  water: '水',
  thunder: '雷',
  wood: '森',
  rock: '岩',
  light: '光',
  shadow: '影',
};

const ELEMENT_SKILL_NAMES = {
  wind: ['風刃斬り', '疾風突き', '旋風連撃', '風の加護', '真空波', '嵐の一閃'],
  fire: ['火炎斬り', '紅蓮弾', '爆炎連撃', '炎の加護', '隕石落とし', '業火の一閃'],
  water: ['水流斬り', '氷晶弾', '氷河連撃', '水の加護', '氷柱落とし', '大海の一閃'],
  thunder: ['雷光斬り', '電撃弾', '迅雷連撃', '雷の加護', '天雷落とし', '稲妻の一閃'],
  wood: ['葉刃斬り', '種子弾', '蔦の連撃', '森の加護', '大樹の槍', '生命の一閃'],
  rock: ['岩砕斬り', '岩石弾', '地裂連撃', '岩の加護', '巨岩落とし', '大地の一閃'],
  light: ['聖光斬り', '光輝弾', '星光連撃', '光の加護', '天光落とし', '神聖の一閃'],
  shadow: ['影刃斬り', '暗黒弾', '幻影連撃', '影の加護', '闇槍落とし', '冥界の一閃'],
};

const TEMPLATE_SEQUENCE = [
  'slash',
  'projectile',
  'combo',
  'blessing',
  'vertical',
  'burst',
];

export const SKILL_EFFECT_PRESETS = {
  wind_slash: { element: 'wind', template: 'slash', duration: 700, impactDelay: 360 },
  gale_thrust: { element: 'wind', template: 'projectile', duration: 560, impactDelay: 330 },
  cyclone_combo: { element: 'wind', template: 'combo', duration: 760, impactDelay: 350 },
  wind_blessing: { element: 'wind', template: 'blessing', duration: 860, impactDelay: 260, placement: 'hero' },
};

Object.keys(ELEMENT_SKILL_NAMES).forEach((element) => {
  if (element === 'wind') return;
  TEMPLATE_SEQUENCE.forEach((template, index) => {
    const motion = `${element}_${template}`;
    SKILL_EFFECT_PRESETS[motion] = {
      element,
      template,
      duration: template === 'combo' ? 820 : template === 'blessing' ? 900 : template === 'vertical' ? 780 : 720,
      impactDelay: template === 'blessing' ? 260 : template === 'vertical' ? 300 : 350,
      placement: template === 'blessing' ? 'hero' : 'boss',
      name: ELEMENT_SKILL_NAMES[element][index],
    };
  });
});

export function getSkillPreset(motion) {
  return SKILL_EFFECT_PRESETS[motion] || SKILL_EFFECT_PRESETS.wind_slash;
}

export function getWorldSkillForStage(worldId, stageId) {
  const element = ELEMENT_SKILL_NAMES[worldId] ? worldId : 'wind';
  const index = (Math.max(Number(stageId) || 1, 1) - 1) % TEMPLATE_SEQUENCE.length;

  if (element === 'wind') {
    const windMotions = ['wind_slash', 'gale_thrust', 'cyclone_combo', 'wind_blessing'];
    const motion = windMotions[index % windMotions.length];
    return {
      name: ELEMENT_SKILL_NAMES.wind[index],
      motion,
    };
  }

  return {
    name: ELEMENT_SKILL_NAMES[element][index],
    motion: `${element}_${TEMPLATE_SEQUENCE[index]}`,
  };
}

export function getSkillElementLabel(motion) {
  const preset = getSkillPreset(motion);
  return ELEMENT_LABELS[preset.element] || ELEMENT_LABELS.wind;
}
