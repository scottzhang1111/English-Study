import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  EQBadge,
  EQInfoCard,
  EQMobileShell,
  EQPageHeader,
  EQPanel,
  EQPrimaryButton,
  EQSecondaryButton,
} from '../components/eigo';
import { getLearnedWords } from '../api';

const CHILD_STORAGE_KEY = 'selected_child_id';

function playAudio(text, audioRef) {
  if (!text) return;
  if (audioRef.current) {
    audioRef.current.pause();
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  }
}

export default function LearnedWordsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);
  const childId = localStorage.getItem(CHILD_STORAGE_KEY) || '';

  useEffect(() => {
    getLearnedWords(childId)
      .then(setData)
      .catch((err) => setError(err.message));

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [childId]);

  const words = data?.words || [];

  return (
    <div className="eq-learning-hub-page">
      <EQMobileShell className="eq-learning-hub-screen">
        <EQPageHeader
          eyebrow="Mastered Words"
          title="単語辞書館"
          subtitle={data?.child?.name ? `${data.child.name} のカード` : '覚えた単語'}
          icon="本"
        />

        {error && (
          <EQPanel title="読み込みエラー" tone="rose">
            <p className="eq-caption">{error}</p>
          </EQPanel>
        )}

        <EQPanel title={`${words.length} words`} eyebrow="Collection" tone="gold">
          <div className="flex flex-wrap gap-2">
            <EQBadge tone="gold">mastered</EQBadge>
            <EQBadge tone="cyan">{words.length} cards</EQBadge>
          </div>

          {words.length === 0 ? (
            <EQInfoCard title="まだ覚えた単語がありません" tone="cyan">
              まず「学習をはじめる」から進めましょう。
            </EQInfoCard>
          ) : (
            <div className="grid gap-4">
              {words.map((item, index) => (
                <motion.article
                  key={`${item.id}-${item.word}-${index}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: Math.min(index * 0.02, 0.18) }}
                >
                  <EQInfoCard
                    title={item.word}
                    value={item.jp}
                    tone="gold"
                    badges={
                      <>
                        {item.importance ? <EQBadge tone="cyan">重要度 {item.importance}</EQBadge> : null}
                        <EQBadge tone="gold">mastery {item.mastery || 100}%</EQBadge>
                      </>
                    }
                    footer={
                      <EQPrimaryButton type="button" onClick={() => playAudio(item.word, audioRef)} fullWidth>
                        単語を聞く
                      </EQPrimaryButton>
                    }
                  >
                    {item.cn && <p className="mt-2">中文: {item.cn}</p>}

                    {item.example && (
                      <EQPanel title="英文の例文" tone="cyan">
                        <p className="eq-caption">{item.example}</p>
                        <EQSecondaryButton type="button" onClick={() => playAudio(item.example, audioRef)} fullWidth>
                          例文を聞く
                        </EQSecondaryButton>
                      </EQPanel>
                    )}

                    {item.example_jp && (
                      <EQPanel title="例文の意味" tone="purple">
                        <p className="eq-caption">{item.example_jp}</p>
                      </EQPanel>
                    )}

                    {item.example_short && (
                      <EQPanel title="短い例文" tone="green">
                        <p className="eq-caption">{item.example_short}</p>
                      </EQPanel>
                    )}
                  </EQInfoCard>
                </motion.article>
              ))}
            </div>
          )}
        </EQPanel>
      </EQMobileShell>
    </div>
  );
}
