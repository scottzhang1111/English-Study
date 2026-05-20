import { useEffect, useState } from 'react';

export default function FantasyMenuTile({
  title,
  subtitle,
  icon,
  theme = 'blue',
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const isImage = typeof icon === 'string' && icon.startsWith('/');

  useEffect(() => {
    setImageFailed(false);
  }, [icon]);

  return (
    <span className={`fantasy-menu-tile is-${theme}`}>
      <span className="fantasy-menu-icon-halo">
        {isImage && !imageFailed ? (
          <img
            src={icon}
            alt=""
            className="fantasy-menu-icon-img"
            loading="lazy"
            aria-hidden="true"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="fantasy-menu-icon-fallback">{icon || '★'}</span>
        )}
      </span>
      <span className="fantasy-menu-tile-title">{title}</span>
      <span className="fantasy-menu-tile-subtitle">{subtitle}</span>
    </span>
  );
}
