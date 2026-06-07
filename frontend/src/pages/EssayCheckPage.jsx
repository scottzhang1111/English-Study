import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EQBottomNav,
  EQMobileShell,
  EQPageHeader,
  EQPanel,
  EQPrimaryButton,
} from '../components/eigo';

const mockResult = {
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
      explanation: 'be動詞の is を入れると自然です。',
    },
  ],
  advice: 'とてもよく書けています。次は理由をもう1文足してみましょう。',
  better_example:
    'My favorite food is ramen. It is delicious. I eat it every Sunday. I like hot ramen because it makes me happy.',
  reward: {
    name: 'Magic Writing Star',
    coins: 50,
  },
};

export default function EssayCheckPage() {
  const navigate = useNavigate();
  const [essayText, setEssayText] = useState('');

  const handleCheck = () => {
    if (!essayText.trim()) return;

    navigate('/essay-check/result', {
      state: {
        ...mockResult,
        essayText,
      },
    });
  };

  return (
    <div className="eq-learning-hub-page">
      <EQMobileShell className="eq-learning-hub-screen eq-learning-hub-rpg-screen">
        <EQPageHeader
          eyebrow="AI Teacher"
          title="英作文チェック"
          subtitle="英語で書いた文章をAI先生に見てもらおう"
          icon="AI"
        />

        <div className="grid gap-5">
          <EQPanel title="今日のテーマ" tone="gold">
            <p className="text-2xl font-black leading-snug text-[#fff0b5]">
              My favorite food
            </p>
          </EQPanel>

          <EQPanel title="英作文" tone="cyan">
            <div className="grid gap-4">
              <textarea
                value={essayText}
                onChange={(event) => setEssayText(event.target.value)}
                placeholder="ここに英作文を書いてね"
                rows={8}
                className="min-h-[190px] w-full resize-none rounded-[22px] border border-[#d8b45a]/70 bg-[#06173c]/80 p-4 text-lg font-bold leading-8 text-white outline-none placeholder:text-white/45 focus:border-[#ffe58f] focus:shadow-[0_0_0_3px_rgba(255,211,90,0.14)]"
              />

              <EQPrimaryButton
                type="button"
                fullWidth
                onClick={handleCheck}
                disabled={!essayText.trim()}
              >
                AI先生に見てもらう
              </EQPrimaryButton>
            </div>
          </EQPanel>
        </div>
      </EQMobileShell>
      <EQBottomNav className="eq-learning-hub-bottom-nav" />
    </div>
  );
}
