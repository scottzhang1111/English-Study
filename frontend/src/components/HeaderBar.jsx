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
    <header className="panel mb-3 overflow-hidden px-2 py-2 md:px-6 md:py-3">
      <div className="relative flex flex-wrap items-center gap-3 overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#fffef8_0%,#eef7ff_52%,#f8fbff_100%)] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.72)] md:flex-nowrap md:justify-between md:gap-4 md:rounded-[34px] md:p-6 lg:px-7 lg:py-5">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[linear-gradient(180deg,#fff7be_0%,#ffd94d_100%)] text-base font-black text-[#5d4700] shadow-[0_12px_22px_rgba(255,193,31,0.24),inset_0_-8px_12px_rgba(255,255,255,0.38)] md:h-20 md:w-20 md:rounded-[24px] md:text-[1.55rem]">
            PT
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[9px] font-black uppercase tracking-[0.16em] text-[#8b9cc4] md:text-[11px] md:tracking-[0.3em]">
              ポケ単・Poke-Tan
            </p>
            <h1 className="display-font mt-1 truncate text-lg font-black leading-snug text-[#31406f] md:text-2xl lg:text-[2.25rem] lg:leading-tight">
              {subtitle}
            </h1>
            <p className="mt-1.5 hidden max-w-[52rem] text-[0.92rem] font-medium leading-6 text-[#51658a] md:block md:text-[0.98rem]">
              いっしょに集めよう！英語の宝物。
            </p>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 flex-col justify-center rounded-[16px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(242,247,255,0.92)_100%)] px-3 py-2 text-[#6176aa] shadow-[0_14px_28px_rgba(129,164,199,0.16),inset_0_0_0_1px_rgba(255,255,255,0.72)] md:min-w-[180px] md:rounded-[24px] md:px-4 md:py-3">
          <div className="text-[9px] font-black uppercase tracking-[0.16em] text-[#9aa7c4] md:text-[10px] md:tracking-[0.28em]">今日</div>
          <div className="mt-0.5 text-xs font-extrabold tracking-[0.04em] text-[#31406f] md:mt-1 md:text-sm md:tracking-[0.12em]">
            {today.date}
          </div>
          <div className="mt-0.5 text-[10px] font-bold text-[#5f75a5] md:mt-1 md:text-xs">{today.weekday}</div>
        </div>
      </div>
    </header>
  );
}
