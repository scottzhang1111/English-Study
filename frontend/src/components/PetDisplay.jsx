import { useEffect, useRef, useState } from 'react';
import { decoratePet } from '../lib/petMaster';

function getPetImageUrl(pet) {
  return pet?.image_url || pet?.sprite_url || pet?.imageUrl || pet?.master?.image || '';
}

function getPetDisplayName(pet) {
  const nicknameIsChildName = pet?.child_name && pet?.name === pet.child_name;
  return (!nicknameIsChildName ? pet?.name : '') || pet?.nameJa || pet?.master?.nameJa || '';
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
  const [petClassName, setPetClassName] = useState('');
  const petTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (petTimerRef.current) {
        window.clearTimeout(petTimerRef.current);
      }
    };
  }, []);

  const handlePoke = () => {
    if (!enableEffects) return;
    if (petTimerRef.current) {
      window.clearTimeout(petTimerRef.current);
    }
    setPetClassName('is-jumping');
    petTimerRef.current = window.setTimeout(() => {
      setPetClassName('');
      petTimerRef.current = null;
    }, 500);
  };

  if (!pet) {
    return (
      <div className={`flex h-full min-h-[360px] items-center justify-center rounded-[40px] bg-white/82 p-6 text-center text-sm text-[#6f7da8] shadow-[0_22px_50px_rgba(145,177,209,0.22)] ${className}`}>
        ペットを準備中です。
      </div>
    );
  }

  const displayPet = decoratePet(pet);
  const imageUrl = getPetImageUrl(displayPet);
  const petName = getPetDisplayName(displayPet);
  const maxExp = Number(displayPet.max_exp || 100);
  const currentExp = Number(displayPet.exp || 0);
  const progress = Math.min(100, (currentExp / Math.max(1, maxExp)) * 100);

  return (
    <div className={`rounded-[28px] bg-[linear-gradient(180deg,rgba(239,248,255,0.74)_0%,rgba(247,252,255,0.46)_100%)] p-3 shadow-[0_18px_40px_rgba(145,177,209,0.16)] md:rounded-[40px] md:p-6 md:shadow-[0_24px_56px_rgba(145,177,209,0.18)] ${className}`}>
      <div className={`flex ${compact ? 'flex-row gap-4' : 'flex-col items-center text-center'}`}>
        <div className={`relative ${compact ? 'shrink-0' : 'mx-auto'}`}>
          <div
            className={`flex shrink-0 items-center justify-center rounded-full border border-sky-100/40 bg-transparent shadow-[0_22px_48px_rgba(73,109,156,0.14)] ${
              compact ? 'h-24 w-24 md:h-[180px] md:w-[180px]' : 'h-32 w-32 md:h-[220px] md:w-[220px] xl:h-[280px] xl:w-[280px]'
            } ${enableEffects && !compact ? `pet-aura-ring cursor-pointer overflow-visible ${petClassName}` : 'overflow-hidden'}`}
            onClick={handlePoke}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={petName || 'ペット'}
                className={compact ? 'h-24 w-24 bg-transparent object-contain md:h-[180px] md:w-[180px]' : 'h-32 w-32 bg-transparent object-contain md:h-[220px] md:w-[220px] xl:h-[250px] xl:w-[250px]'}
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-4xl font-black text-[#354172]">
                {displayPet.emoji || 'P'}
              </div>
            )}
          </div>
        </div>

        <div className={compact ? 'min-w-0 flex-1' : 'mt-5 w-full'}>
          <div className={`flex ${compact ? 'items-start justify-between gap-3' : 'flex-col items-center'}`}>
            {petName && (
              <p className="display-font truncate text-xl font-extrabold text-[#354172] md:text-3xl">{petName}</p>
            )}
            {earnedExp > 0 && (
              <span
                className={`inline-flex rounded-full bg-[#fff2bb] px-3 py-1 text-xs font-extrabold text-[#6b5a2d] ${
                  compact ? 'shrink-0' : 'mt-3'
                }`}
              >
                +{earnedExp} EXP
              </span>
            )}
          </div>

          {!compact && (
            <div className="mx-auto mt-3 max-w-[240px] rounded-full bg-[#f3f7ff] px-3 py-2 text-xs font-bold leading-5 text-[#51688f] shadow-[0_10px_24px_rgba(145,177,209,0.14)] md:mt-4 md:px-4 md:text-sm">
              {bubbleText}
            </div>
          )}

          {showDetails && (
            <>
              <div className={`mt-5 grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
                <div className="rounded-[26px] bg-[#f8fbff] px-4 py-3">
                  <p className="text-xs font-bold text-[#94a2c5]">レベル</p>
                  <p className="mt-1 text-lg font-extrabold text-[#354172]">{displayPet.level}</p>
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
                {displayPet.total_exp !== undefined && (
                  <p className="mt-3 text-xs font-bold text-[#94a2c5]">合計 EXP {displayPet.total_exp}</p>
                )}
              </div>

              {displayPet.collection_owned !== undefined && displayPet.collection_total !== undefined && (
                <div className="mt-4 rounded-[26px] bg-[#f8fbff] px-4 py-3">
                  <div className="flex items-center justify-between gap-3 text-sm font-bold text-[#6f7da8]">
                    <span>コレクション</span>
                    <span>
                      {displayPet.collection_owned} / {displayPet.collection_total}
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e6f4ff]">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#7bdcff,#4c9dff)] transition-all duration-300"
                      style={{ width: `${displayPet.collection_progress || 0}%` }}
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


