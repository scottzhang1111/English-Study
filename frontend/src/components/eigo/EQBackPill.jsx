import { Link } from 'react-router-dom';

export default function EQBackPill({
  to = '/app',
  children = '← ホームに戻る',
  className = '',
  ...props
}) {
  const classes = `eq-back-pill ${className}`.trim();

  if (!to) {
    return (
      <button type="button" className={classes} {...props}>
        {children}
      </button>
    );
  }

  return (
    <Link to={to} className={classes} {...props}>
      {children}
    </Link>
  );
}
