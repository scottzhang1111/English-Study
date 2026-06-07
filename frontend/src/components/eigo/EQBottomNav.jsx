import { NavLink, useLocation } from 'react-router-dom';

const NAV_ICON_BASE = '/assets/eigo-quest/nav';

const defaultItems = [
  {
    label: 'ホーム',
    to: '/app',
    match: ['/', '/app'],
    iconSrc: `${NAV_ICON_BASE}/nav-home.png`,
  },
  {
    label: '地図',
    to: '/app/study-map',
    match: ['/study-map', '/app/study-map', '/world-stage', '/app/world-stage'],
    iconSrc: `${NAV_ICON_BASE}/nav-map.png`,
  },
  {
    label: '学習',
    to: '/learning-hub',
    match: [
      '/learning-hub',
      '/app/learning-hub',
      '/daily-words',
      '/app/daily-words',
      '/flashcard',
      '/app/flashcard',
      '/quiz',
      '/app/quiz',
      '/grammar',
      '/grammar-practice',
      '/essay-check',
      '/eiken',
      '/eiken-real',
      '/learned-words',
      '/review',
      '/error-review',
      '/today-review-quiz',
      '/vocab-expansion',
      '/cards',
      '/app/cards',
      '/card-reward', 
      '/heroes'
    ],
    iconSrc: `${NAV_ICON_BASE}/nav-study.png`,
  },
  {
    label: 'カード',
    to: '/cards',
    match: ['/cards', '/card-reward', '/heroes'],
    iconSrc: `${NAV_ICON_BASE}/nav-cards.png`,
  },
  {
    label: 'その他',
    to: '/settings',
    match: [
      '/settings',
      '/settings/children',
      '/settings/add-child',
      '/parent-dashboard',
      '/progress',
      '/pokedex',
      '/pets',
      '/petroom',
    ],
    iconSrc: `${NAV_ICON_BASE}/nav-more.png`,
  },
];

function EQNavIcon({ icon }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    width: '24',
    height: '24',
    'aria-hidden': 'true',
  };

  switch (icon) {
    case 'map':
      return (
        <svg {...common}>
          <path d="m4 6.5 5-2 6 2 5-2v13l-5 2-6-2-5 2v-13Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
          <path d="M9 4.5v13M15 6.5v13" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      );

    case 'study':
      return (
        <svg {...common}>
          <path d="M5 5.5h7.5A3.5 3.5 0 0 1 16 9v9.5H8.5A3.5 3.5 0 0 1 5 15V5.5Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
          <path d="M16 7h2.5A1.5 1.5 0 0 1 20 8.5V20h-4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8.5 10H13M8.5 13.5H13" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      );

    case 'cards':
    case 'card':
      return (
        <svg {...common}>
          <path d="M6.5 7.5 12 4.5l5.5 3-5.5 3-5.5-3Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
          <path d="m6.5 12 5.5 3 5.5-3M6.5 16.5l5.5 3 5.5-3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'more':
      return (
        <svg {...common}>
          <path d="M6 13a1.25 1.25 0 1 0 0-2.5A1.25 1.25 0 0 0 6 13ZM12 13a1.25 1.25 0 1 0 0-2.5A1.25 1.25 0 0 0 12 13ZM18 13a1.25 1.25 0 1 0 0-2.5A1.25 1.25 0 0 0 18 13Z" fill="currentColor" />
        </svg>
      );

    case 'home':
    default:
      return (
        <svg {...common}>
          <path d="M4.5 11.25 12 5l7.5 6.25V19a1 1 0 0 1-1 1H15v-5H9v5H5.5a1 1 0 0 1-1-1v-7.75Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
        </svg>
      );
  }
}

function resolveIconSrc(item) {
  if (item.iconSrc) return item.iconSrc;

  const key = item.icon || item.label;

  if (key === 'home' || key === 'ホーム') return `${NAV_ICON_BASE}/nav-home.png`;
  if (key === 'map' || key === '地図' || key === '世界地図') return `${NAV_ICON_BASE}/nav-map.png`;
  if (key === 'study' || key === '学習') return `${NAV_ICON_BASE}/nav-study.png`;
  if (key === 'cards' || key === 'card' || key === 'カード') return `${NAV_ICON_BASE}/nav-cards.png`;
  if (key === 'more' || key === 'その他' || key === '設定') return `${NAV_ICON_BASE}/nav-more.png`;

  return '';
}

function isItemActive(item, pathname, navLinkActive) {
  if (typeof item.active === 'boolean') {
    return item.active;
  }

  if (Array.isArray(item.match)) {
    return item.match.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  }

  return navLinkActive;
}

export default function EQBottomNav({ items = defaultItems, className = '' }) {
  const location = useLocation();

  return (
    <nav
      className={`eq-bottom-nav eq-app-bottom-nav ${className}`.trim()}
      aria-label="メインナビゲーション"
    >
    {items.map((item) => {
      const iconSrc = resolveIconSrc(item);

      return (
        <NavLink
          key={`${item.to}-${item.label}`}
          to={item.to}
          className={({ isActive }) =>
            `eq-bottom-nav-link ${isItemActive(item, location.pathname, isActive) ? 'is-active' : ''}`.trim()
          }
          aria-label={item.label}
          end={item.end}
        >
          <span className="eq-bottom-nav-icon">
            {iconSrc ? (
              <img src={iconSrc} alt="" aria-hidden="true" />
            ) : (
              item.iconNode || <EQNavIcon icon={item.icon} />
            )}
          </span>
        </NavLink>
      );
    })}
    </nav>
  );
}
