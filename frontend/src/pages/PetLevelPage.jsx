import { useEffect, useState } from 'react';
import HeaderBar from '../components/HeaderBar';
import { getPetLevelData } from '../api';

export default function PetLevelPage() {
  const [pet, setPet] = useState(null);
  const [error, setError] = useState(null);
  const maxExp = pet?.max_exp || 100;
  const progress = pet ? Math.min(100, Math.round((pet.exp / maxExp) * 100)) : 0;

  useEffect(() => {
    getPetLevelData()
      .then((data) => setPet(data.pet))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-32 pt-6 sm:px-6">
      <HeaderBar subtitle="ペットレベル" />
      <section className="panel px-6 py-6">
        {error && <div className="mb-5 rounded-[24px] bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
        <div className="flex items-center gap-4 rounded-[28px] bg-[linear-gradient(180deg,#eef8ff_0%,#e3f3ff_100%)] p-5">
          <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-white text-2xl font-black text-[#354172]">
            {pet?.emoji || 'EV'}
          </div>
          <div>
            <p className="text-sm font-bold text-[#6f7da8]">ペット</p>
            <p className="display-font text-2xl font-extrabold text-[#354172]">{pet?.name || '読み込み中...'}</p>
            <p className="mt-1 text-sm font-bold text-[#6f7da8]">
              レベル {pet?.level || 1} - {pet?.mood || 'Ready'}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-[28px] bg-white/78 p-5">
          <div className="flex items-center justify-between text-sm font-bold text-[#6f7da8]">
            <span>経験値</span>
            <span>
              {pet?.exp || 0} / {maxExp}
            </span>
          </div>
          <div className="mt-3 h-4 overflow-hidden rounded-full bg-[#e6f4ff]">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,#ffd966,#ffbf2f)]" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-3 text-sm leading-6 text-[#6f7da8]">
            今日の学習: {pet?.learned_today || 0} / {pet?.daily_target || 10} 語。目標を達成すると、ペットの成長が進みます。
          </p>
        </div>
      </section>
    </div>
  );
}
