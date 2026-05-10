import { useState } from 'react';

const TYPE_LABELS = {
  sentence_fill: '短句填空',
  dialogue_completion: '対話完成',
  reading: '読解',
  reading_comprehension: 'reading_comprehension',
};

const OPTION_KEYS = ['A', 'B', 'C', 'D'];

function getOptions(question) {
  if (Array.isArray(question.options) && question.options.length > 0) {
    return question.options.map((option) => ({
      key: option.key || option.option,
      text: option.text,
      text_ja: option.text_ja,
    }));
  }
  if (Array.isArray(question.choices) && question.choices.length > 0) {
    return question.choices.map((option) => ({
      key: option.key || option.option,
      text: option.text,
      text_ja: option.text_ja,
    }));
  }
  return OPTION_KEYS.map((key) => ({
    key,
    text: question[`option_${key}`],
    text_ja: question[`option_${key}_ja`],
  })).filter((option) => option.text);
}

function optionLabel(question, key) {
  if (!key) return '未回答';
  const option = getOptions(question).find((item) => item.key === key);
  return `${key}. ${option?.text || ''}`.trim();
}

function InfoBlock({ title, children, tone = 'blue' }) {
  const toneClass =
    tone === 'yellow'
      ? 'bg-[#fff8d9] text-[#5f563a] shadow-[inset_0_0_0_1px_rgba(255,210,83,0.22)]'
      : 'bg-[#f7fbff] text-[#405174] shadow-[inset_0_0_0_1px_rgba(132,173,222,0.18)]';
  const titleClass = tone === 'yellow' ? 'text-[#8a7330]' : 'text-[#6176aa]';

  return (
    <div className={`rounded-[20px] p-4 ${toneClass}`}>
      <p className={`text-sm font-black ${titleClass}`}>{title}</p>
      <div className="mt-2 whitespace-pre-line text-base font-bold leading-7">{children}</div>
    </div>
  );
}

export default function WrongQuestionCard({ question, mode = 'review', selectedAnswer, locked = true, onSelect }) {
  const [showPassageJa, setShowPassageJa] = useState(false);
  const options = getOptions(question);
  const isPractice = mode === 'practice';
  const revealAnswer = !isPractice || locked;
  const answerForMark = isPractice ? selectedAnswer : question.student_answer;
  const passage = question.passage || {};
  const passageText = question.passage_text || passage.passage_text || '';
  const passageTextJa = question.passage_text_ja || passage.passage_text_ja || '';
  const passageTitle = question.passage_title || passage.title || '';
  const passageTitleJa = question.passage_title_ja || passage.title_ja || '';

  return (
    <article className="rounded-[24px] bg-white/82 p-5 shadow-[0_10px_22px_rgba(145,177,209,0.09)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[#eef8ff] px-3 py-1 text-xs font-black text-[#6176aa]">
          {TYPE_LABELS[question.question_type] || question.question_type || question.section || '問題'}
        </span>
        {question.weak_point_tag && (
          <span className="rounded-full bg-[#fff2bb] px-3 py-1 text-xs font-black text-[#69557e]">
            {question.weak_point_tag}
          </span>
        )}
        {question.wrong_count && (
          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#8fa0c2]">
            まちがい {question.wrong_count} 回
          </span>
        )}
      </div>

      <h4 className="display-font mt-4 text-xl font-extrabold text-[#354172]">問題をもう一度見てみよう</h4>

      {passageTitle && (
        <div className="mt-3 rounded-[20px] bg-[#f8fcff] p-4">
          <p className="text-sm font-black text-[#6f7da8]">
            {passageTitle}
            {passageTitleJa ? ` / ${passageTitleJa}` : ''}
          </p>
          {passageText && <p className="mt-2 whitespace-pre-line text-sm font-semibold leading-7 text-[#52668c]">{passageText}</p>}
          {passageTextJa && (
            <button type="button" onClick={() => setShowPassageJa((value) => !value)} className="ghost-button mt-3 px-4 py-2 text-sm">
              {showPassageJa ? '本文の日本語訳を閉じる' : '本文の日本語訳を見る'}
            </button>
          )}
          {showPassageJa && (
            <p className="mt-3 whitespace-pre-line rounded-[16px] bg-white/78 p-4 text-sm font-semibold leading-7 text-[#52668c]">
              {passageTextJa}
            </p>
          )}
        </div>
      )}

      <p className="mt-4 whitespace-pre-line text-lg font-extrabold leading-8 text-[#354172]">
        {question.question_text || question.prompt}
      </p>

      <div className="mt-4 grid gap-3">
        {options.map((option) => {
          const isCorrect = revealAnswer && option.key === question.correct_option;
          const isStudentWrong = revealAnswer && answerForMark === option.key && option.key !== question.correct_option;
          const isSelected = isPractice && selectedAnswer === option.key;
          const style = isCorrect
            ? 'border-[#91d39f] bg-[#f0fbf2] text-[#2f6445]'
            : isStudentWrong
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : isSelected
                ? 'border-[#ffd253] bg-[#fff4bf] text-[#5d4d77]'
                : 'border-white/80 bg-[#f8fcff] text-[#354172]';

          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onSelect?.(option.key)}
              disabled={!isPractice || locked}
              className={`rounded-[20px] border px-4 py-3 text-left font-bold transition ${style}`}
            >
              <span className="mr-2 font-black">{option.key}.</span>
              {option.text}
              {isCorrect && <span className="ml-3 rounded-full bg-white/78 px-2 py-1 text-xs font-black text-[#2f6445]">正解</span>}
              {isStudentWrong && <span className="ml-3 rounded-full bg-white/78 px-2 py-1 text-xs font-black text-rose-700">あなたの答え</span>}
            </button>
          );
        })}
      </div>

      {revealAnswer && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[18px] bg-rose-50 p-4 text-sm font-black text-rose-700">
            あなたの答え：{optionLabel(question, answerForMark)}
          </div>
          <div className="rounded-[18px] bg-[#f0fbf2] p-4 text-sm font-black text-[#2f6445]">
            正しい答え：{optionLabel(question, question.correct_option)}
          </div>
        </div>
      )}

      {revealAnswer && (
        <div className="mt-4 space-y-3">
          <InfoBlock title="選択肢の意味">
            {options.map((option) => `${option.key}. ${option.text} = ${option.text_ja || '未登録'}`).join('\n')}
          </InfoBlock>

          <InfoBlock title="文の意味">
            {question.question_text_ja || '文の日本語訳はまだ準備中です。'}
          </InfoBlock>

          <InfoBlock title="なぜこの答え？">
            {question.explanation_ja || '解説はまだ準備中です。'}
          </InfoBlock>

          {question.vocabulary_notes_ja && (
            <InfoBlock title="単語・表現" tone="yellow">
              {question.vocabulary_notes_ja}
            </InfoBlock>
          )}
        </div>
      )}
    </article>
  );
}
