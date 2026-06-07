import { useLocation, useNavigate } from 'react-router-dom';
import {
  EQBottomNav,
  EQMobileShell,
  EQPageHeader,
  EQPanel,
  EQPrimaryButton,
  EQSecondaryButton,
} from '../components/eigo';

const fallbackResult = {
  score: 82,
  stars: 4,
  good_points: [
    '3文でしっかり書けています',
    'テーマに合った内容です',
  ],
  corrections: [
    {
      before: 'It delicious.',
      after: 'It is delicious.',
      explanation_ja: 'be動詞の is を入れると自然です。',
    },
  ],
  advice_ja: 'とてもよく書けています。次は理由をもう1文足してみましょう。',
  better_essay:
    'My favorite food is ramen. It is delicious. I eat it every Sunday. I like hot ramen because it makes me happy.',
};

function StarRow({ count }) {
  return (
    <div className="flex items-center gap-1 text-3xl text-[#ffd35a]" aria-label={`${count} stars`}>
      {Array.from({ length: count }).map((_, index) => (
        <span key={index} aria-hidden="true">
          ★
        </span>
      ))}
    </div>
  );
}

export default function EssayCheckResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const result = location.state || fallbackResult;
  const reward = result.reward || { name: 'Magic Writing Star', coins: 50 };
  const advice = result.advice_ja || result.advice || fallbackResult.advice_ja;
  const betterEssay = result.better_essay || result.better_example || fallbackResult.better_essay;
  const goodPoints = result.good_points?.length ? result.good_points : fallbackResult.good_points;
  const corrections = result.corrections?.length ? result.corrections : fallbackResult.corrections;

  return (
    <div className="eq-learning-hub-page">
      <EQMobileShell className="eq-learning-hub-screen eq-learning-hub-rpg-screen">
        <EQPageHeader
          eyebrow="Essay Result"
          title="英作文チェック結果"
          subtitle="AI先生からのやさしいフィードバック"
          icon="AI"
        />

        <div className="grid gap-5">
          <EQPanel tone="gold">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-[#90e7ff]">
                  Score
                </p>
                <p className="text-4xl font-black text-[#fff0b5]">
                  {result.score}
                  <span className="text-xl text-white/70">/100</span>
                </p>
              </div>
              <StarRow count={result.stars || 0} />
            </div>
          </EQPanel>

          <EQPanel title="よかったところ" tone="green">
            <ul className="grid gap-3 text-base font-bold leading-7 text-white">
              {goodPoints.map((point) => (
                <li key={point} className="rounded-2xl border border-[#54e6a8]/35 bg-[#06173c]/60 px-4 py-3">
                  {point}
                </li>
              ))}
            </ul>
          </EQPanel>

          <EQPanel title="魔法のなおし" tone="cyan">
            <div className="grid gap-4">
              {corrections.map((correction) => (
                <article
                  key={`${correction.before}-${correction.after}`}
                  className="grid gap-3 rounded-[22px] border border-[#d8b45a]/45 bg-[#06173c]/70 p-4"
                >
                  <p className="text-sm font-black text-white/60">Before</p>
                  <p className="text-lg font-black text-[#ffb7c9]">{correction.before}</p>
                  <p className="text-sm font-black text-white/60">After</p>
                  <p className="text-lg font-black text-[#fff0b5]">{correction.after}</p>
                  <p className="text-sm font-bold leading-6 text-white/85">
                    {correction.explanation_ja || correction.explanation}
                  </p>
                </article>
              ))}
            </div>
          </EQPanel>

          <EQPanel title="AI先生からのアドバイス" tone="purple">
            <p className="text-base font-bold leading-8 text-white">{advice}</p>
          </EQPanel>

          <EQPanel title="もっと良くなる例" tone="blue">
            <p className="rounded-[22px] border border-white/15 bg-white/10 p-4 text-base font-bold leading-8 text-white">
              {betterEssay}
            </p>
          </EQPanel>

          <EQPanel title="ごほうび GET" tone="gold">
            <div className="flex items-center justify-between gap-4 rounded-[22px] border border-[#ffd35a]/55 bg-[#06173c]/70 p-4">
              <div>
                <p className="text-xl font-black text-[#fff0b5]">{reward.name}</p>
                <p className="text-sm font-bold text-white/75">Coins +{reward.coins}</p>
              </div>
              <span className="text-4xl" aria-hidden="true">
                ✦
              </span>
            </div>
          </EQPanel>

          <div className="grid gap-3 pb-28">
            <EQPrimaryButton type="button" fullWidth onClick={() => navigate('/essay-check')}>
              もう一度書く
            </EQPrimaryButton>
            <EQSecondaryButton type="button" fullWidth onClick={() => navigate('/learning-hub')}>
              Learning Hubにもどる
            </EQSecondaryButton>
          </div>
        </div>
      </EQMobileShell>
      <EQBottomNav className="eq-learning-hub-bottom-nav" />
    </div>
  );
}
