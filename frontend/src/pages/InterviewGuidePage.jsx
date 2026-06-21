import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { EQBackPill, EQBottomNav, EQMobileShell } from '../components/eigo';
import TtsButton from '../components/TtsButton';

const SCROLL_IMAGE = '/assets/eigo-quest/ui/grammar-scroll.png';

const CHAPTERS = [
  {
    title: '面接官が見ていること',
    englishTitle: 'What interviewers look for',
    explanation: '完璧な英語よりも、相手を見て、はっきり伝えようとする姿勢が大切です。笑顔・声の大きさ・返事の3つを意識しましょう。',
    examples: ['Yes, I understand.', 'Yes, I do.', 'No, I do not.'],
    tip: '答えが短くても、相手に届く声ではっきり言えれば大丈夫です。',
  },
  {
    title: '入室とあいさつ',
    englishTitle: 'Entering and greetings',
    explanation: '入室したら明るくあいさつし、指示を聞いてから座ります。退室するときもお礼を伝えると好印象です。',
    examples: ['May I come in?', 'Good afternoon.', 'Thank you very much. Goodbye.'],
    tip: 'ドアを閉めてから面接官を見て、落ち着いてあいさつしましょう。',
  },
  {
    title: '音読のコツ',
    englishTitle: 'Reading aloud tips',
    explanation: '句読点で短く区切り、急がずに読みます。知らない単語があっても止まらず、前後の文をつなげて読み切りましょう。',
    examples: ['Many people enjoy visiting parks.', 'They can learn many things there.'],
    tip: 'ピリオドでは一度止まり、文の最後まで声を小さくしないことが大切です。',
  },
  {
    title: 'Why問題の答え方',
    englishTitle: 'How to answer Why questions',
    explanation: '最初に Because と言い、本文から理由になる部分を見つけます。主語を質問に合わせて変えるのがポイントです。',
    examples: ['Because it is useful for students.', 'Because they want to help other people.'],
    tip: '本文の because や so の近くに、答えのヒントがあることが多いです。',
  },
  {
    title: '写真・イラスト問題の答え方',
    englishTitle: 'Picture questions',
    explanation: '「だれが・どこで・何をしている」の順に話します。迷ったら A man is ... / A woman is ... から始めましょう。',
    examples: ['A boy is riding a bicycle.', 'Two women are talking in the park.', 'She is going to open the window.'],
    tip: '今している動作は is ...ing、次にする動作は is going to ... で答えましょう。',
  },
  {
    title: '意見問題の答え方',
    englishTitle: 'Opinion questions',
    explanation: '最初に Yes / No で答え、そのあとに理由を一つ加えます。短くても、二文で答えることを目指しましょう。',
    examples: ['Yes, I do. It is fun and useful.', "No, I don't. I prefer studying at home."],
    tip: '「答え＋because＋理由」の形を一つ覚えておくと、どんな質問でも使えます。',
  },
  {
    title: '困ったときの救命フレーズ',
    englishTitle: 'Emergency phrases',
    explanation: '聞き取れなかったときは黙らず、もう一度お願いして大丈夫です。考える時間が必要なときも、短い一言で落ち着けます。',
    examples: ['Pardon?', 'Could you say that again, please?', 'Let me see.', 'I am sorry, I do not understand.'],
    tip: '聞き返しても減点を恐れず、黙ったままにならないことを優先しましょう。',
  },
];

export default function InterviewGuidePage() {
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);
  const [completed, setCompleted] = useState(() => new Set());
  const chapter = CHAPTERS[activeIndex];
  const allCompleted = completed.size === CHAPTERS.length;
  const progress = Math.round((completed.size / CHAPTERS.length) * 100);
  const combinedExamples = useMemo(() => chapter.examples.join(' '), [chapter]);

  const finishChapter = () => {
    setCompleted((current) => {
      const next = new Set(current);
      next.add(activeIndex);
      return next;
    });
    if (activeIndex < CHAPTERS.length - 1) {
      setActiveIndex((current) => current + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="eq-interview-guide-page">
      <EQMobileShell className="eq-interview-guide-shell">
        <header className="eq-interview-guide-header">
          <EQBackPill to="/learning-hub">学習メニューへ</EQBackPill>
          <div className="eq-interview-guide-heading">
            <div>
              <span>INTERVIEW GUIDE</span>
              <h1>英検準2級 面接の秘伝書</h1>
              <p>面接練習の前に、7つのコツを覚えよう</p>
            </div>
            <img src={SCROLL_IMAGE} alt="魔法の巻物" />
          </div>
          <div className="eq-interview-guide-progress" aria-label={`${completed.size} of ${CHAPTERS.length} chapters completed`}>
            <div><span>修了 {completed.size} / {CHAPTERS.length}</span><strong>{progress}%</strong></div>
            <div className="eq-interview-guide-progress-track"><span style={{ width: `${progress}%` }} /></div>
          </div>
        </header>

        <nav className="eq-interview-guide-chapters" aria-label="面接ガイドの章">
          {CHAPTERS.map((item, index) => (
            <button
              key={item.englishTitle}
              type="button"
              className={`${index === activeIndex ? 'is-active' : ''} ${completed.has(index) ? 'is-complete' : ''}`.trim()}
              onClick={() => setActiveIndex(index)}
              aria-current={index === activeIndex ? 'step' : undefined}
            >
              <span>{completed.has(index) ? '済' : index + 1}</span>
              <small>{item.title}</small>
            </button>
          ))}
        </nav>

        <motion.article
          key={chapter.englishTitle}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="eq-interview-scroll-card"
        >
          <div className="eq-interview-scroll-rail is-top" aria-hidden="true" />
          <div className="eq-interview-scroll-content">
            <span className="eq-interview-scroll-number">CHAPTER {activeIndex + 1}</span>
            <h2>{chapter.title}</h2>
            <p className="eq-interview-scroll-english">{chapter.englishTitle}</p>
            <p className="eq-interview-scroll-explanation">{chapter.explanation}</p>

            <aside className="eq-interview-tip-box">
              <strong>攻略のコツ</strong>
              <p>{chapter.tip}</p>
            </aside>

            <section className="eq-interview-example-box" aria-label="英語の例">
              <div className="eq-interview-example-heading">
                <h3>使えるフレーズ</h3>
                <TtsButton text={combinedExamples} label="音声を聞く" className="eq-interview-audio-button" />
              </div>
              {chapter.examples.map((example) => <p key={example}>{example}</p>)}
            </section>

            <button type="button" className="eq-interview-complete-button" onClick={finishChapter}>
              {completed.has(activeIndex) ? 'この章は修了しました' : 'この章を修了する'}
            </button>
          </div>
          <div className="eq-interview-scroll-rail is-bottom" aria-hidden="true" />
        </motion.article>

        {allCompleted ? (
          <motion.section initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} className="eq-interview-badge-unlock">
            <img src={SCROLL_IMAGE} alt="" />
            <span>BADGE UNLOCKED</span>
            <h2>面接見習い</h2>
            <p>7つの心得を修了しました。面接への準備ができました。</p>
          </motion.section>
        ) : null}

        <section className="eq-interview-practice-cta" aria-label="面接練習">
          <button type="button" onClick={() => navigate('/interview')}>面接練習へ進む</button>
          <p>秘伝を思い出しながら、本番の5問に挑戦しよう。</p>
        </section>
      </EQMobileShell>
      <EQBottomNav />
    </div>
  );
}
