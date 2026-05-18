import { useNavigate } from 'react-router-dom';
import { useChildren } from '../ChildrenContext';
import { getPartner } from '../utils/childStorage';

function getPartnerForChild(child) {
  const starter = String(
    child.partnerMonsterId
      || child.starter_pokemon_id
      || child.starterPokemonId
      || child.pet?.pokemon_id
      || child.pet?.catalog_id
      || child.pet?.id
      || '',
  );
  return getPartner(starter || 1);
}

export default function ChildSelectPage() {
  const navigate = useNavigate();
  const { children, childrenLoading, childrenError, selectedChildId, setSelectedChildId, refreshChildren } = useChildren();

  const handleSelect = (childId) => {
    setSelectedChildId(childId);
    navigate('/app', { replace: true });
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl items-center px-4 py-8 max-md:w-full max-md:max-w-full max-md:items-start max-md:overflow-x-hidden max-md:px-3 max-md:pb-40 max-md:pt-4 sm:px-6">
      <section className="w-full rounded-[40px] border border-white/80 bg-white/88 p-6 shadow-[0_18px_44px_rgba(145,177,209,0.16)] max-md:max-w-full max-md:overflow-hidden max-md:rounded-[28px] max-md:p-4 sm:p-8">
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
          <button type="button" onClick={() => navigate('/settings/add-child')} className="ghost-button px-5 py-3 max-md:h-12 max-md:w-full max-md:px-4 max-md:py-2">
            ＋ 子どもを追加
          </button>
        </div>

        {childrenLoading && <div className="mt-5 rounded-[24px] bg-[#f8fbff] px-5 py-4 text-sm font-bold text-[#6f7da8]">Loading...</div>}
        {childrenError && (
          <div className="mt-5 rounded-[24px] bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700">
            <p>{childrenError}</p>
            <button type="button" onClick={refreshChildren} className="pill-button mt-4 px-5 py-3 text-sm">
              Retry
            </button>
          </div>
        )}

        <div className="mt-7 grid gap-4 max-md:mt-5 max-md:w-full max-md:max-w-full max-md:gap-3 md:grid-cols-2">
          {children.map((child) => {
            const partner = getPartnerForChild(child);
            const active = String(child.id) === String(selectedChildId);
            return (
              <article
                key={child.id}
                className={`rounded-[34px] border p-5 shadow-[0_12px_28px_rgba(145,177,209,0.10)] max-md:w-full max-md:max-w-full max-md:overflow-hidden max-md:rounded-[24px] max-md:p-3 ${
                  active ? 'border-[#f0c24f] bg-[#fff8d9]' : 'border-white/80 bg-[#f8fbff]'
                }`}
              >
                <div className="flex items-center gap-4 max-md:gap-3">
                  <div className="flex h-[250px] w-[250px] max-w-full shrink-0 items-center justify-center rounded-[28px] bg-white/40 max-md:h-20 max-md:w-20 max-md:rounded-2xl max-md:bg-transparent">
                    {partner.imageUrl ? (
                      <img src={partner.imageUrl} alt={partner.name} className="h-[250px] w-[250px] max-w-full object-contain max-md:h-20 max-md:w-20" />
                    ) : (
                      <span className="text-2xl font-black text-[#354172] max-md:text-lg">PT</span>
                    )}
                  </div>
                  <div className="min-w-0 max-md:flex-1">
                    <h2 className="truncate text-2xl font-black text-[#354172] max-md:text-lg">{child.name}</h2>
                    <p className="mt-1 text-sm font-bold text-[#6f7da8] max-md:truncate max-md:text-xs">学年: {child.grade}</p>
                    <p className="mt-1 text-sm font-bold text-[#6f7da8] max-md:truncate max-md:text-xs">目標: {child.targetLevel}</p>
                    <p className="mt-1 truncate text-xs font-black text-[#8fa0c2]">{partner.name} Lv.1</p>
                  </div>
                </div>
                <button type="button" onClick={() => handleSelect(child.id)} className="pill-button mt-5 w-full px-5 py-3 max-md:mt-3 max-md:h-11 max-md:px-4 max-md:py-2 max-md:text-sm">
                  この子ではじめる
                </button>
              </article>
            );
          })}
        </div>

        {!childrenLoading && !childrenError && children.length === 0 && (
          <div className="mt-7 rounded-[28px] bg-[#f8fbff] p-6 text-center">
            <p className="text-sm font-bold text-[#6f7da8]">まだ子どもが登録されていません。</p>
            <button type="button" onClick={() => navigate('/settings/add-child')} className="pill-button mt-4 px-5 py-3 max-md:h-12 max-md:w-full">
              ＋ 子どもを追加
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
