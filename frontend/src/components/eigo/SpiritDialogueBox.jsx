function SpiritDialogueBox({
  title = '風の精霊',
  messages = [],
  currentIndex = 0,
  onNext,
}) {
  const message = messages[currentIndex] || messages[0] || '';

  return (
    <div className="eq-spirit-dialogue-wrap">
      <button
        type="button"
        className="eq-spirit-dialogue"
        onClick={onNext}
      >
        <div className="eq-spirit-dialogue-title">{title}</div>
        <div className="eq-spirit-dialogue-message">{message}</div>

        <div className="eq-spirit-dialogue-footer">
          <div className="eq-spirit-dialogue-dots">
            {messages.map((_, index) => (
              <span
                key={index}
                className={index === currentIndex ? 'is-active' : ''}
              />
            ))}
          </div>
          <span className="eq-spirit-dialogue-count">
            {currentIndex + 1}/{messages.length}
          </span>
          <span className="eq-spirit-dialogue-hint">タップでつぎへ</span>
        </div>
      </button>

      <img
        src="/assets/eigo-quest/spirit_assets/spirit.png"
        alt=""
        className="eq-spirit-dialogue-character"
      />
    </div>
  );
}