import { useState } from 'react';
import {
  EQBottomNav,
  EQMobileShell,
  EQPageHeader,
  EQPanel,
  EQPrimaryButton,
} from '../components/eigo';

export default function EssayCheckPage() {
  const [essayText, setEssayText] = useState('');

  const handleCheck = () => {
    console.log('[essay-check] draft essay:', essayText);
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
