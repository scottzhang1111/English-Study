import { useEffect, useMemo, useRef, useState } from 'react';
import HeaderBar from '../components/HeaderBar';
import { getBattleMonsters, getPetsData } from '../api';

const CHILD_STORAGE_KEY = 'selected_child_id';

function getPokemonImage(pet) {
  return pet?.image_url || pet?.sprite_url || '';
}

function getStatusLabel(pet) {
  if (!pet?.unlocked) return '未解放';
  if (pet.is_master || pet.status === 'master') return '已满级';
  if (pet.status === 'ready') return '可以进化';
  return '成长中';
}

function getUnlockText(pet, fallbackExp) {
  const exp = pet?.unlock_exp_remaining ?? fallbackExp;
  if (exp === null || exp === undefined) return '学習で解放';
  return `あと ${exp} EXP で解放`;
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
  const [totalCount, setTotalCount] = useState(151);
  const [detailPet, setDetailPet] = useState(null);
  const [battleMonsters, setBattleMonsters] = useState([]);
  const [battleDetail, setBattleDetail] = useState(null);
  const [pokeClassName, setPokeClassName] = useState('');
  const [error, setError] = useState(null);
  const pokeTimerRef = useRef(null);
  const childId = useMemo(() => localStorage.getItem(CHILD_STORAGE_KEY) || '', []);

  useEffect(() => {
    getPetsData(childId)
      .then((data) => {
        const nextPets = data.pets || [];
        const firstUnlocked = nextPets.find((pet) => pet.unlocked) || null;
        setPets(nextPets);
        setChild(data.child || null);
        setRewardStatus(data.reward_status || null);
        setCurrentPet(data.current_pet || firstUnlocked);
        setOwnedCount(data.owned_count || nextPets.filter((pet) => pet.unlocked).length);
        setTotalCount(data.total_count || 151);
      })
      .catch((err) => setError(err.message));
    getBattleMonsters(childId)
      .then((data) => setBattleMonsters(data.monsters || []))
      .catch((err) => setError(err.message));
  }, [childId]);

  useEffect(() => {
    return () => {
      if (pokeTimerRef.current) {
        window.clearTimeout(pokeTimerRef.current);
      }
    };
  }, []);

  const todayPercent = rewardStatus?.today_progress_percent || 0;
  const nextUnlockExp = rewardStatus?.next_unlock_exp;
  const currentImage = getPokemonImage(currentPet);

  const handlePoke = () => {
    if (pokeTimerRef.current) {
      window.clearTimeout(pokeTimerRef.current);
    }
    setPokeClassName('is-jumping');
    pokeTimerRef.current = window.setTimeout(() => {
      setPokeClassName('');
      pokeTimerRef.current = null;
    }, 500);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-32 pt-6 sm:px-6">
      <HeaderBar subtitle="Pokémon list" />
      {error && <div className="panel mb-4 p-5 text-sm text-rose-700">{error}</div>}

      <section className="mb-5 rounded-[36px] border border-white/80 bg-[linear-gradient(180deg,#eef8ff_0%,#fffdf7_100%)] px-5 py-5 shadow-[0_18px_44px_rgba(145,177,209,0.14)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black text-[#8fa0c2]">学習モンスター図鑑</p>
            <h2 className="display-font mt-1 text-2xl font-extrabold text-[#354172]">文法バトルで出会った仲間</h2>
          </div>
          <p className="text-sm font-bold text-[#6f7da8]">
            {battleMonsters.filter((monster) => monster.captured).length} / {battleMonsters.length} つかまえた
          </p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {battleMonsters.map((monster) => (
            <button
              key={monster.id}
              type="button"
              onClick={() => monster.captured && setBattleDetail(monster)}
              className={`rounded-[24px] border p-3 text-center shadow-[0_10px_24px_rgba(145,177,209,0.10)] transition hover:-translate-y-0.5 ${
                monster.captured ? 'border-white/80 bg-white/92' : 'border-[#dce5f1] bg-[#f0f3f8]'
              }`}
            >
              <div className={`mx-auto flex h-24 w-24 items-center justify-center rounded-[20px] ${monster.captured ? 'bg-[#fff8d9]' : 'bg-[#dfe5ee]'}`}>
                {monster.imageUrl ? (
                  <img
                    src={monster.imageUrl}
                    alt={monster.nameJa}
                    className={`h-full w-full object-contain p-2 ${monster.captured ? '' : 'grayscale opacity-35'}`}
                    loading="lazy"
                  />
                ) : (
                  <span className="text-3xl font-black text-[#9aa8c7]">?</span>
                )}
              </div>
              <p className="mt-2 truncate text-sm font-black text-[#354172]">{monster.captured ? monster.nameJa : '???'}</p>
              <p className="mt-1 text-xs font-bold text-[#6f7da8]">{monster.grammarCategory}</p>
              <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-[11px] font-black ${monster.captured ? 'bg-[#eefbf1] text-[#2f6b42]' : 'bg-white/70 text-[#7b8ba8]'}`}>
                {monster.captured ? 'captured' : 'not captured'}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[36px] border border-white/80 bg-[linear-gradient(180deg,#fffdf7_0%,#eef8ff_100%)] px-5 py-5 shadow-[0_18px_44px_rgba(145,177,209,0.16)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex rounded-full bg-[#fff7d6] px-4 py-2 text-sm font-black text-[#6b5a2d]">
              学習すると Pokémon が育つよ
            </div>
            <h2 className="display-font mt-3 text-2xl font-extrabold text-[#354172]">
              {child ? `${child.name} のごほうび` : 'ごほうび'}
            </h2>
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
            <div className="pokemon-aura-ring mx-auto flex h-64 w-64 max-w-full items-center justify-center overflow-visible rounded-[28px] bg-[radial-gradient(circle_at_50%_40%,#fff7d6_0%,#e9f8ff_62%,#dcefff_100%)]">
              {currentPet && currentImage ? (
                <img
                  src={currentImage}
                  alt={currentPet.name}
                  onClick={handlePoke}
                  className={`animate-breathe h-full w-full cursor-pointer object-contain p-3.5 drop-shadow-[0_12px_12px_rgba(86,106,144,0.20)] ${pokeClassName}`}
                />
              ) : (
                <span className="text-4xl font-black text-[#9aa8c7]">?</span>
              )}
            </div>
            <p className="display-font mt-3 truncate text-2xl font-extrabold text-[#354172]">
              {currentPet?.name || 'Pokémon'}
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-full bg-[#eef8ff] px-3 py-1.5 text-xs font-black text-[#51688f]">
                Lv. {currentPet?.level ?? 1}
              </span>
              <span className="rounded-full bg-[#fff7d6] px-3 py-1.5 text-xs font-black text-[#6b5a2d]">
                {getStatusLabel(currentPet)}
              </span>
              {currentPet?.is_master && (
                <span className="rounded-full bg-[#ffe66b] px-3 py-1.5 text-xs font-black text-[#6b5a2d]">
                  MASTER
                </span>
              )}
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
                {rewardStatus?.has_locked_pokemon ? `あと ${nextUnlockExp ?? 0} EXP で新しい Pokémon` : 'すべて解放しました'}
              </p>
            </div>
          </article>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="display-font text-xl font-extrabold text-[#354172]">Pokémon コレクション</h3>
            </div>
            <div className="grid grid-cols-3 gap-2.5 md:grid-cols-4 xl:grid-cols-5">
              {pets.map((pet) => {
                const imageUrl = getPokemonImage(pet);
                return (
                  <button
                    key={pet.pokemon_id}
                    type="button"
                    onClick={() => setDetailPet(pet)}
                    className={`min-w-0 rounded-[22px] border p-2.5 text-center shadow-[0_10px_24px_rgba(145,177,209,0.10)] transition duration-200 hover:-translate-y-0.5 ${
                      pet.unlocked ? 'border-white/80 bg-white/92' : 'border-[#dce5f1] bg-[#f0f3f8]'
                    }`}
                  >
                    <div className={`relative mx-auto flex h-20 w-20 items-center justify-center rounded-[18px] ${pet.unlocked ? 'bg-[#eef8ff]' : 'bg-[#dfe5ee]'}`}>
                      {pet.unlocked && imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={pet.name}
                          className={`h-full w-full object-contain p-2 ${pet.unlocked ? '' : 'grayscale'}`}
                          loading="lazy"
                        />
                      ) : (
                        <>
                          <span className="text-2xl font-black text-[#9aa8c7]">???</span>
                          <span className="absolute right-2 top-2 rounded-full bg-white/90 px-1.5 py-0.5 text-xs font-black text-[#7b8ba8]">🔒</span>
                        </>
                      )}
                    </div>
                    <p className="mt-2 truncate text-xs font-black text-[#354172]">{pet.unlocked ? pet.name : '???'}</p>
                    <p className="mt-1 truncate text-[11px] font-bold text-[#6f7da8]">{pet.unlocked ? `Lv. ${pet.level}` : getUnlockText(pet, nextUnlockExp)}</p>
                    {pet.is_master && (
                      <span className="mt-2 inline-flex rounded-full bg-[#ffe66b] px-2.5 py-1 text-[10px] font-black text-[#6b5a2d]">
                        MASTER
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {detailPet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#203047]/45 px-4 py-8" onClick={() => setDetailPet(null)}>
          <div className="w-full max-w-sm rounded-[34px] bg-white p-5 shadow-[0_24px_70px_rgba(32,48,71,0.28)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-[#eef8ff] px-3 py-1 text-xs font-black text-[#6f7da8]">
                No. {String(detailPet.pokemon_id).padStart(3, '0')}
              </span>
              <button type="button" onClick={() => setDetailPet(null)} className="rounded-full bg-[#f3f7ff] px-4 py-2 text-sm font-black text-[#6f7da8]">
                閉じる
              </button>
            </div>
            <div className="mt-5 flex aspect-square items-center justify-center rounded-[30px] bg-[radial-gradient(circle_at_50%_40%,#fff7d6_0%,#e9f8ff_62%,#dcefff_100%)]">
              {detailPet.unlocked && getPokemonImage(detailPet) ? (
                <img src={getPokemonImage(detailPet)} alt={detailPet.name} className="h-full w-full object-contain p-6" />
              ) : (
                <span className="text-4xl font-black text-[#9aa8c7]">???</span>
              )}
            </div>
            <div className="mt-5 text-center">
              <p className="display-font truncate text-2xl font-extrabold text-[#354172]">{detailPet.unlocked ? detailPet.name : '???'}</p>
              <p className="mt-2 text-sm font-black text-[#6f7da8]">
                {detailPet.unlocked ? `Lv. ${detailPet.level}` : getUnlockText(detailPet, nextUnlockExp)}
              </p>
            </div>
            {detailPet.unlocked && (
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
            <div className="mt-4 flex aspect-square items-center justify-center rounded-[30px] bg-[radial-gradient(circle_at_50%_40%,#fff7d6_0%,#e9f8ff_62%,#dcefff_100%)]">
              <img src={battleDetail.imageUrl} alt={battleDetail.nameJa} className="h-full w-full object-contain p-6" />
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
