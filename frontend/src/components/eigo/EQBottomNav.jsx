import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { getEigoQuestIcon } from '../../config/eigoQuestAssets';

const defaultItems = [
  { label: 'ホーム', to: '/app', icon: 'home' },
  { label: '地図', to: '/study-map', icon: 'map' },
  { label: '学習', to: '/daily-words', icon: 'study' },
  { label: 'カード', to: '/flashcard', icon: 'cards' },
  { label: 'その他', to: '/settings', icon: 'more' },
];

function EQNavSvgIcon({ icon }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    width: '22',
    height: '22',
    'aria-hidden': 'true',
  };

  switch (icon) {
    case 'map':
      return (
        <svg {...common}>
          <path d="m4 6.5 5-2 6 2 5-2v13l-5 2-6-2-5 2v-13Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M9 4.5v13M15 6.5v13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'study':
      return (
        <svg {...common}>
          <path d="M5 5.5h9.5A3.5 3.5 0 0 1 18 9v9.5H8.5A3.5 3.5 0 0 1 5 15V5.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M8.5 9H15M8.5 12.5H14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'cards':
      return (
        <svg {...common}>
          <path d="M8 6.5 16.5 4l3 10.5-8.5 2.5L8 6.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M5 9v10h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'more':
      return (
        <svg {...common}>
          <path d="M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM6 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM18 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="currentColor" />
          <path d="M4 6h16M4 18h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
        </svg>
      );
    case 'home':
    default:
      return (
        <svg {...common}>
          <path d="M4.5 11.5 12 5l7.5 6.5V19a1 1 0 0 1-1 1H15v-5H9v5H5.5a1 1 0 0 1-1-1v-7.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
  }
}

function EQNavIcon({ icon }) {
  const iconSrc = getEigoQuestIcon(icon);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [iconSrc]);

  if (iconSrc && !imageFailed) {
    return (
      <img
        src={iconSrc}
        alt=""
        className="eq-decorative-image"
        loading="lazy"
        aria-hidden="true"
        onError={() => setImageFailed(true)}
      />
    );
  }

  return <EQNavSvgIcon icon={icon} />;
}

export default function EQBottomNav({ items = defaultItems, className = '' }) {
  return (
    <nav className={`eq-bottom-nav ${className}`.trim()} aria-label="メインナビゲーション">
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
