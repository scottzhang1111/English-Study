export const WORLD_STAGE_NODE_TYPES = {
  STAGE: 'stage',
  MINI_BOSS: 'mini_boss',
  WORLD_BOSS: 'world_boss',
};

export const STANDARD_BOSS_WORLD_IDS = [
  'wind',
  'fire',
  'water',
  'thunder',
  'wood',
  'rock',
  'light',
];

const createNode = (stageId, nodeType, x, y) => ({
  stageId,
  nodeType,
  x,
  y,
});

const cloneLayout = (layout) => layout.map((node) => ({ ...node }));

export const WIND_WORLD_STAGE_LAYOUT = [
  createNode(1, WORLD_STAGE_NODE_TYPES.STAGE, 73.7, 83.5),
  createNode(2, WORLD_STAGE_NODE_TYPES.STAGE, 74.5, 68.4),
  createNode(3, WORLD_STAGE_NODE_TYPES.STAGE, 53.7, 57.2),
  createNode(4, WORLD_STAGE_NODE_TYPES.STAGE, 33.6, 56.5),
  createNode(4, WORLD_STAGE_NODE_TYPES.MINI_BOSS, 17.1, 34.0),
  createNode(5, WORLD_STAGE_NODE_TYPES.STAGE, 43.5, 42.8),
  createNode(6, WORLD_STAGE_NODE_TYPES.STAGE, 70.2, 41.6),
  createNode(7, WORLD_STAGE_NODE_TYPES.STAGE, 74.0, 30.0),
  createNode(8, WORLD_STAGE_NODE_TYPES.STAGE, 55.5, 25.9),
  createNode(8, WORLD_STAGE_NODE_TYPES.MINI_BOSS, 34.1, 20.5),
  createNode(9, WORLD_STAGE_NODE_TYPES.STAGE, 16.9, 10.1),
  createNode(10, WORLD_STAGE_NODE_TYPES.STAGE, 46.8, 7.8),
  createNode(10, WORLD_STAGE_NODE_TYPES.WORLD_BOSS, 89.7, 18.4),
];

export const SHADOW_WORLD_STAGE_LAYOUT = [
  createNode(1, WORLD_STAGE_NODE_TYPES.STAGE, 73.7, 83.5),
  createNode(2, WORLD_STAGE_NODE_TYPES.STAGE, 74.5, 68.4),
  createNode(3, WORLD_STAGE_NODE_TYPES.STAGE, 53.7, 57.2),
  createNode(4, WORLD_STAGE_NODE_TYPES.STAGE, 33.6, 56.5),
  createNode(4, WORLD_STAGE_NODE_TYPES.MINI_BOSS, 17.1, 34.0),
  createNode(5, WORLD_STAGE_NODE_TYPES.STAGE, 43.5, 42.8),
  createNode(5, WORLD_STAGE_NODE_TYPES.WORLD_BOSS, 89.7, 18.4),
];

export const WORLD_STAGE_LAYOUTS = {
  wind: cloneLayout(WIND_WORLD_STAGE_LAYOUT),
  fire: cloneLayout(WIND_WORLD_STAGE_LAYOUT),
  water: cloneLayout(WIND_WORLD_STAGE_LAYOUT),
  thunder: cloneLayout(WIND_WORLD_STAGE_LAYOUT),
  wood: cloneLayout(WIND_WORLD_STAGE_LAYOUT),
  rock: cloneLayout(WIND_WORLD_STAGE_LAYOUT),
  light: cloneLayout(WIND_WORLD_STAGE_LAYOUT),
  shadow: cloneLayout(SHADOW_WORLD_STAGE_LAYOUT),
};

export function getWorldStageLayout(worldId) {
  return cloneLayout(WORLD_STAGE_LAYOUTS[worldId] || WIND_WORLD_STAGE_LAYOUT);
}
