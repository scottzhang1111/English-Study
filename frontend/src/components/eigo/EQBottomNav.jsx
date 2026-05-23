import { NavLink } from 'react-router-dom';

const defaultItems = [
  { label: 'ホーム', to: '/app', icon: 'home' },
  { label: '地図', to: '/study-map', icon: 'map' },
  { label: '学習', to: '/daily-words', icon: 'study' },
  { label: 'カード', to: '/flashcard', icon: 'cards' },
  { label: 'その他', to: '/settings', icon: 'more' },
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

export default function EQBottomNav({ items = defaultItems, className = '' }) {
  return (
    <nav
  className={`eq-bottom-nav eq-app-bottom-nav ${className}`.trim()}
  aria-label="メインナビゲーション"
>
      {items.map((item) => (
        <NavLink
          key={`${item.to}-${item.label}`}
          to={item.to}
          className={({ isActive }) =>
            `eq-bottom-nav-link ${item.active ?? isActive ? 'is-active' : ''}`.trim()
          }
          aria-label={item.label}
          end={item.end}
        >
          <span className="eq-bottom-nav-icon">
            {item.iconNode || <EQNavIcon icon={item.icon} />}
          </span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
