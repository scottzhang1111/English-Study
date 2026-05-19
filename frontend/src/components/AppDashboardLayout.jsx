import { NavLink } from 'react-router-dom';
import HeaderBar from './HeaderBar';
import { useChildren } from '../ChildrenContext';

const NAV_ITEMS = [
  { label: 'ホーム', path: '/', icon: '⌂' },
  { label: 'ペット図鑑', path: '/pokedex', icon: '★' },
  { label: 'ぼうけんの記録', path: '/progress', icon: '↗' },
  { label: '設定', path: '/settings', icon: '⚙' },
];

function getTodayText() {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date());
}

function DashboardSidebar() {
  return (
    <aside className="hidden lg:block">
      <nav className="sticky top-6 rounded-[30px] border border-white/80 bg-white/72 p-3 shadow-[0_16px_36px_rgba(129,164,199,0.12)] backdrop-blur">
        <div className="px-3 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-muted)]">英楽語</p>
          <p className="mt-1 text-sm font-bold text-[var(--color-text)]">学習ダッシュボード</p>
        </div>
        <div className="mt-2 grid gap-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex min-h-[48px] items-center gap-2 rounded-[18px] px-3 text-sm font-bold transition ${
                  isActive
                    ? 'bg-[color-mix(in_srgb,var(--color-primary)_46%,white)] text-[var(--color-primary-dark)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.72)]'
                    : 'text-[var(--color-muted)] hover:bg-white/70'
                }`
              }
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] bg-white/78 text-sm">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </aside>
  );
}

function DashboardHeader({ title, subtitle, childName }) {
  return (
    <header className="hidden min-h-[78px] items-center justify-between rounded-[30px] border border-white/80 bg-white/72 px-6 py-4 shadow-[0_16px_36px_rgba(129,164,199,0.13)] backdrop-blur lg:flex">
      <div className="flex min-w-0 items-center gap-4">
        <img
          src="/assets/homepage-icon.png"
          alt="英楽語"
          className="h-14 w-14 shrink-0 rounded-[18px] object-cover shadow-[0_10px_20px_rgba(255,193,31,0.20)]"
        />
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-muted)]">英楽語</p>
          <h1 className="display-font truncate text-2xl font-bold text-[var(--color-text)]">{title}</h1>
          {subtitle && <p className="truncate text-sm font-semibold text-[var(--color-muted)]">{subtitle}</p>}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-bold text-[var(--color-text)]">{childName || 'Student'}</p>
        <p className="text-xs font-semibold text-[var(--color-muted)]">{getTodayText()}</p>
      </div>
    </header>
  );
}

export default function AppDashboardLayout({
  title,
  subtitle,
  children,
  rightPanel = null,
  maxWidth = 'max-w-[1400px]',
}) {
  const { children: childList, selectedChildId } = useChildren();
  const selectedChild = childList.find((child) => String(child.id) === String(selectedChildId));

  return (
    <div className={`mx-auto overflow-x-hidden px-3 pb-28 pt-2 sm:px-6 md:pb-10 lg:px-6 lg:pt-6 ${maxWidth}`}>
      <div className="lg:hidden">
        <HeaderBar subtitle={title} />
      </div>

      <DashboardHeader title={title} subtitle={subtitle} childName={selectedChild?.name} />

      <div
        className={`mt-0 lg:mt-6 lg:grid lg:items-start lg:gap-6 ${
          rightPanel ? 'lg:grid-cols-[180px_minmax(0,1fr)_300px]' : 'lg:grid-cols-[180px_minmax(0,1fr)]'
        }`}
      >
        <DashboardSidebar />
        <main className="min-w-0">{children}</main>
        {rightPanel && (
          <aside className="hidden lg:block">
            <div className="sticky top-6">{rightPanel}</div>
          </aside>
        )}
      </div>
    </div>
  );
}
