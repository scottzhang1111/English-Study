import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkEssay, readWritingOcr } from '../api';
import { useChildren } from '../ChildrenContext';
import {
  EQ_ASSETS,
  EQFantasyBadge,
  EQFantasyButton,
  EQFantasyCard,
  EQHeroHeader,
  EQPageShell,
} from '../components/eigo';

const EMAIL_INSTRUCTION =
  'AlexからのEメールを読んで、返信メールを書きましょう。Alexに質問を2つして、最後の質問に対するあなたの考えも書きましょう。';

const OPINION_INSTRUCTION =
  'QUESTIONについて、あなたの意見と理由を2つ英語で書きましょう。';

const EMAIL_PLACEHOLDER =
  'I have two questions. First, __________? Second, __________?\nI think __________ because __________. Also, __________.';

const OPINION_PLACEHOLDER =
  'I think __________.\nFirst, __________. For example, __________.\nSecond, __________. For instance, __________.\nThat is why I think __________.';

const WRITING_QUESTIONS = [
  {
    id: 1,
    type: 'email',
    title: 'Factory Tour',
    instructionJa: EMAIL_INSTRUCTION,
    promptText: 'Factory Tour',
    emailText:
      'Hi!\n\nYesterday, my class visited a factory near our town. We saw machines and how products are made, and a worker explained the manufacturing process. It was noisy but interesting. Many students asked about jobs at the factory. Do you think factory tours will be popular?\n\nYour friend,\nAlex',
    underlinedPart: 'a factory near our town',
    question: 'Do you think factory tours will be popular?',
    wordLimit: '40〜50 words',
    rubricType: 'eiken_pre2_email',
  },
  {
    id: 2,
    type: 'email',
    title: 'Farm Visit',
    instructionJa: EMAIL_INSTRUCTION,
    promptText: 'Farm Visit',
    emailText:
      'Hi!\n\nLast month I visited a farm with my family. We saw animals, picked strawberries, and learned about how food grows. It was fun and I tried fresh milk. I want to visit again in spring. Do you think farm visits are becoming popular?\n\nYour friend,\nAlex',
    underlinedPart: 'a farm',
    question: 'Do you think farm visits are becoming popular?',
    wordLimit: '40〜50 words',
    rubricType: 'eiken_pre2_email',
  },
  {
    id: 3,
    type: 'email',
    title: 'Camping Trip',
    instructionJa: EMAIL_INSTRUCTION,
    promptText: 'Camping Trip',
    emailText:
      'Hi!\n\nLast weekend I went camping with my friends. We stayed in a tent near a small lake for two nights. Everyone helped cook meals over the campfire and we shared many stories. The weather was perfect for outdoor activities all day. Do you think camping trips will become more popular?\n\nYour friend,\nAlex',
    underlinedPart: 'camping',
    question: 'Do you think camping trips will become more popular?',
    wordLimit: '40〜50 words',
    rubricType: 'eiken_pre2_email',
  },
  {
    id: 4,
    type: 'email',
    title: 'Online English Lesson',
    instructionJa: EMAIL_INSTRUCTION,
    promptText: 'Online English Lesson',
    emailText:
      'Hi!\n\nRecently, I started taking online English lessons after school. My teacher lives in Canada, and we talk for thirty minutes twice a week. I can study at home, so it is very convenient. Do you think online lessons are good for students?\n\nYour friend,\nAlex',
    underlinedPart: 'online English lessons',
    question: 'Do you think online lessons are good for students?',
    wordLimit: '40〜50 words',
    rubricType: 'eiken_pre2_email',
  },
  {
    id: 5,
    type: 'email',
    title: 'School Volunteer Day',
    instructionJa: EMAIL_INSTRUCTION,
    promptText: 'School Volunteer Day',
    emailText:
      'Hi!\n\nLast Friday, my school had a volunteer day. We cleaned a park near our school and picked up a lot of trash. Some people in the town thanked us, so I felt very happy. Do you think students should join volunteer activities?\n\nYour friend,\nAlex',
    underlinedPart: 'a volunteer day',
    question: 'Do you think students should join volunteer activities?',
    wordLimit: '40〜50 words',
    rubricType: 'eiken_pre2_email',
  },
  {
    id: 6,
    type: 'email',
    title: 'New Library',
    instructionJa: EMAIL_INSTRUCTION,
    promptText: 'New Library',
    emailText:
      'Hi!\n\nA new library opened near my house last week. It has a large study space and many computers. Some students go there after school to do homework together. I think it is a useful place. Do you think more towns should build libraries?\n\nYour friend,\nAlex',
    underlinedPart: 'a large study space',
    question: 'Do you think more towns should build libraries?',
    wordLimit: '40〜50 words',
    rubricType: 'eiken_pre2_email',
  },
  {
    id: 7,
    type: 'email',
    title: 'Sports Festival',
    instructionJa: EMAIL_INSTRUCTION,
    promptText: 'Sports Festival',
    emailText:
      'Hi!\n\nYesterday, we had a sports festival at school. My class joined many events, such as running races and a ball game. We practiced for two weeks before the festival. Everyone cheered loudly and enjoyed the day. Do you think sports festivals are important for students?\n\nYour friend,\nAlex',
    underlinedPart: 'a sports festival',
    question: 'Do you think sports festivals are important for students?',
    wordLimit: '40〜50 words',
    rubricType: 'eiken_pre2_email',
  },
  {
    id: 8,
    type: 'email',
    title: 'Cooking Class',
    instructionJa: EMAIL_INSTRUCTION,
    promptText: 'Cooking Class',
    emailText:
      'Hi!\n\nLast Sunday, I joined a cooking class with my sister. We learned how to make pasta and salad from a professional cook. The class was not difficult, and the food tasted very good. Do you think children should learn how to cook?\n\nYour friend,\nAlex',
    underlinedPart: 'a cooking class',
    question: 'Do you think children should learn how to cook?',
    wordLimit: '40〜50 words',
    rubricType: 'eiken_pre2_email',
  },
  {
    id: 9,
    type: 'email',
    title: 'Museum Visit',
    instructionJa: EMAIL_INSTRUCTION,
    promptText: 'Museum Visit',
    emailText:
      'Hi!\n\nDuring the school trip, we visited a science museum. There were many interesting exhibitions about space, robots, and the environment. I especially liked the robot show because it was exciting. Do you think museums are good places for students to learn?\n\nYour friend,\nAlex',
    underlinedPart: 'a science museum',
    question: 'Do you think museums are good places for students to learn?',
    wordLimit: '40〜50 words',
    rubricType: 'eiken_pre2_email',
  },
  {
    id: 10,
    type: 'email',
    title: 'Community Event',
    instructionJa: EMAIL_INSTRUCTION,
    promptText: 'Community Event',
    emailText:
      'Hi!\n\nLast weekend, I joined a community event in my town. People sold food, played music, and introduced local history. I talked with many neighbors and made some new friends. Do you think community events are important?\n\nYour friend,\nAlex',
    underlinedPart: 'a community event',
    question: 'Do you think community events are important?',
    wordLimit: '40〜50 words',
    rubricType: 'eiken_pre2_email',
  },
  {
    id: 11,
    type: 'opinion',
    title: 'Family Dinner',
    instructionJa: OPINION_INSTRUCTION,
    promptText: 'Do you think families should have dinner together every night?',
    emailText: '',
    underlinedPart: '',
    question: 'Do you think families should have dinner together every night?',
    wordLimit: '50〜60 words',
    rubricType: 'eiken_pre2_opinion',
  },
  {
    id: 12,
    type: 'opinion',
    title: 'Smartphones at School',
    instructionJa: OPINION_INSTRUCTION,
    promptText: 'Do you think students should use smartphones at school?',
    emailText: '',
    underlinedPart: '',
    question: 'Do you think students should use smartphones at school?',
    wordLimit: '50〜60 words',
    rubricType: 'eiken_pre2_opinion',
  },
  {
    id: 13,
    type: 'opinion',
    title: 'Helping Parents',
    instructionJa: OPINION_INSTRUCTION,
    promptText: 'Do you think children should help their parents at home?',
    emailText: '',
    underlinedPart: '',
    question: 'Do you think children should help their parents at home?',
    wordLimit: '50〜60 words',
    rubricType: 'eiken_pre2_opinion',
  },
  {
    id: 14,
    type: 'opinion',
    title: 'Paper Books and E-books',
    instructionJa: OPINION_INSTRUCTION,
    promptText: 'Do you think it is better to read paper books than e-books?',
    emailText: '',
    underlinedPart: '',
    question: 'Do you think it is better to read paper books than e-books?',
    wordLimit: '50〜60 words',
    rubricType: 'eiken_pre2_opinion',
  },
  {
    id: 15,
    type: 'opinion',
    title: 'Homework Every Day',
    instructionJa: OPINION_INSTRUCTION,
    promptText: 'Do you think students should do homework every day?',
    emailText: '',
    underlinedPart: '',
    question: 'Do you think students should do homework every day?',
    wordLimit: '50〜60 words',
    rubricType: 'eiken_pre2_opinion',
  },
  {
    id: 16,
    type: 'opinion',
    title: 'Bicycles',
    instructionJa: OPINION_INSTRUCTION,
    promptText: 'Do you think people should use bicycles more often?',
    emailText: '',
    underlinedPart: '',
    question: 'Do you think people should use bicycles more often?',
    wordLimit: '50〜60 words',
    rubricType: 'eiken_pre2_opinion',
  },
  {
    id: 17,
    type: 'opinion',
    title: 'Cooking',
    instructionJa: OPINION_INSTRUCTION,
    promptText: 'Do you think children should learn how to cook?',
    emailText: '',
    underlinedPart: '',
    question: 'Do you think children should learn how to cook?',
    wordLimit: '50〜60 words',
    rubricType: 'eiken_pre2_opinion',
  },
  {
    id: 18,
    type: 'opinion',
    title: 'Online Shopping',
    instructionJa: OPINION_INSTRUCTION,
    promptText: 'Do you think online shopping is better than shopping at stores?',
    emailText: '',
    underlinedPart: '',
    question: 'Do you think online shopping is better than shopping at stores?',
    wordLimit: '50〜60 words',
    rubricType: 'eiken_pre2_opinion',
  },
  {
    id: 19,
    type: 'opinion',
    title: 'Sports Events',
    instructionJa: OPINION_INSTRUCTION,
    promptText: 'Do you think schools should have more sports events?',
    emailText: '',
    underlinedPart: '',
    question: 'Do you think schools should have more sports events?',
    wordLimit: '50〜60 words',
    rubricType: 'eiken_pre2_opinion',
  },
  {
    id: 20,
    type: 'opinion',
    title: 'Learning English',
    instructionJa: OPINION_INSTRUCTION,
    promptText: 'Do you think learning English is important for the future?',
    emailText: '',
    underlinedPart: '',
    question: 'Do you think learning English is important for the future?',
    wordLimit: '50〜60 words',
    rubricType: 'eiken_pre2_opinion',
  },
];

function formatLevel(child) {
  const rawLevel = child?.targetLevel || child?.target_level || child?.grade || '';
  if (rawLevel === 'eiken_pre2') return '英検準2級';
  if (rawLevel === 'eiken3') return '英検3級';
  return rawLevel || '英検準2級';
}

function getTargetLevelCode(child) {
  const rawLevel = child?.targetLevel || child?.target_level || child?.grade || '';
  if (rawLevel === 'eiken3' || rawLevel.includes('3') || rawLevel.includes('３') || rawLevel.includes('三')) return 'eiken3';
  return 'eiken_pre2';
}

function getQuestionsByType(type) {
  return WRITING_QUESTIONS.filter((question) => question.type === type);
}

function renderEmailText(emailText, underlinedPart) {
  if (!underlinedPart || !emailText.includes(underlinedPart)) return emailText;
  const [before, after] = emailText.split(underlinedPart);
  return (
    <>
      {before}
      <span className="eq-essay-underlined">{underlinedPart}</span>
      {after}
    </>
  );
}

function getMissionItems(type) {
  if (type === 'email') {
    return [
      'Alexに質問を2つする',
      '自分の意見を書く',
      '40〜50 wordsで書こう！',
    ];
  }
  return [
    '自分の考えを書く',
    '理由を2つ入れる',
    '50〜60 wordsで書こう！',
  ];
}

function getWritingTemplate(type) {
  if (type === 'email') {
    return [
      'Hi Alex!',
      'Thank you for your e-mail.',
      'I have two questions. First, __________? Second, __________?',
      'I think __________ because __________.',
      'Also, __________.',
      'Best wishes,',
    ].join('\n\n');
  }
  return [
    'I think __________.',
    'First, __________. For example, __________.',
    'Second, __________. For instance, __________.',
    'That is why I think __________.',
  ].join('\n\n');
}

function countWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

export default function EssayCheckPage() {
  const navigate = useNavigate();
  const { children, selectedChildId } = useChildren();
  const [essayText, setEssayText] = useState('');
  const [selectedType, setSelectedType] = useState('email');
  const [selectedQuestionId, setSelectedQuestionId] = useState(1);
  const [isChecking, setIsChecking] = useState(false);
  const [isReadingPhoto, setIsReadingPhoto] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const currentChild = useMemo(
    () => children.find((child) => String(child.id) === String(selectedChildId)) || null,
    [children, selectedChildId],
  );
  const isEiken3 = getTargetLevelCode(currentChild) === 'eiken3';

  const visibleQuestions = useMemo(() => getQuestionsByType(selectedType), [selectedType]);
  const currentQuestion = useMemo(
    () => WRITING_QUESTIONS.find((question) => question.id === selectedQuestionId) || visibleQuestions[0],
    [selectedQuestionId, visibleQuestions],
  );
  const currentIndex = visibleQuestions.findIndex((question) => question.id === currentQuestion.id);
  const isEmail = currentQuestion.type === 'email';
  const textareaPlaceholder = isEmail ? EMAIL_PLACEHOLDER : OPINION_PLACEHOLDER;
  const missionItems = getMissionItems(currentQuestion.type);
  const wordCount = countWords(essayText);

  const switchType = (type) => {
    setSelectedType(type);
    setSelectedQuestionId(getQuestionsByType(type)[0].id);
  };

  const moveQuestion = (direction) => {
    const nextIndex = (currentIndex + direction + visibleQuestions.length) % visibleQuestions.length;
    setSelectedQuestionId(visibleQuestions[nextIndex].id);
  };

  const chooseRandomQuestion = () => {
    const candidates = visibleQuestions.filter((question) => question.id !== currentQuestion.id);
    const pool = candidates.length ? candidates : visibleQuestions;
    const nextQuestion = pool[Math.floor(Math.random() * pool.length)];
    setSelectedQuestionId(nextQuestion.id);
  };

  const handleCheck = async () => {
    const trimmedEssay = essayText.trim();
    if (!trimmedEssay || isChecking || isEiken3) return;

    setIsChecking(true);
    setError('');
    try {
      const result = await checkEssay({
        childId: currentChild?.id || selectedChildId,
        topic: currentQuestion.promptText || currentQuestion.question || currentQuestion.title,
        essayText: trimmedEssay,
        level: formatLevel(currentChild),
        writingType: currentQuestion.type,
      });
      navigate('/essay-check/result', {
        state: {
          ...result,
          essayText: trimmedEssay,
          writingQuestion: currentQuestion,
        },
      });
    } catch (err) {
      console.warn('[essay-check] essay check failed', err);
      setError('チェックに失敗しました。もう一度ためしてください。');
    } finally {
      setIsChecking(false);
    }
  };

  const handleReadPhotoClick = () => {
    if (isReadingPhoto) return;
    fileInputRef.current?.click();
  };

  const handlePhotoSelected = async (event) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';
    if (!selectedFile) return;

    setIsReadingPhoto(true);
    setError('');
    try {
      const result = await readWritingOcr(selectedFile);
      setEssayText(result.text || '');
    } catch (err) {
      console.warn('[essay-check] writing OCR failed', err);
      setError('写真の読み取りに失敗しました。もう一度ためしてください。');
    } finally {
      setIsReadingPhoto(false);
    }
  };

  return (
    <EQPageShell
      className="eq-essay-page"
      contentClassName="eq-essay-page-content"
      withBottomNav
      bottomNavClassName="eq-learning-hub-bottom-nav"
      maxWidth="980px"
    >
      <EQHeroHeader
        eyebrow="AI"
        title="英検準2級 Writing Practice"
        subtitle="AI先生にチェックしてもらおう"
        bgImage={EQ_ASSETS.bg.learningHub}
        fairyImage={EQ_ASSETS.spirit.happy}
        badges={['Writing Quest', formatLevel(currentChild)]}
      />

      <section className="eq-essay-layout" aria-label="Writing practice">
        <div className="eq-essay-left-column">
          <EQFantasyCard hideHeader className="eq-essay-control-card">
            <div className="eq-essay-segmented" role="tablist" aria-label="Writing type">
              <button
                type="button"
                role="tab"
                aria-selected={selectedType === 'email'}
                className={selectedType === 'email' ? 'is-active' : ''}
                onClick={() => switchType('email')}
              >
                <span aria-hidden="true">✉</span>
                Eメール
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={selectedType === 'opinion'}
                className={selectedType === 'opinion' ? 'is-active' : ''}
                onClick={() => switchType('opinion')}
              >
                <span aria-hidden="true">▤</span>
                英作文
              </button>
            </div>

            <div className="eq-essay-question-strip">
              <EQFantasyButton variant="dark" trailingIcon="" onClick={() => moveQuestion(-1)} aria-label="前の問題">
                ←
              </EQFantasyButton>
              <EQFantasyButton variant="blue" trailingIcon="" onClick={chooseRandomQuestion} aria-label="ランダム">
                🎲
              </EQFantasyButton>
              <EQFantasyButton variant="dark" trailingIcon="" onClick={() => moveQuestion(1)} aria-label="次の問題">
                →
              </EQFantasyButton>
              <EQFantasyButton variant="dark" trailingIcon="" onClick={() => setEssayText('')}>
                クリア
              </EQFantasyButton>
            </div>

            <div className="eq-essay-question-meta">
              <span>QUESTION {currentIndex + 1} / {visibleQuestions.length}</span>
              <strong>{currentQuestion.title}</strong>
            </div>
          </EQFantasyCard>

          {isEmail ? (
            <EQFantasyCard
              className="eq-essay-email-card"
              eyebrow="FANTASY EMAIL"
              title="Alexからのメール"
              icon="✉"
              actions={<EQFantasyBadge variant="gold">Alex</EQFantasyBadge>}
            >
              <p>{renderEmailText(currentQuestion.emailText, currentQuestion.underlinedPart)}</p>
            </EQFantasyCard>
          ) : (
            <EQFantasyCard
              className="eq-essay-email-card"
              eyebrow="QUESTION"
              title={currentQuestion.title}
              icon="?"
              actions={<EQFantasyBadge variant="blue">Opinion</EQFantasyBadge>}
            >
              <p>{currentQuestion.question}</p>
            </EQFantasyCard>
          )}

          <section className="eq-essay-mission-card" aria-labelledby="essay-mission-title">
            <h2 id="essay-mission-title">☆ QUEST MISSION</h2>
            <ul>
              {missionItems.map((item) => (
                <li key={item}>
                  <span aria-hidden="true">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section className="eq-essay-scroll-card" aria-labelledby="essay-scroll-title">
            <h2 id="essay-scroll-title">Writing Scroll（書き出しのヒント）</h2>
            <pre>{getWritingTemplate(currentQuestion.type)}</pre>
          </section>
        </div>

        <div className="eq-essay-right-column">
          <EQFantasyCard
            className="eq-essay-writing-card"
            title="英作文を書く"
            icon="✍"
            actions={<EQFantasyBadge variant="blue">{currentQuestion.wordLimit}</EQFantasyBadge>}
          >
            <label className="eq-essay-textarea-wrap">
              <textarea
                value={essayText}
                onChange={(event) => setEssayText(event.target.value)}
                placeholder="ここに英作文を書こう！"
                rows={12}
              />
              <span>{wordCount} / 200 words</span>
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoSelected}
            />

            <EQFantasyButton
              type="button"
              variant="blue"
              fullWidth
              onClick={handleReadPhotoClick}
              disabled={isReadingPhoto}
              trailingIcon=""
            >
              {isReadingPhoto ? '読み取り中...' : '📷 写真から読み取る'}
            </EQFantasyButton>

            {isChecking ? (
              <p className="eq-essay-status">AI先生がチェックしています...</p>
            ) : null}

            {error ? (
              <p className="eq-essay-error">{error}</p>
            ) : null}

            {isEiken3 ? (
              <p className="eq-essay-notice">英作文チェックは準2級から使えます。</p>
            ) : null}

            <EQFantasyButton
              type="button"
              fullWidth
              className="eq-essay-submit-button"
              onClick={handleCheck}
              disabled={!essayText.trim() || isChecking || isEiken3}
            >
              {isChecking ? 'AI先生が確認中...' : 'AI先生に提出する'}
            </EQFantasyButton>
          </EQFantasyCard>

          <EQFantasyCard
            className="eq-essay-tips-card"
            eyebrow="WRITING TIPS"
            title="書くときのポイント"
            icon="💡"
          >
            <ul>
              <li>丁寧な表現を使おう</li>
              <li>質問は「？」を忘れずに書こう</li>
              <li>自分の意見を理由と一緒に書こう</li>
              <li>語数を確認しよう</li>
            </ul>
          </EQFantasyCard>
        </div>
      </section>
    </EQPageShell>
  );
}
