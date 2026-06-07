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

  const handlePhotoAction = (source) => {
    console.log(`[essay-check] ${source} OCR placeholder`);
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

        <div className="grid gap-5 pb-28">
          <EQPanel title="今日のテーマ" tone="gold">
            <p className="text-2xl font-black leading-snug text-[#fff0b5]">
              My favorite food
            </p>
          </EQPanel>

          <EQPanel title="写真からよみとる" tone="cyan">
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handlePhotoAction('camera')}
                  className="rounded-2xl border border-[#d8b45a]/70 bg-[#0b1f56]/80 px-3 py-3 text-sm font-black text-[#fff0b5] shadow-[0_0_18px_rgba(53,217,255,0.12)] active:translate-y-[1px]"
                >
                  写真をとる
                </button>
                <button
                  type="button"
                  onClick={() => handlePhotoAction('album')}
                  className="rounded-2xl border border-[#d8b45a]/70 bg-[#0b1f56]/80 px-3 py-3 text-sm font-black text-[#fff0b5] shadow-[0_0_18px_rgba(53,217,255,0.12)] active:translate-y-[1px]"
                >
                  アルバムからえらぶ
                </button>
              </div>
              <p className="text-sm font-bold leading-6 text-[#9feaff]">
                手書きの英作文を写真で読み取れます
              </p>
            </div>
          </EQPanel>

          <EQPanel title="英作文" tone="cyan">
            <textarea
              value={essayText}
              onChange={(event) => setEssayText(event.target.value)}
              placeholder="ここに英作文を書いてね"
              rows={8}
              className="min-h-[220px] w-full resize-none rounded-[24px] border border-[#d8b45a]/80 bg-[#06173c]/90 px-5 py-4 text-[17px] font-bold leading-8 text-white shadow-[inset_0_0_24px_rgba(53,217,255,0.08),0_0_18px_rgba(255,211,90,0.08)] outline-none placeholder:text-white/45 focus:border-[#ffe58f] focus:shadow-[inset_0_0_24px_rgba(53,217,255,0.1),0_0_0_3px_rgba(255,211,90,0.16)]"
            />
          </EQPanel>

          <EQPrimaryButton
            type="button"
            fullWidth
            onClick={handleCheck}
            disabled={!essayText.trim()}
          >
            AI先生に見てもらう
          </EQPrimaryButton>
        </div>
      </EQMobileShell>
      <EQBottomNav className="eq-learning-hub-bottom-nav" />
    </div>
  );
}
