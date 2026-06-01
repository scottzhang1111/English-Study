import EQBottomNav from './EQBottomNav';
import EQMobileShell from './EQMobileShell';
import { quizThemes } from '../../config/eigoQuestQuizThemes';
import { getEigoQuestWorld } from '../../config/eigoQuestWorlds';

export default function PurificationQuizMobile({
  worldId = 'wind',
  question,
  questionIndex = 0,
  questionTotal = 0,
  selectedChoice = '',
  retryMode = false,
  retryRemaining = 0,
  onChoose,
  onNext,
  onPlayAudio,
  quizSaving = false,
}) {
  const theme = quizThemes[worldId] || quizThemes.wind;
  const world = getEigoQuestWorld(worldId);
  const worldName = theme.nameJa || world?.nameJa || '風の世界';
  const coverImage = theme.coverImage || world?.backgroundImage || '/assets/eigo-quest/worlds/wind.png';
  const targetTotal = questionTotal || 20;
  const locked = Boolean(selectedChoice);
  const isListeningQuestion =
    question?.type === 'Listening' ||
    question?.type === 'listening' ||
    Boolean(question?.audioUrl);
  const isVocabularyMeaningQuestion = question?.type === 'en-ja';
  const targetWord = question?.word?.word || question?.word || '';
  const hasWordAudio = isVocabularyMeaningQuestion && Boolean(targetWord) && typeof onPlayAudio === 'function';

  const promptText = isListeningQuestion
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
            backgroundImage: `linear-gradient(rgba(4,8,24,.24), rgba(4,8,24,.7)), url(${coverImage})`,
          }}
        >
          <div className="eq-purify-crystal" aria-hidden="true" />
          <div className="eq-purify-header">
            <h1>{worldName}</h1>
            <p>単語クイズ</p>
            <div className="eq-purify-meta-row">
              <span>{questionIndex + 1} / {targetTotal}</span>
              <span>対象単語数 20 / 20</span>
            </div>
            {retryMode ? (
              <div className="eq-purify-retry-label">
                <span>まちがい浄化中</span>
                <strong>あと {retryRemaining} 問</strong>
              </div>
            ) : null}
          </div>

          <div className="eq-purify-prompt">
            <span className="eq-purify-question-label">QUESTION</span>
            <h2>
              {promptText}
              {hasWordAudio ? (
                <button
                  type="button"
                  className="eq-purify-word-speaker"
                  onClick={() => onPlayAudio?.(question)}
                  aria-label="単語の音声"
                >
                  ♪
                </button>
              ) : null}
            </h2>

            {isListeningQuestion ? (
              <button
                type="button"
                className="eq-purify-audio"
                onClick={() => onPlayAudio?.(question)}
                aria-label="音声を聞く"
              >
                ♪
              </button>
            ) : null}
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
              次へ
            </button>
          ) : null}
        </section>
      </EQMobileShell>

      <EQBottomNav />
    </div>
  );
}
