import { NavLink } from 'react-router-dom';
import HeaderBar from './HeaderBar';
import { useChildren } from '../ChildrenContext';

const NAV_ITEMS = [
  { label: 'ホーム', path: '/' },
  { label: 'ペット図鑑', path: '/pokedex' },
  { label: 'ぼうけんの記録', path: '/progress' },
  { label: '設定', path: '/settings' },
];

function WebSidebar() {
  return (
    <aside className="hidden lg:block">
      <nav className="sticky top-6 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)] backdrop-blur">
        <div className="px-3 py-2">
          <p className="text-xs font-bold text-[#9aa7c4]">英楽語</p>
        </div>
        <div className="mt-2 grid gap-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex min-h-11 items-center rounded-2xl px-3 text-sm font-bold transition ${
                  isActive
                    ? 'bg-[color-mix(in_srgb,var(--color-primary)_34%,white)] text-[var(--color-primary-dark)]'
                    : 'text-[var(--color-muted)] hover:bg-[color-mix(in_srgb,var(--color-bg)_42%,white)]'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </aside>
  );
}

function CompactHeader({ title, subtitle }) {
  const { children, selectedChildId } = useChildren();
  const selectedChild = children.find((item) => String(item.id) === String(selectedChildId));
  const dateText = new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date());

  return (
    <header className="hidden min-h-[68px] items-center justify-between rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3 shadow-[var(--shadow-card)] backdrop-blur lg:flex">
      <div className="flex min-w-0 items-center gap-3">
        <img src="/assets/homepage-icon.png" alt="英楽語" className="h-11 w-11 shrink-0 rounded-2xl object-cover" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-[var(--color-text)]">{title}</h1>
          {subtitle && <p className="truncate text-sm font-semibold text-[var(--color-muted)]">{subtitle}</p>}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-bold text-[var(--color-text)]">{selectedChild?.name || 'Student'}</p>
        <p className="text-xs font-semibold text-[var(--color-muted)]">{dateText}</p>
      </div>
    </header>
  );
}

export default function WebLearningLayout({
  title,
  subtitle,
  children,
  rightPanel = null,
  desktopRight = true,
  maxWidth = 'max-w-[1360px]',
  mobileTight = false,
  mobileBack = true,
  hideMobileHeader = false,
}) {
  return (
    <div className={`mx-auto px-4 pb-32 pt-6 sm:px-6 lg:px-6 lg:py-6 lg:pb-10 ${mobileTight ? 'max-md:pt-3' : ''} ${maxWidth}`}>
      {!hideMobileHeader && (
        <div className="lg:hidden">
          <HeaderBar subtitle={title} showBack={mobileBack} />
        </div>
      )}

      <div className={`lg:grid lg:items-start lg:gap-6 ${rightPanel && desktopRight ? 'lg:grid-cols-[160px_minmax(0,1fr)_280px]' : 'lg:grid-cols-[160px_minmax(0,1fr)]'}`}>
        <WebSidebar />
        <main className="min-w-0">
          <CompactHeader title={title} subtitle={subtitle} />
          <div className="web-learning-content lg:mt-5">{children}</div>
        </main>
        {rightPanel && desktopRight && (
          <aside className="hidden lg:block">
            <div className="sticky top-6">{rightPanel}</div>
          </aside>
        )}
      </div>
    </div>
  );
}
