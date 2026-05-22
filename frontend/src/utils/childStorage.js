import { getPetMasterByAnyId } from '../lib/petMaster';

const CURRENT_CHILD_ID_KEY = 'selected_child_id';

export const DEFAULT_PARTNER_ID = '1';

export function getCurrentChildId() {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(CURRENT_CHILD_ID_KEY) || '';
  } catch (err) {
    return '';
  }
}

export function setCurrentChildId(childId) {
  if (typeof window === 'undefined') return;
  try {
    if (childId) {
      window.localStorage.setItem(CURRENT_CHILD_ID_KEY, String(childId));
    } else {
      window.localStorage.removeItem(CURRENT_CHILD_ID_KEY);
    }
  } catch (err) {
    // Keep rendering even when storage is unavailable.
  }
}

export function getPartner(partnerMonsterId) {
  const pet = getPetMasterByAnyId(partnerMonsterId || DEFAULT_PARTNER_ID);
  return {
    id: String(pet.catalogId || partnerMonsterId || DEFAULT_PARTNER_ID),
    petId: pet.id,
    name: pet.nameJa,
    imageUrl: pet.image,
  };
}
