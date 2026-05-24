import { EQBottomNav, EQMobileShell } from './index';
import { quizThemes } from '../../config/eigoQuestQuizThemes';

export default function PurificationQuizMobile({
  worldId = 'wind',
  day = 1,
  question,
  questionIndex = 0,
  questionTotal = 0,
  selectedChoice = '',
  onChoose,
  onNext,
  onPlayAudio,
  quizSaving = false,
}) {
  const theme = quizThemes[worldId] || quizThemes.wind;
  const locked = Boolean(selectedChoice);
  const isLastQuestion = questionIndex >= questionTotal - 1;

  const promptText =
    question?.type === 'Listening'
      ? 'Listen and choose the correct word.'
      : question?.question || '問題を読み込み中...';

  return (
    <div className="eq-purify-page lg:hidden">
      <EQMobileShell className="eq-purify-screen">
        <section
          className="eq-purify-card"
          style={{
            '--quest-color': theme.primaryColor,
            '--quest-glow': theme.glowColor,
            backgroundImage: `linear-gradient(rgba(4,8,24,.42), rgba(4,8,24,.78)), url(${theme.coverImage})`,
          }}
        >
          <div className="eq-purify-header">
            <span>✦ Day {day} ✦</span>
            <h1>{theme.nameJa}</h1>
            <p>浄化クエスト</p>
            <div className="eq-purify-target">対象単語数: 20 / 20</div>
            <strong>{questionIndex + 1} / {questionTotal}</strong>
          </div>

          <div className="eq-purify-prompt">
            <h2>{promptText}</h2>

            <button
              type="button"
              className="eq-purify-audio"
              onClick={() => onPlayAudio?.(question)}
              aria-label="音声を聞く"
            >
              ▶
            </button>
          </div>

          <div className="eq-purify-choices">
            {(question?.choices || []).map((choice) => {
              const isCorrect = locked && choice === question?.correct;
              const isWrong = locked && choice === selectedChoice && choice !== question?.correct;

              return (
                <button
                  key={choice}
                  type="button"
                  onClick={() => onChoose?.(choice)}
                  disabled={locked}
                  className={[
                    'eq-purify-choice',
                    isCorrect ? 'is-correct' : '',
                    isWrong ? 'is-wrong' : '',
                  ].join(' ')}
                >
                  {choice}
                </button>
              );
            })}
          </div>

          {locked ? (
            <button
              type="button"
              onClick={onNext}
              disabled={quizSaving}
              className="eq-purify-next"
            >
              {isLastQuestion ? '結果へ' : 'つぎへ'}
            </button>
          ) : null}
        </section>
      </EQMobileShell>

      <EQBottomNav />
    </div>
  );
}