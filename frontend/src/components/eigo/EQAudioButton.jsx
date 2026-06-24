import { EQFantasyButton } from './EQFantasyUI';
import './EQOfficialComponents.css';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function EQAudioButton({
  children,
  onClick,
  disabled = false,
  playing = false,
  label,
  className = '',
}) {
  const buttonLabel = label || (playing ? '再生中' : '再生');

  return (
    <EQFantasyButton
      className={cx('eq-audio-button-official', playing && 'is-playing', className)}
      variant="dark"
      icon={playing ? '■' : '▶'}
      trailingIcon={null}
      onClick={onClick}
      disabled={disabled}
      aria-label={buttonLabel}
    >
      {children || buttonLabel}
    </EQFantasyButton>
  );
}
