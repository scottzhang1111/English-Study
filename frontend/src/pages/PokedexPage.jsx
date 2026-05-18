import { useEffect, useMemo, useRef, useState } from 'react';
import HeaderBar from '../components/HeaderBar';
import { getBattleMonsters, getPetsData } from '../api';

const CHILD_STORAGE_KEY = 'selected_child_id';

const DEFAULT_PETS = [
  { pokemon_id: 1, pet_id: 'AIR_RABBIT1', name: 'そらうさぎ', level: 1, exp: 0, max_exp: 100, exp_progress: 0, total_exp: 0, unlocked: true, image_url: '/assets/pets/air/AIR_RABBIT1.png' },
];

const DEFAULT_BATTLE_MONSTERS = [
  { id: 'comparison_cat', nameJa: 'くらべキャット', imageUrl: '/assets/pets/elec/ELEC_CAT1.png', grammarCategory: 'comparison', captured: true, level: 1, exp: 0, grammarTip: '比較のポイントを確認しよう。' },
];

function getPetImage(pet) {
  return pet?.image_url || pet?.sprite_url || pet?.imageUrl || '';
}

function isPetCollected(pet) {
  return Boolean(pet?.unlocked || pet?.isUnlocked || pet?.owned || pet?.collected || pet?.acquiredAt);
}

function getSafeLevel(pet) {
  const level = Number(pet?.level);
  return Number.isFinite(level) && level > 0 ? level : 1;
}

function getStatusLabel(pet) {
  if (!isPetCollected(pet)) return '未解放';
  if (pet.is_master || pet.status === 'master') return '成長完了';
  if (pet.status === 'ready') return '進化まち';
  return '成長中';
}

function getUnlockText(pet, fallbackExp) {
  const exp = pet?.unlock_exp_remaining ?? fallbackExp;
  if (exp === null || exp === undefined) return '学習で解放';
  return `あと ${exp} EXP`;
}

function ExpBar({ value = 0, tone = 'yellow' }) {
  const color = tone === 'blue' ? 'bg-[#7dd6ff]' : 'bg-[linear-gradient(90deg,#ffe66b,#ffbf2f)]';
  return (
    <div className="h-3 overflow-hidden rounded-full bg-white/70 shadow-[inset_0_1px_3px_rgba(96,110,140,0.14)]">
      <div className={`h-full rounded-full ${color} transition-all duration-300`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

export default function PokedexPage() {
  const [pets, setPets] = useState([]);
  const [child, setChild] = useState(null);
  const [rewardStatus, setRewardStatus] = useState(null);
  const [currentPet, setCurrentPet] = useState(null);
  const [ownedCount, setOwnedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(24);
  const [detailPet, setDetailPet] = useState(null);
  const [battleMonsters, setBattleMonsters] = useState([]);
  const [battleDetail, setBattleDetail] = useState(null);
  const [petClassName, setPetClassName] = useState('');
  const [error, setError] = useState(null);
  const petTimerRef = useRef(null);
  const childId = useMemo(() => localStorage.getItem(CHILD_STORAGE_KEY) || '', []);

  useEffect(() => {
    getPetsData(childId)
      .then((data) => {
        const nextPets = data.pets || [];
        const firstUnlocked = nextPets.find(isPetCollected) || null;
        setPets(nextPets);
        setChild(data.child || null);
        setRewardStatus(data.reward_status || null);
        setCurrentPet(data.current_pet || firstUnlocked);
        setOwnedCount(data.owned_count ?? nextPets.filter(isPetCollected).length);
        setTotalCount(data.total_count ?? (nextPets.length || 24));
      })
      .catch((err) => {
        setError(err.message);
        setPets(DEFAULT_PETS);
        setCurrentPet(DEFAULT_PETS[0]);
        setOwnedCount(DEFAULT_PETS.length);
        setTotalCount(24);
        setRewardStatus({ today_progress: 0, today_target: 20, today_progress_percent: 0, next_unlock_exp: 20, has_locked_pokemon: true });
      });
    getBattleMonsters(childId)
      .then((data) => setBattleMonsters(data.monsters || []))
      .catch((err) => {
        setError(err.message);
        setBattleMonsters(DEFAULT_BATTLE_MONSTERS);
      });
  }, [childId]);

  useEffect(() => {
    return () => {
      if (petTimerRef.current) {
        window.clearTimeout(petTimerRef.current);
      }
    };
  }, []);

  const todayPercent = rewardStatus?.today_progress_percent || 0;
  const nextUnlockExp = rewardStatus?.next_unlock_exp;
  const currentImage = getPetImage(currentPet);
  const collectedPets = pets.filter(isPetCollected);
  const uncollectedPets = pets.filter((pet) => !isPetCollected(pet));

  const handlePoke = () => {
    if (petTimerRef.current) {
      window.clearTimeout(petTimerRef.current);
    }
    setPetClassName('is-jumping');
    petTimerRef.current = window.setTimeout(() => {
      setPetClassName('');
      petTimerRef.current = null;
    }, 500);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-32 pt-6 sm:px-6">
      <HeaderBar subtitle="ペットコレクション" />
      {error && <div className="mb-4 rounded-[24px] bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700">{error}</div>}

      <section className="rounded-[36px] border border-white/80 bg-[linear-gradient(180deg,#fffdf7_0%,#eef8ff_100%)] px-5 py-5 shadow-[0_18px_44px_rgba(145,177,209,0.16)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex rounded-full bg-[#fff7d6] px-4 py-2 text-sm font-black text-[#6b5a2d]">
              学習するとペットが育つよ
            </div>
            <h2 className="display-font mt-3 text-2xl font-extrabold text-[#354172]">
              ペット図鑑
            </h2>
            <p className="mt-2 text-sm font-bold text-[#6f7da8]">{child ? `${child.name} の仲間を見てみよう` : '集めた仲間を見てみよう'}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
            <div className="rounded-[24px] bg-white/88 p-4 shadow-[0_10px_24px_rgba(145,177,209,0.12)]">
              <p className="text-xs font-black text-[#8fa0c2]">今日の学習</p>
              <p className="mt-1 text-xl font-extrabold text-[#354172]">
                {rewardStatus?.today_progress ?? 0} / {rewardStatus?.today_target ?? 0}
              </p>
              <div className="mt-2">
                <ExpBar value={todayPercent} tone="blue" />
              </div>
            </div>
            <div className="rounded-[24px] bg-white/88 p-4 shadow-[0_10px_24px_rgba(145,177,209,0.12)]">
              <p className="text-xs font-black text-[#8fa0c2]">持っている数</p>
              <p className="mt-1 text-xl font-extrabold text-[#354172]">
                {ownedCount} / {totalCount}
              </p>
            </div>
            <div className="rounded-[24px] bg-white/88 p-4 shadow-[0_10px_24px_rgba(145,177,209,0.12)]">
              <p className="text-xs font-black text-[#8fa0c2]">次の解放</p>
              <p className="mt-1 text-xl font-extrabold text-[#354172]">
                {nextUnlockExp === 0 ? 'もうすぐ!' : `${nextUnlockExp ?? 0} EXP`}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <article className="rounded-[30px] border border-white/80 bg-white/90 p-4 text-center shadow-[0_16px_36px_rgba(145,177,209,0.14)]">
            <div className="pet-aura-ring mx-auto flex h-[280px] w-[280px] max-w-full items-center justify-center overflow-visible rounded-[28px] bg-[radial-gradient(circle_at_50%_40%,#fff7d6_0%,#e9f8ff_62%,#dcefff_100%)]">
              {currentPet && currentImage ? (
                <img
                  src={currentImage}
                  alt={currentPet.name}
                  onClick={handlePoke}
                  className={`animate-breathe h-[250px] w-[250px] max-w-full cursor-pointer object-contain drop-shadow-[0_12px_12px_rgba(86,106,144,0.20)] ${petClassName}`}
                />
              ) : (
                <span className="text-4xl font-black text-[#9aa8c7]">?</span>
              )}
            </div>
            <p className="display-font mt-3 truncate text-2xl font-extrabold text-[#354172]">
              {currentPet?.name || 'ペット'}
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-full bg-[#eef8ff] px-3 py-1.5 text-xs font-black text-[#51688f]">
                Lv. {getSafeLevel(currentPet)}
              </span>
              <span className="rounded-full bg-[#fff7d6] px-3 py-1.5 text-xs font-black text-[#6b5a2d]">
                {getStatusLabel(currentPet)}
              </span>
            </div>
            <div className="mt-4 text-left">
              <div className="mb-2 flex items-center justify-between text-xs font-black text-[#6f7da8]">
                <span>EXP</span>
                <span>
                  {currentPet?.exp ?? 0} / {currentPet?.max_exp ?? 100}
                </span>
              </div>
              <ExpBar value={currentPet?.exp_progress || 0} />
              <p className="mt-3 text-center text-sm font-bold text-[#6f7da8]">
                {rewardStatus?.has_locked_pokemon ? `あと ${nextUnlockExp ?? 0} EXP で新しいペット` : 'すべて解放しました'}
              </p>
            </div>
          </article>

          <div className="space-y-6">
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="display-font text-xl font-extrabold text-[#354172]">持っているペット</h3>
              </div>
              {collectedPets.length === 0 && (
                <div className="rounded-[24px] bg-white/82 px-4 py-5 text-sm font-bold text-[#6f7da8]">
                  まだペットはいません。学習すると仲間に出会えるよ！
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
                {collectedPets.map((pet) => {
                  const imageUrl = getPetImage(pet);
                  return (
                    <button
                      key={pet.pet_id || pet.pokemon_id}
                      type="button"
                      onClick={() => setDetailPet(pet)}
                      className="min-w-0 rounded-[22px] border border-white/80 bg-white/92 p-3 text-center shadow-[0_10px_24px_rgba(145,177,209,0.10)] transition duration-200 hover:-translate-y-0.5"
                    >
                      <div className="relative mx-auto flex h-28 w-full items-center justify-center rounded-[18px] bg-[#eef8ff] md:h-32">
                        {imageUrl ? (
                          <img src={imageUrl} alt={pet.name} className="h-24 w-24 object-contain md:h-28 md:w-28" loading="lazy" />
                        ) : (
                          <span className="text-2xl font-black text-[#9aa8c7]">?</span>
                        )}
                      </div>
                      <p className="mt-2 truncate text-sm font-black text-[#354172]">{pet.name}</p>
                      <p className="mt-1 truncate text-xs font-bold text-[#6f7da8]">Lv. {getSafeLevel(pet)}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="display-font text-xl font-extrabold text-[#354172]">まだ見つけていない仲間</h3>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
              {uncollectedPets.map((pet) => {
                const imageUrl = getPetImage(pet);
                return (
                  <button
                    key={pet.pet_id || pet.pokemon_id}
                    type="button"
                    onClick={() => setDetailPet(pet)}
                    className="min-w-0 rounded-[22px] border border-[#dce5f1] bg-[#f0f3f8] p-3 text-center shadow-[0_10px_24px_rgba(145,177,209,0.10)] transition duration-200 hover:-translate-y-0.5"
                  >
                    <div className="relative mx-auto flex h-28 w-full items-center justify-center rounded-[18px] bg-[#dfe5ee] md:h-32">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt=""
                          className="h-24 w-24 object-contain grayscale brightness-0 opacity-30 md:h-28 md:w-28"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-3xl font-black text-[#9aa8c7]">?</span>
                      )}
                      <span className="absolute right-2 top-2 rounded-full bg-white/82 px-2 py-1 text-xs font-black text-[#8fa0c2]">?</span>
                    </div>
                    <p className="mt-2 truncate text-sm font-black text-[#354172]">???</p>
                    <p className="mt-1 truncate text-xs font-bold text-[#6f7da8]">まだ見つけていない</p>
                  </button>
                );
              })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {detailPet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#203047]/45 px-4 py-8" onClick={() => setDetailPet(null)}>
          <div className="w-full max-w-sm rounded-[34px] bg-white p-5 shadow-[0_24px_70px_rgba(32,48,71,0.28)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-end">
              <button type="button" onClick={() => setDetailPet(null)} className="rounded-full bg-[#f3f7ff] px-4 py-2 text-sm font-black text-[#6f7da8]">
                閉じる
              </button>
            </div>
            <div className="mt-5 flex h-[280px] w-full items-center justify-center rounded-[30px] bg-[radial-gradient(circle_at_50%_40%,#fff7d6_0%,#e9f8ff_62%,#dcefff_100%)]">
              {isPetCollected(detailPet) && getPetImage(detailPet) ? (
                <img src={getPetImage(detailPet)} alt={detailPet.name} className="h-[250px] w-[250px] max-w-full object-contain" />
              ) : getPetImage(detailPet) ? (
                <img src={getPetImage(detailPet)} alt="" className="h-[250px] w-[250px] max-w-full object-contain grayscale brightness-0 opacity-30" />
              ) : (
                <span className="text-4xl font-black text-[#9aa8c7]">???</span>
              )}
            </div>
            <div className="mt-5 text-center">
              <p className="display-font truncate text-2xl font-extrabold text-[#354172]">{isPetCollected(detailPet) ? detailPet.name : '???'}</p>
              <p className="mt-2 text-sm font-black text-[#6f7da8]">
                {isPetCollected(detailPet) ? `Lv. ${getSafeLevel(detailPet)}` : 'まだ見つけていない'}
              </p>
            </div>
            {isPetCollected(detailPet) && (
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-xs font-black text-[#6f7da8]">
                  <span>EXP</span>
                  <span>
                    {detailPet.exp ?? 0} / {detailPet.max_exp ?? 100}
                  </span>
                </div>
                <ExpBar value={detailPet.exp_progress || 0} />
                <p className="mt-3 rounded-[22px] bg-[#f8fbff] px-4 py-3 text-center text-sm font-bold text-[#6f7da8]">
                  学習で集めた EXP: {detailPet.total_exp ?? 0}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {battleDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#203047]/45 px-4 py-8" onClick={() => setBattleDetail(null)}>
          <div className="w-full max-w-sm rounded-[34px] bg-white p-5 shadow-[0_24px_70px_rgba(32,48,71,0.28)]" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setBattleDetail(null)} className="ml-auto block rounded-full bg-[#f3f7ff] px-4 py-2 text-sm font-black text-[#6f7da8]">
              閉じる
            </button>
            <div className="mt-4 flex h-[280px] w-full items-center justify-center rounded-[30px] bg-[radial-gradient(circle_at_50%_40%,#fff7d6_0%,#e9f8ff_62%,#dcefff_100%)]">
              <img src={battleDetail.imageUrl} alt={battleDetail.nameJa} className="h-[250px] w-[250px] max-w-full object-contain" />
            </div>
            <div className="mt-5 text-center">
              <p className="display-font text-2xl font-extrabold text-[#354172]">{battleDetail.nameJa}</p>
              <p className="mt-2 text-sm font-black text-[#6f7da8]">Lv. {battleDetail.level ?? 1} / EXP {battleDetail.exp ?? 0}</p>
            </div>
            <p className="mt-4 rounded-[22px] bg-[#fff8d9] px-4 py-3 text-sm font-bold leading-6 text-[#6b5a2d]">
              {battleDetail.grammarTip}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}


