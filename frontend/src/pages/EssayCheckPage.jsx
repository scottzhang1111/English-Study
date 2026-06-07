import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkEssay } from '../api';
import { useChildren } from '../ChildrenContext';
import {
  EQBottomNav,
  EQMobileShell,
  EQPageHeader,
  EQPanel,
  EQPrimaryButton,
} from '../components/eigo';

const ESSAY_TOPIC = 'My favorite food';

function formatLevel(child) {
  const rawLevel = child?.learningGoal || child?.learning_goal || child?.grade || child?.targetLevel || '';
  if (rawLevel === 'eiken_pre2') return '英検準2級';
  if (rawLevel === 'eiken3') return '英検3級';
  return rawLevel || '英検準2級';
}

export default function EssayCheckPage() {
  const navigate = useNavigate();
  const { children, selectedChildId } = useChildren();
  const [essayText, setEssayText] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState('');

  const currentChild = useMemo(
    () => children.find((child) => String(child.id) === String(selectedChildId)) || children[0] || null,
    [children, selectedChildId],
  );

  const handleCheck = async () => {
    const trimmedEssay = essayText.trim();
    if (!trimmedEssay || isChecking) return;

    setIsChecking(true);
    setError('');
    try {
      const result = await checkEssay({
        childId: currentChild?.id || selectedChildId,
        topic: ESSAY_TOPIC,
        essayText: trimmedEssay,
        level: formatLevel(currentChild),
      });
      navigate('/essay-check/result', {
        state: {
          ...result,
          essayText: trimmedEssay,
        },
      });
    } catch (err) {
      console.warn('[essay-check] essay check failed', err);
      setError('チェックに失敗しました。もう一度ためしてください。');
    } finally {
      setIsChecking(false);
    }
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
              {ESSAY_TOPIC}
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

          {isChecking ? (
            <p className="text-center text-sm font-black text-[#9feaff]">
              AI先生がチェックしています...
            </p>
          ) : null}

          {error ? (
            <p className="rounded-2xl border border-[#ff7a9a]/50 bg-[#3b0d24]/70 px-4 py-3 text-center text-sm font-black text-[#ffb7c9]">
              {error}
            </p>
          ) : null}

          <EQPrimaryButton
            type="button"
            fullWidth
            onClick={handleCheck}
            disabled={!essayText.trim() || isChecking}
          >
            {isChecking ? 'チェック中...' : 'AI先生に見てもらう'}
          </EQPrimaryButton>
        </div>
      </EQMobileShell>
      <EQBottomNav className="eq-learning-hub-bottom-nav" />
    </div>
  );
}
