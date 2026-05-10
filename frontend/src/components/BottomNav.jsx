import { NavLink } from 'react-router-dom';

function NavIcon({ name, active }) {
  const strokeWidth = active ? 2.1 : 1.8;
  const base = 'h-5 w-5';

  switch (name) {
    case 'Home':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={base} aria-hidden="true">
          <path d="M4.5 11.5 12 5l7.5 6.5V19a1 1 0 0 1-1 1H15v-5H9v5H5.5a1 1 0 0 1-1-1v-7.5Z" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" />
        </svg>
      );
    case 'Pets':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={base} aria-hidden="true">
          <path d="M12 4.4 14.6 9l5 .7-3.6 3.5.9 4.9L12 15.8 7.4 18.1l.9-4.9L4.7 9.7l5-.7L12 4.4Z" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" />
        </svg>
      );
    case 'Stats':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={base} aria-hidden="true">
          <path d="M5 18.5V5.5M5 18.5h14" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
          <path d="M9 15v-3.5M13 15V8M17 15v-6" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
        </svg>
      );
    case 'Setup':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={base} aria-hidden="true">
          <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z" stroke="currentColor" strokeWidth={strokeWidth} />
          <path d="M19 12h-2.1m-10.8 0H4M12 5V3.5M12 20.5V19M16.9 7.1 18 6M6 18l1.1-1.1M16.9 16.9 18 18M6 6l1.1 1.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

export default function BottomNav() {
  const items = [
    { label: 'ホーム', path: '/', icon: 'Home' },
    { label: 'ポケモンセンター', path: '/pokedex', icon: 'Pets' },
    { label: 'ぼうけんの記録', path: '/progress', icon: 'Stats' },
    { label: '設定', path: '/settings', icon: 'Setup' },
  ];

  return (
    <nav className="fixed bottom-3 left-1/2 z-20 flex w-[min(760px,calc(100%-1rem))] -translate-x-1/2 items-stretch justify-between gap-1 rounded-[28px] border border-white/70 bg-white/92 px-2 py-2 shadow-[0_14px_34px_rgba(129,164,199,0.20)] backdrop-blur">
      {items.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `flex min-w-0 flex-1 flex-col items-center justify-center rounded-[22px] px-2 py-3 text-center transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#f5fbff] active:translate-y-0 active:scale-[0.99] ${
              isActive
                ? 'translate-y-[-3px] bg-[linear-gradient(180deg,#fffdf0_0%,#ffe984_55%,#ffd84f_100%)] text-[#5f4a00] shadow-[0_14px_26px_rgba(255,191,31,0.30),inset_0_0_0_1px_rgba(255,255,255,0.72)]'
                : 'text-[#7581a7]'
            }`
          }
          aria-label={item.label}
        >
          {({ isActive }) => (
            <>
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-[14px] transition-all duration-200 ${
                  isActive ? 'bg-white/96 shadow-[0_10px_18px_rgba(255,255,255,0.72)]' : 'bg-[#f2f7ff]'
                }`}
              >
                <span className={`${isActive ? 'text-[#7b5b00]' : 'text-[#6f7da8]'}`}>
                  <NavIcon name={item.icon} active={isActive} />
                </span>
              </span>
              <span className={`mt-1 text-[12px] font-bold leading-none ${isActive ? 'font-black' : ''}`}>
                {item.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
