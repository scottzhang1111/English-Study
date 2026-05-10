import { useEffect, useRef, useState } from 'react';

function getPokemonImageUrl(pet) {
  const directImage = pet?.image_url || pet?.sprite_url;
  const artwork = pet?.pokemon?.sprites?.other?.['official-artwork']?.front_default;
  const sprite = pet?.pokemon?.sprites?.front_default;
  const pokemonId = pet?.pokemon?.id || pet?.pokemon_id || pet?.id;
  const fallbackArtwork = pokemonId
    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemonId}.png`
    : '';
  const fallbackSprite = pokemonId
    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`
    : '';
  return directImage || artwork || sprite || fallbackArtwork || fallbackSprite || '';
}

function getPokemonDisplayName(pet) {
  const fallbackNames = {
    1: 'フシギダネ',
    2: 'フシギソウ',
    3: 'フシギバナ',
    4: 'ヒトカゲ',
    5: 'リザード',
    6: 'リザードン',
    7: 'ゼニガメ',
    8: 'カメール',
    9: 'カメックス',
    25: 'ピカチュウ',
  };
  const pokemonId = Number(pet?.pokemon?.id || pet?.pokemon_id || pet?.id || 0);
  const nicknameIsChildName = pet?.child_name && pet?.name === pet.child_name;
  return (
    pet?.pokemon?.name_jp ||
    pet?.pokemon?.pokemon_name ||
    pet?.pokemon?.species_name ||
    pet?.pokemon?.name ||
    fallbackNames[pokemonId] ||
    (!nicknameIsChildName ? pet?.name : '') ||
    pet?.pokemon_name ||
    pet?.species_name ||
    (pokemonId ? `No. ${pokemonId}` : '')
  );
}

export default function PetDisplay({
  pet,
  earnedExp = 0,
  compact = false,
  className = '',
  showDetails = true,
  enableEffects = false,
  bubbleText = '今日もいっしょにがんばろう。',
}) {
  const [pokeClassName, setPokeClassName] = useState('');
  const pokeTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pokeTimerRef.current) {
        window.clearTimeout(pokeTimerRef.current);
      }
    };
  }, []);

  const handlePoke = () => {
    if (!enableEffects) return;
    if (pokeTimerRef.current) {
      window.clearTimeout(pokeTimerRef.current);
    }
    setPokeClassName('is-jumping');
    pokeTimerRef.current = window.setTimeout(() => {
      setPokeClassName('');
      pokeTimerRef.current = null;
    }, 500);
  };

  if (!pet) {
    return (
      <div className={`flex h-full min-h-[360px] items-center justify-center rounded-[40px] bg-white/82 p-6 text-center text-sm text-[#6f7da8] shadow-[0_22px_50px_rgba(145,177,209,0.22)] ${className}`}>
        ポケモンを準備中です。
      </div>
    );
  }

  const imageUrl = getPokemonImageUrl(pet);
  const pokemonName = getPokemonDisplayName(pet);
  const maxExp = Number(pet.max_exp || 100);
  const currentExp = Number(pet.exp || 0);
  const progress = Math.min(100, (currentExp / Math.max(1, maxExp)) * 100);

  return (
    <div className={`rounded-[40px] bg-white/86 p-6 shadow-[0_24px_56px_rgba(145,177,209,0.22)] ${className}`}>
      <div className={`flex ${compact ? 'flex-row gap-4' : 'flex-col items-center text-center'}`}>
        <div className={`relative ${compact ? 'shrink-0' : 'mx-auto'}`}>
          <div
            className={`flex shrink-0 items-center justify-center rounded-[34px] border border-white/80 bg-[#eef8ff] shadow-[0_22px_48px_rgba(73,109,156,0.18)] ${
              compact ? 'h-28 w-28' : 'h-64 w-64'
            } ${enableEffects && !compact ? `pokemon-aura-ring cursor-pointer overflow-visible ${pokeClassName}` : 'overflow-hidden'}`}
            onClick={handlePoke}
          >
            {imageUrl ? (
                <img src={imageUrl} alt={pokemonName || 'ポケモン'} className="h-full w-full object-contain p-2.5" loading="lazy" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-4xl font-black text-[#354172]">
                {pet.emoji || 'P'}
              </div>
            )}
          </div>
        </div>

        <div className={compact ? 'min-w-0 flex-1' : 'mt-5 w-full'}>
          <div className={`flex ${compact ? 'items-start justify-between gap-3' : 'flex-col items-center'}`}>
            {pokemonName && (
              <p className="display-font truncate text-3xl font-extrabold text-[#354172]">{pokemonName}</p>
            )}
            {earnedExp > 0 && (
              <span
                className={`inline-flex rounded-full bg-[#fff2bb] px-3 py-1 text-xs font-extrabold text-[#6b5a2d] ${
                  compact ? 'shrink-0' : 'mt-3'
                }`}
              >
                +{earnedExp} XP
              </span>
            )}
          </div>

          {!compact && (
            <div className="mx-auto mt-4 max-w-[240px] rounded-full bg-[#f3f7ff] px-4 py-2 text-sm font-bold text-[#51688f] shadow-[0_10px_24px_rgba(145,177,209,0.14)]">
              {bubbleText}
            </div>
          )}

          {showDetails && (
            <>
              <div className={`mt-5 grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
                <div className="rounded-[26px] bg-[#f8fbff] px-4 py-3">
                  <p className="text-xs font-bold text-[#94a2c5]">レベル</p>
                  <p className="mt-1 text-lg font-extrabold text-[#354172]">{pet.level}</p>
                </div>
                <div className="rounded-[26px] bg-[#f8fbff] px-4 py-3">
                  <p className="text-xs font-bold text-[#94a2c5]">EXP</p>
                  <p className="mt-1 text-lg font-extrabold text-[#354172]">
                    {currentExp} / {maxExp}
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-[26px] bg-[#f8fbff] px-4 py-4">
                <div className="flex items-center justify-between gap-3 text-sm font-bold text-[#6f7da8]">
                  <span>EXP</span>
                  <span>
                    {currentExp} / {maxExp}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e6f4ff]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#bdefff,#83d7ff)] transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {pet.total_exp !== undefined && (
                  <p className="mt-3 text-xs font-bold text-[#94a2c5]">合計 XP {pet.total_exp}</p>
                )}
              </div>

              {pet.collection_owned !== undefined && pet.collection_total !== undefined && (
                <div className="mt-4 rounded-[26px] bg-[#f8fbff] px-4 py-3">
                  <div className="flex items-center justify-between gap-3 text-sm font-bold text-[#6f7da8]">
                    <span>コレクション</span>
                    <span>
                      {pet.collection_owned} / {pet.collection_total}
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e6f4ff]">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#7bdcff,#4c9dff)] transition-all duration-300"
                      style={{ width: `${pet.collection_progress || 0}%` }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
