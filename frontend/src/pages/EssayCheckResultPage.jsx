import { useLocation, useNavigate } from 'react-router-dom';
import {
  EQBottomNav,
  EQMobileShell,
  EQPageHeader,
  EQPanel,
  EQPrimaryButton,
} from '../components/eigo';

const fallbackResult = {
  total_score: 8,
  score: 82,
  scores: {
    content: 3,
    structure: 2,
    vocabulary: 2,
    grammar: 1,
  },
  good_points: [
    'テーマに合った内容で書けています。',
    '自分の考えが伝わっています。',
  ],
  needs_improvement: [
    '理由をもう少し具体的に書くと、もっとよくなります。',
  ],
  important_mistakes: [
    {
      child_text: 'It delicious.',
      problem_ja: 'be動詞の is がありません。',
      corrected_example: 'It is delicious.',
    },
  ],
  original_essay: 'My favorite food is ramen. It delicious. I eat it every Sunday.',
  improved_essay:
    'My favorite food is ramen. It is delicious and warm. I often eat it with my family on Sundays. I like ramen because it makes me happy and gives me energy.',
  original_word_count: 12,
  improved_word_count: 29,
  next_tip_ja: '次は理由をもう1文足してみましょう。',
};

const SCORE_LABELS = {
  content: '内容',
  structure: '構成',
  vocabulary: '語い',
  grammar: '文法',
};

function countWords(text) {
  return String(text || '')
    .trim()
    .match(/[A-Za-z]+(?:[-'][A-Za-z]+)?|\d+/g)?.length || 0;
}

function getArray(value, fallback = []) {
  return Array.isArray(value) && value.length ? value : fallback;
}

function normalizeMistakes(result) {
  const importantMistakes = getArray(result.important_mistakes, []);
  if (importantMistakes.length) {
    return importantMistakes.slice(0, 3).map((item) => ({
      child_text: item.child_text || item.before || '',
      problem_ja: item.problem_ja || item.explanation_ja || item.explanation || '',
      corrected_example: item.corrected_example || item.after || '',
    }));
  }

  return getArray(result.corrections, fallbackResult.important_mistakes).slice(0, 3).map((item) => ({
    child_text: item.child_text || item.before || '',
    problem_ja: item.problem_ja || item.explanation_ja || item.explanation || '',
    corrected_example: item.corrected_example || item.after || '',
  }));
}

function EssayTextBlock({ label, text, wordCount }) {
  return (
    <article className="eq-essay-result-text-block">
      {label ? <span>{label}</span> : null}
      <p>{text}</p>
      <small>{wordCount} words</small>
    </article>
  );
}

export default function EssayCheckResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const result = location.state || fallbackResult;
  const submittedEssay = result.essayText || result.essay_text || '';
  const originalEssay = result.original_essay || submittedEssay || fallbackResult.original_essay;
  const improvedEssay = result.improved_essay || result.better_essay || result.better_example || fallbackResult.improved_essay;
  const originalWordCount = Number(result.original_word_count) || countWords(originalEssay);
  const improvedWordCount = Number(result.improved_word_count) || countWords(improvedEssay);
  const scores = result.scores || fallbackResult.scores;
  const totalScore = Number(result.total_score);
  const legacyScore = Number(result.score);
  const goodPoints = getArray(result.good_points, fallbackResult.good_points);
  const needsImprovement = getArray(result.needs_improvement, fallbackResult.needs_improvement);
  const importantMistakes = normalizeMistakes(result);
  const nextTip = result.next_tip_ja || result.advice_ja || result.advice || fallbackResult.next_tip_ja;

  return (
    <div className="eq-learning-hub-page">
      <EQMobileShell className="eq-learning-hub-screen eq-learning-hub-rpg-screen">
        <EQPageHeader
          eyebrow="Essay Result"
          title="英作文チェック結果"
          subtitle="AI先生からのやさしいフィードバック"
          icon="AI"
        />

        <div className="eq-essay-result-stack">
          <EQPanel tone="gold" title="総合スコア">
            <div className="eq-essay-result-score">
              <strong>
                {Number.isFinite(totalScore) && totalScore > 0 ? totalScore : legacyScore || fallbackResult.total_score}
              </strong>
              <span>{Number.isFinite(totalScore) && totalScore > 0 ? '/16' : '/100'}</span>
            </div>
          </EQPanel>

          <EQPanel title="観点別スコア" tone="blue">
            <div className="eq-essay-result-rubric">
              {Object.entries(SCORE_LABELS).map(([key, label]) => (
                <div key={key}>
                  <span>{label}</span>
                  <strong>{Number(scores?.[key]) || 0}<small>/4</small></strong>
                </div>
              ))}
            </div>
          </EQPanel>

          <EQPanel title="子どもの作文" tone="purple">
            <EssayTextBlock text={originalEssay} wordCount={originalWordCount} />
          </EQPanel>

          <EQPanel title="改善版作文" tone="cyan">
            <EssayTextBlock text={improvedEssay} wordCount={improvedWordCount} />
          </EQPanel>

          <EQPanel title="Before / After" tone="gold">
            <div className="eq-essay-before-after">
              <EssayTextBlock label="Before" text={originalEssay} wordCount={originalWordCount} />
              <EssayTextBlock label="After" text={improvedEssay} wordCount={improvedWordCount} />
            </div>
          </EQPanel>

          <EQPanel title="よかったところ" tone="green">
            <ul className="eq-essay-result-list">
              {goodPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </EQPanel>

          <EQPanel title="直した方がいいところ" tone="cyan">
            <ul className="eq-essay-result-list">
              {needsImprovement.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </EQPanel>

          <EQPanel title="重要なミス" tone="purple">
            <div className="eq-essay-mistake-list">
              {importantMistakes.map((mistake, index) => (
                <article key={`${mistake.child_text}-${index}`}>
                  <span>子どもの英文</span>
                  <p>{mistake.child_text || '確認できませんでした。'}</p>
                  <span>どこが問題か</span>
                  <p>{mistake.problem_ja || 'もう一度見直してみましょう。'}</p>
                  <span>直した例</span>
                  <p>{mistake.corrected_example || '例文をもう一度確認しましょう。'}</p>
                </article>
              ))}
            </div>
          </EQPanel>

          <EQPanel title="次に気をつけること" tone="blue">
            <p className="eq-essay-next-tip">{nextTip}</p>
          </EQPanel>

          <div className="eq-essay-result-actions">
            <EQPrimaryButton type="button" fullWidth onClick={() => navigate('/essay-check')}>
              もう一度書く
            </EQPrimaryButton>
          </div>
        </div>
      </EQMobileShell>
      <EQBottomNav className="eq-learning-hub-bottom-nav" />
    </div>
  );
}
