import { Link } from 'react-router-dom';

const toneStyles = {
  yellow: 'from-[#fff8d8] via-[#fff1a8] to-[#ffe889] border-[#efd56f] text-[#5f4900]',
  blue: 'from-[#f5f9ff] via-[#eef6ff] to-[#e4f0ff] border-[#cfe0f7] text-[#324f7d]',
  green: 'from-[#f2fbf5] via-[#e8f8ee] to-[#ddf2e5] border-[#c7e6d1] text-[#2f6445]',
  pink: 'from-[#fff3fa] via-[#ffe9f4] to-[#ffddec] border-[#f3bdd4] text-[#7c3f5a]',
  purple: 'from-[#f2fbf5] via-[#e8f8ee] to-[#ddf2e5] border-[#c7e6d1] text-[#2f6445]',
  orange: 'from-[#fff8d8] via-[#fff1a8] to-[#ffe889] border-[#efd56f] text-[#5f4900]',
  teal: 'from-[#f2fbf5] via-[#e8f8ee] to-[#ddf2e5] border-[#c7e6d1] text-[#2f6445]',
  gray: 'from-[#f5f9ff] via-[#eef6ff] to-[#e4f0ff] border-[#cfe0f7] text-[#324f7d]',
};

function FeatureIcon({ icon }) {
  const base = 'h-5 w-5';
  switch (icon) {
    case 'FC':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={base} aria-hidden="true">
          <path d="M5 6.5C5 5.12 6.12 4 7.5 4H19v12.5c0 1.38-1.12 2.5-2.5 2.5H7.5C6.12 19 5 17.88 5 16.5v-10Z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 8h8M8 11h8M8 14h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'QZ':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={base} aria-hidden="true">
          <path d="M12 3.5c4.69 0 8.5 3.36 8.5 7.5 0 2.58-1.44 4.85-3.65 6.21V20l-3.35-1.62c-.5.06-1 .12-1.5.12-4.69 0-8.5-3.36-8.5-7.5S7.31 3.5 12 3.5Z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 7.2c1.3 0 2.3.87 2.3 1.98 0 1.7-2.3 1.86-2.3 3.46" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="16.6" r="1" fill="currentColor" />
        </svg>
      );
    case 'EK':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={base} aria-hidden="true">
          <path d="M7 4.5h9.5A2.5 2.5 0 0 1 19 7v11.5a1 1 0 0 1-1.5.86l-2.1-1.25-2.1 1.25A1 1 0 0 1 12 19v-7H6.5A2.5 2.5 0 0 1 4 9.5V7a2.5 2.5 0 0 1 3-2.5Z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8.2 9.2 10 11l3.6-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'RV':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={base} aria-hidden="true">
          <path d="M7 7h10v10H7z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M9 4.5 7 7l2 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15 19.5 17 17l-2-2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'ST':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={base} aria-hidden="true">
          <path d="M5 18V6M5 18h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M9 15v-3M13 15V9M17 15V7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'PF':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={base} aria-hidden="true">
          <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M19 12h-2.1m-10.8 0H4M12 5V3.5M12 20.5V19M16.9 7.1 18 6M6 18l1.1-1.1M16.9 16.9 18 18M6 6l1.1 1.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'PT':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={base} aria-hidden="true">
          <path d="M8 7.5h2.2l1.3 1.8 1.3-1.8H15a3 3 0 0 1 3 3v2c0 3.9-4.4 6.2-5.5 6.7a1 1 0 0 1-.9 0C10.4 18.7 6 16.4 6 12.5v-2a3 3 0 0 1 2-3Z" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case 'PR':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={base} aria-hidden="true">
          <path d="M12 4.5 14.3 9l5 .7-3.6 3.5.9 4.9L12 15.7 7.4 18.1l.9-4.9L4.7 9.7l5-.7L12 4.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" className={base} aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
  }
}

export default function FeatureCard({ icon, title, description, to, featured = false, tone = 'blue' }) {
  const toneClass = toneStyles[tone] || toneStyles.blue;

  return (
    <Link
      to={to}
      className={`group flex aspect-[4/3] min-h-[150px] flex-col justify-between rounded-[24px] border bg-gradient-to-br p-5 text-left shadow-[0_12px_26px_rgba(145,177,209,0.10)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(145,177,209,0.16)] active:translate-y-0 active:scale-[1.05] ${toneClass}`}
      aria-label={title}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-white/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]"
        >
          <span className="text-current">
            <FeatureIcon icon={icon} />
          </span>
        </div>
      </div>

      <div className="pt-3">
        <p className="display-font text-[1.1rem] font-extrabold leading-tight text-current">
          {title}
        </p>
        <p className="mt-1.5 line-clamp-2 text-[0.82rem] leading-5 text-current/86">
          {description}
        </p>
      </div>
    </Link>
  );
}
