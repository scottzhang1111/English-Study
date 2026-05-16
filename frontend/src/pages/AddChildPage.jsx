import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveChildProfile } from '../api';
import { DEFAULT_PARTNER_ID, PARTNERS } from '../utils/childStorage';

const CHILD_STORAGE_KEY = 'selected_child_id';
const STARTER_POKEMON_IDS = {
  bulbasaur: 1,
  charmander: 4,
  squirtle: 7,
};

const GRADE_OPTIONS = [
  '小学1年生',
  '小学2年生',
  '小学3年生',
  '小学4年生',
  '小学5年生',
  '小学6年生',
  '中学1年生',
  '中学2年生',
  '中学3年生',
];

const TARGET_LEVEL_OPTIONS = ['英検5級', '英検4級', '英検3級', '準2級', '2級'];

export default function AddChildPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('小学2年生');
  const [targetLevel, setTargetLevel] = useState('準2級');
  const [partnerMonsterId, setPartnerMonsterId] = useState(DEFAULT_PARTNER_ID);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('名前を入力してください。');
      return;
    }

    try {
      const result = await saveChildProfile({
        name: name.trim(),
        grade,
        target_level: targetLevel,
        starter_pokemon_id: STARTER_POKEMON_IDS[partnerMonsterId] || STARTER_POKEMON_IDS[DEFAULT_PARTNER_ID],
      });
      const childId = result?.child?.id;
      if (childId) {
        localStorage.setItem(CHILD_STORAGE_KEY, String(childId));
      }
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err.message || '保存できませんでした。');
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl items-center px-4 py-8 sm:px-6">
      <form
        onSubmit={handleSubmit}
        className="grid w-full gap-6 rounded-[40px] border border-white/80 bg-white/88 p-6 shadow-[0_18px_44px_rgba(145,177,209,0.16)] lg:grid-cols-[1fr_360px] lg:p-8"
      >
        <div>
          <div className="inline-flex rounded-full bg-[#eef8ff] px-4 py-2 text-sm font-bold text-[#6f7da8]">
            はじめての設定
          </div>
          <h1 className="display-font mt-5 text-3xl font-extrabold text-[#354172] sm:text-4xl">
            はじめての設定
          </h1>
          <p className="mt-3 text-sm font-bold leading-7 text-[#5f6f94]">
            まずは学習する子どもを登録しましょう。
          </p>

          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold text-[#354172]">
              名前
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 w-full rounded-[22px] border border-white/80 bg-[#f8fcff] px-4 py-3 text-base font-semibold text-[#354172]"
              />
            </label>

            <label className="text-sm font-bold text-[#354172]">
              学年
              <select
                value={grade}
                onChange={(event) => setGrade(event.target.value)}
                className="mt-2 w-full rounded-[22px] border border-white/80 bg-[#f8fcff] px-4 py-3 text-base font-semibold text-[#354172]"
              >
                {GRADE_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-bold text-[#354172]">
              目標レベル
              <select
                value={targetLevel}
                onChange={(event) => setTargetLevel(event.target.value)}
                className="mt-2 w-full rounded-[22px] border border-white/80 bg-[#f8fcff] px-4 py-3 text-base font-semibold text-[#354172]"
              >
                {TARGET_LEVEL_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && <div className="mt-5 rounded-[24px] bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700">{error}</div>}

          <button type="submit" className="pill-button mt-7 px-7 py-4 text-[1rem]">
            登録してはじめる
          </button>
        </div>

        <div className="rounded-[34px] bg-[linear-gradient(180deg,#eef8ff_0%,#fffdf7_100%)] p-5">
          <p className="text-sm font-bold text-[#6f7da8]">パートナー</p>
          <div className="mt-4 grid gap-3">
            {Object.values(PARTNERS).map((partner) => {
              const active = partnerMonsterId === partner.id;
              return (
                <button
                  key={partner.id}
                  type="button"
                  onClick={() => setPartnerMonsterId(partner.id)}
                  className={`flex items-center gap-4 rounded-[28px] border p-3 text-left transition ${
                    active ? 'border-[#f0c24f] bg-[#fff7d6]' : 'border-white/80 bg-white/88 hover:-translate-y-0.5'
                  }`}
                >
                  <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[24px] bg-white/86">
                    <img src={partner.imageUrl} alt={partner.name} className="h-full w-full object-contain p-2" />
                  </span>
                  <span>
                    <span className="block text-lg font-black text-[#354172]">{partner.name}</span>
                    <span className="mt-1 block text-xs font-bold text-[#6f7da8]">パートナー Lv.1</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </form>
    </div>
  );
}
