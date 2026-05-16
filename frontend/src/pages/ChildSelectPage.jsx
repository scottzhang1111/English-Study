import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getChildren } from '../api';
import { getPartner } from '../utils/childStorage';

const CHILD_STORAGE_KEY = 'selected_child_id';

function getPartnerForChild(child) {
  const starter = String(child.partnerMonsterId || child.starter_pokemon_id || '');
  const byPokemonId = { 1: 'bulbasaur', 4: 'charmander', 7: 'squirtle' };
  return getPartner(byPokemonId[starter] || starter);
}

export default function ChildSelectPage() {
  const navigate = useNavigate();
  const [children, setChildren] = useState([]);
  const [currentChildId, setCurrentChildId] = useState(localStorage.getItem(CHILD_STORAGE_KEY) || '');
  const [error, setError] = useState('');

  useEffect(() => {
    getChildren()
      .then((payload) => setChildren(payload.children || []))
      .catch((err) => setError(err.message || '読み込みに失敗しました。'));
  }, []);

  const handleSelect = (childId) => {
    localStorage.setItem(CHILD_STORAGE_KEY, String(childId));
    setCurrentChildId(String(childId));
    navigate('/app', { replace: true });
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl items-center px-4 py-8 sm:px-6">
      <section className="w-full rounded-[40px] border border-white/80 bg-white/88 p-6 shadow-[0_18px_44px_rgba(145,177,209,0.16)] sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex rounded-full bg-[#eef8ff] px-4 py-2 text-sm font-bold text-[#6f7da8]">
              子ども選択
            </div>
            <h1 className="display-font mt-5 text-3xl font-extrabold text-[#354172] sm:text-4xl">
              だれが学習しますか？
            </h1>
            <p className="mt-3 text-sm font-bold leading-7 text-[#5f6f94]">
              今日も英語の冒険をはじめよう。
            </p>
          </div>
          <button type="button" onClick={() => navigate('/settings/add-child')} className="ghost-button px-5 py-3">
            ＋ 子どもを追加
          </button>
        </div>

        {error && <div className="mt-5 rounded-[24px] bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700">{error}</div>}

        <div className="mt-7 grid gap-4 md:grid-cols-2">
          {children.map((child) => {
            const partner = getPartnerForChild(child);
            const active = String(child.id) === String(currentChildId);
            return (
              <article
                key={child.id}
                className={`rounded-[34px] border p-5 shadow-[0_12px_28px_rgba(145,177,209,0.10)] ${
                  active ? 'border-[#f0c24f] bg-[#fff8d9]' : 'border-white/80 bg-[#f8fbff]'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[28px] bg-white/88">
                    <img src={partner.imageUrl} alt={partner.name} className="h-full w-full object-contain p-2" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-2xl font-black text-[#354172]">{child.name}</h2>
                    <p className="mt-1 text-sm font-bold text-[#6f7da8]">学年：{child.grade}</p>
                    <p className="mt-1 text-sm font-bold text-[#6f7da8]">目標：{child.targetLevel}</p>
                    <p className="mt-1 text-xs font-black text-[#8fa0c2]">{partner.name} Lv.1</p>
                  </div>
                </div>
                <button type="button" onClick={() => handleSelect(child.id)} className="pill-button mt-5 w-full px-5 py-3">
                  この子ではじめる
                </button>
              </article>
            );
          })}
        </div>

        {children.length === 0 && (
          <div className="mt-7 rounded-[28px] bg-[#f8fbff] p-6 text-center">
            <p className="text-sm font-bold text-[#6f7da8]">まだ子どもが登録されていません。</p>
            <button type="button" onClick={() => navigate('/settings/add-child')} className="pill-button mt-4 px-5 py-3">
              ＋ 子どもを追加
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
