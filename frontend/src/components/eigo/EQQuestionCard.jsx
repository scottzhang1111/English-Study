import { EQFantasyCard } from './EQFantasyUI';
import './EQOfficialComponents.css';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function EQQuestionCard({
  title,
  subtitle,
  children,
  footer,
  className = '',
}) {
  return (
    <EQFantasyCard
      className={cx('eq-question-card-official', className)}
      title={title}
      subtitle={subtitle}
      footer={footer}
    >
      <div className="eq-question-card-official__body">{children}</div>
    </EQFantasyCard>
  );
}
