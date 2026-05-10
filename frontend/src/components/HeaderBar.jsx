function getTodayLabel() {
  const now = new Date();
  const date = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(now);
  const weekday = new Intl.DateTimeFormat('ja-JP', {
    weekday: 'long',
  }).format(now);
  return { date, weekday };
}

export default function HeaderBar({ subtitle }) {
  const today = getTodayLabel();

  return (
    <header className="panel mb-3 overflow-hidden px-4 py-3 sm:px-6">
      <div className="relative flex items-center justify-between gap-4 overflow-hidden rounded-[34px] bg-[linear-gradient(135deg,#fffef8_0%,#eef7ff_52%,#f8fbff_100%)] px-5 py-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.72)] sm:px-7 sm:py-5">
        <div className="flex min-w-0 flex-[1.6] items-center gap-4">
          <div className="flex h-18 w-18 shrink-0 items-center justify-center rounded-[24px] bg-[linear-gradient(180deg,#fff7be_0%,#ffd94d_100%)] text-[1.55rem] font-black text-[#5d4700] shadow-[0_12px_22px_rgba(255,193,31,0.24),inset_0_-8px_12px_rgba(255,255,255,0.38)] sm:h-20 sm:w-20">
            PT
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#8b9cc4]">ポケ単 Poke-Tan</p>
            <h1 className="display-font mt-1 truncate text-[1.9rem] font-black leading-tight text-[#31406f] sm:text-[2.25rem]">
              {subtitle}
            </h1>
            <p className="mt-1.5 max-w-[52rem] text-[0.92rem] font-medium leading-6 text-[#51658a] sm:text-[0.98rem]">
              いっしょに集めよう！英語の宝物。
            </p>
          </div>
        </div>

        <div className="hidden shrink-0 min-w-[180px] flex-col justify-center rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(242,247,255,0.92)_100%)] px-4 py-3 text-[#6176aa] shadow-[0_14px_28px_rgba(129,164,199,0.16),inset_0_0_0_1px_rgba(255,255,255,0.72)] sm:flex">
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-[#9aa7c4]">今日</div>
          <div className="mt-1 text-sm font-extrabold tracking-[0.12em] text-[#31406f]">
            {today.date}
          </div>
          <div className="mt-1 text-xs font-bold text-[#5f75a5]">{today.weekday}</div>
        </div>
      </div>
    </header>
  );
}
