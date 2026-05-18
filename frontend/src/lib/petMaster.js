import petMaster from '../pet_master_ja.json';

export const PET_MASTER = petMaster.map((pet, index) => ({
  ...pet,
  catalogId: index + 1,
  image_url: pet.image,
  sprite_url: pet.image,
  name: pet.nameJa,
  types: [{ name: pet.element }],
}));

export const PET_MASTER_BY_ID = new Map(PET_MASTER.map((pet) => [pet.id, pet]));
export const PET_MASTER_BY_CATALOG_ID = new Map(PET_MASTER.map((pet) => [String(pet.catalogId), pet]));

export const PET_STARTER_OPTIONS = PET_MASTER.filter((pet) => pet.stage === 1).map((pet) => ({
  id: pet.catalogId,
  pet_id: pet.id,
  name: pet.nameJa,
  image_url: pet.image,
  sprite_url: pet.image,
  types: [{ name: pet.element }],
  tagsJa: pet.tagsJa || [],
}));

export function getPetMasterByAnyId(value) {
  if (value === null || value === undefined || value === '') return PET_MASTER[0];
  const key = String(value);
  return PET_MASTER_BY_ID.get(key) || PET_MASTER_BY_CATALOG_ID.get(key) || PET_MASTER[0];
}

export function decoratePet(rawPet = {}, fallbackId) {
  const master = getPetMasterByAnyId(rawPet.pet_id || rawPet.pokemon_id || rawPet.id || fallbackId);
  return {
    ...rawPet,
    id: master.id,
    pet_id: master.id,
    catalog_id: master.catalogId,
    pokemon_id: master.catalogId,
    name: rawPet.name && rawPet.name !== '???' ? rawPet.name : master.nameJa,
    nameJa: master.nameJa,
    element: master.element,
    image_url: master.image,
    sprite_url: master.image,
    imageUrl: master.image,
    master,
  };
}

function isRawPetCollected(pet = {}) {
  if (pet.unlocked === false || pet.isUnlocked === false || pet.owned === false || pet.collected === false) {
    return false;
  }
  if (pet.unlocked || pet.isUnlocked || pet.owned || pet.collected || pet.acquired || pet.acquiredAt || pet.unlocked_at) {
    return true;
  }
  const level = Number(pet.level);
  return Number.isFinite(level) && level > 0;
}

export function buildStaticPetCollection(ownedPets = []) {
  const ownedById = new Map(
    (ownedPets || [])
      .filter(isRawPetCollected)
      .map((pet) => [String(pet.pokemon_id || pet.catalog_id || pet.id), pet]),
  );
  return PET_MASTER.map((master) => {
    const owned = ownedById.get(String(master.catalogId));
    if (!owned) {
      const lockedPet = decoratePet({
        pokemon_id: master.catalogId,
        unlocked: false,
        name: '???',
        level: null,
        exp: 0,
        max_exp: 100,
        exp_progress: 0,
        total_exp: 0,
        status: 'locked',
      });
      return {
        ...lockedPet,
        name: '???',
        nameJa: '???',
      };
    }
    return decoratePet({ ...owned, unlocked: true }, master.catalogId);
  });
}
