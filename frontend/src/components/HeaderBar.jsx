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
    <header className="panel mb-3 max-w-full overflow-hidden px-1.5 py-1.5 md:px-6 md:py-3">
      <div className="relative flex max-w-full items-center gap-2 overflow-hidden rounded-[20px] bg-[linear-gradient(135deg,#fffef8_0%,#eef7ff_52%,#f8fbff_100%)] p-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.72)] md:justify-between md:gap-4 md:rounded-[34px] md:p-6 lg:px-7 lg:py-5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[16px] bg-white text-sm font-black text-[#5d4700] shadow-[0_12px_22px_rgba(255,193,31,0.24),inset_0_-8px_12px_rgba(255,255,255,0.38)] md:h-20 md:w-20 md:rounded-[24px] md:text-[1.55rem]">
            <img src="/assets/homepage-icon.png" alt="英楽語" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-bold uppercase tracking-wide text-[#8b9cc4] md:text-[11px] md:font-black md:tracking-[0.3em]">
              英楽語
            </p>
            <h1 className="display-font mt-0.5 truncate text-xl font-bold leading-tight text-[#31406f] md:mt-1 md:text-2xl md:font-black lg:text-[2.25rem] lg:leading-tight">
              <span className="md:hidden">英楽語</span>
              <span className="hidden md:inline">{subtitle}</span>
            </h1>
            <p className="mt-0.5 truncate text-xs font-medium text-[#51658a] md:hidden">楽しく続ける英語学習</p>
            <p className="mt-1.5 hidden max-w-[52rem] text-[0.92rem] font-medium leading-6 text-[#51658a] md:block md:text-[0.98rem]">
              学ぶほど、仲間がふえる。
            </p>
          </div>
        </div>

        <div className="ml-auto flex max-w-[7.5rem] shrink-0 flex-col justify-center rounded-full border border-white/70 bg-white/95 px-2.5 py-1.5 text-[#6176aa] shadow-[0_10px_22px_rgba(129,164,199,0.14),inset_0_0_0_1px_rgba(255,255,255,0.72)] md:max-w-none md:min-w-[180px] md:rounded-[24px] md:bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(242,247,255,0.92)_100%)] md:px-4 md:py-3">
          <div className="text-[9px] font-black uppercase tracking-[0.16em] text-[#9aa7c4] md:text-[10px] md:tracking-[0.28em]">今日</div>
          <div className="truncate text-[11px] font-extrabold tracking-[0.02em] text-[#31406f] md:mt-1 md:text-sm md:tracking-[0.12em]">
            {today.date}
          </div>
          <div className="truncate text-[9px] font-bold text-[#5f75a5] md:mt-1 md:text-xs">{today.weekday}</div>
        </div>
      </div>
    </header>
  );
}
