import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkEssay, readWritingOcr } from '../api';
import { useChildren } from '../ChildrenContext';
import {
  EQBottomNav,
  EQMobileShell,
  EQPageHeader,
  EQPanel,
  EQPrimaryButton,
} from '../components/eigo';

const EMAIL_INSTRUCTION =
  'あなたは、外国人の知り合い Alex から、メールで質問を受け取りました。この質問にわかりやすく答える返信メールを40語〜50語で書きなさい。\n\n返信メールの中で、Alex のEメール文中の下線部について、あなたがより理解を深めるために、下線部の特徴を問う具体的な質問を2つしなさい。そのうえで、Alex の最後の質問に対するあなたの考えを書きなさい。';

const OPINION_INSTRUCTION =
  'あなたは、外国人の知り合いから以下の QUESTION をされました。QUESTION について、あなたの意見とその理由を2つ英語で書きなさい。語数の目安は50語〜60語です。';

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
  if (rawLevel === 'eiken3' || rawLevel.includes('3') || rawLevel.includes('３') || rawLevel.includes('三級')) return 'eiken3';
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
      <span className="border-b-2 border-[#ffe58f] pb-0.5 text-[#fff0b5]">{underlinedPart}</span>
      {after}
    </>
  );
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
  const pageTitle = isEmail ? 'ライティング（メール）' : 'ライティング（意見作文）';
  const textareaPlaceholder = isEmail ? EMAIL_PLACEHOLDER : OPINION_PLACEHOLDER;

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
      setError('写真の読み取りに失敗しました。もう一度試してください。');
    } finally {
      setIsReadingPhoto(false);
    }
  };

  return (
    <div className="eq-learning-hub-page">
      <EQMobileShell className="eq-learning-hub-screen eq-learning-hub-rpg-screen">
        <EQPageHeader
          eyebrow="Writing Practice"
          title="英検準2級 Writing Practice"
          subtitle="固定20問から選んで、AI先生にチェックしてもらおう"
          icon="AI"
        />

        <div className="grid gap-5 pb-28">
          <section className="grid gap-3 rounded-[24px] border border-[#d8b45a]/70 bg-[#06173c]/80 p-3 shadow-[0_0_22px_rgba(53,217,255,0.1)]">
            <div className="grid grid-cols-2 gap-2">
              {[
                ['email', 'Eメール'],
                ['opinion', '英作文'],
              ].map(([type, label]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => switchType(type)}
                  className={`min-h-11 rounded-2xl border px-3 text-sm font-black transition ${
                    selectedType === type
                      ? 'border-[#ffe58f] bg-[#123c8a] text-[#fff0b5] shadow-[0_0_18px_rgba(53,217,255,0.28)]'
                      : 'border-white/15 bg-white/5 text-white/75'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="rounded-2xl border border-[#d8b45a]/45 bg-[#081d4c]/75 px-3 py-3 text-sm font-black text-white" onClick={() => moveQuestion(-1)}>
                前の問題
              </button>
              <button type="button" className="rounded-2xl border border-[#d8b45a]/45 bg-[#081d4c]/75 px-3 py-3 text-sm font-black text-white" onClick={() => moveQuestion(1)}>
                次の問題
              </button>
              <button type="button" className="rounded-2xl border border-[#5de7ff]/45 bg-[#062c58]/75 px-3 py-3 text-sm font-black text-[#9feaff]" onClick={chooseRandomQuestion}>
                ランダム
              </button>
              <button type="button" className="rounded-2xl border border-[#ffb7c9]/45 bg-[#3b0d24]/65 px-3 py-3 text-sm font-black text-[#ffcad8]" onClick={() => setEssayText('')}>
                答えをクリア
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 px-1 text-xs font-black text-white/65">
              <span>
                QUESTION {currentIndex + 1} / {visibleQuestions.length}
              </span>
              <span>{currentQuestion.title}</span>
            </div>
          </section>

          <EQPanel title={pageTitle} tone="gold">
            <div className="grid gap-4">
              <p className="whitespace-pre-line text-sm font-bold leading-7 text-white/88">
                {currentQuestion.instructionJa}
              </p>

              {isEmail ? (
                <article className="rounded-[24px] border border-[#d8b45a]/70 bg-[#eef6ff]/95 p-5 text-[#14203d] shadow-[0_0_18px_rgba(53,217,255,0.12)]">
                  <p className="whitespace-pre-line text-base font-bold leading-8">
                    {renderEmailText(currentQuestion.emailText, currentQuestion.underlinedPart)}
                  </p>
                </article>
              ) : (
                <article className="rounded-[24px] border border-[#d8b45a]/70 bg-[#06173c]/85 p-5 shadow-[inset_0_0_22px_rgba(53,217,255,0.08)]">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#90e7ff]">
                    QUESTION
                  </p>
                  <p className="mt-3 text-xl font-black leading-8 text-[#fff0b5]">
                    {currentQuestion.question}
                  </p>
                </article>
              )}

              <p className="text-sm font-black text-[#9feaff]">
                語数の目安：{currentQuestion.wordLimit}
              </p>
            </div>
          </EQPanel>

          <EQPanel title="写真から読みとる" tone="cyan">
            <div className="grid gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoSelected}
              />
              <button
                type="button"
                onClick={handleReadPhotoClick}
                disabled={isReadingPhoto}
                className="rounded-2xl border border-[#d8b45a]/70 bg-[#0b1f56]/80 px-4 py-4 text-base font-black text-[#fff0b5] shadow-[0_0_18px_rgba(53,217,255,0.12)] active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isReadingPhoto ? '読み取り中...' : '写真を読み取る'}
              </button>
              <p className="text-sm font-bold leading-6 text-[#9feaff]">
                手書きの英作文を写真で読み取れます
              </p>
            </div>
          </EQPanel>

          <EQPanel title="英作文" tone="cyan">
            {isEmail ? (
              <div className="grid gap-3 rounded-[24px] border border-[#d8b45a]/55 bg-[#06173c]/75 p-4">
                <p className="text-base font-black leading-7 text-[#fff0b5]">
                  Hi, Alex!
                </p>
                <p className="text-base font-black leading-7 text-[#fff0b5]">
                  Thank you for your e-mail.
                </p>
                <textarea
                  value={essayText}
                  onChange={(event) => setEssayText(event.target.value)}
                  placeholder={textareaPlaceholder}
                  rows={8}
                  className="min-h-[220px] w-full resize-none rounded-[24px] border border-[#d8b45a]/80 bg-[#06173c]/90 px-5 py-4 text-[17px] font-bold leading-8 text-white shadow-[inset_0_0_24px_rgba(53,217,255,0.08),0_0_18px_rgba(255,211,90,0.08)] outline-none placeholder:text-white/45 focus:border-[#ffe58f] focus:shadow-[inset_0_0_24px_rgba(53,217,255,0.1),0_0_0_3px_rgba(255,211,90,0.16)]"
                />
                <p className="text-base font-black leading-7 text-[#fff0b5]">
                  Best wishes,
                </p>
              </div>
            ) : (
              <textarea
                value={essayText}
                onChange={(event) => setEssayText(event.target.value)}
                placeholder={textareaPlaceholder}
                rows={10}
                className="min-h-[260px] w-full resize-none rounded-[24px] border border-[#d8b45a]/80 bg-[#06173c]/90 px-5 py-4 text-[17px] font-bold leading-8 text-white shadow-[inset_0_0_24px_rgba(53,217,255,0.08),0_0_18px_rgba(255,211,90,0.08)] outline-none placeholder:text-white/45 focus:border-[#ffe58f] focus:shadow-[inset_0_0_24px_rgba(53,217,255,0.1),0_0_0_3px_rgba(255,211,90,0.16)]"
              />
            )}
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

          {isEiken3 ? (
            <p className="rounded-2xl border border-[#d8b45a]/60 bg-[#3b2a0d]/70 px-4 py-3 text-center text-sm font-black text-[#fff0b5]">
              英作文チェックは準2級から使えます
            </p>
          ) : null}

          <EQPrimaryButton
            type="button"
            fullWidth
            onClick={handleCheck}
            disabled={!essayText.trim() || isChecking || isEiken3}
          >
            {isChecking ? 'チェック中...' : 'AI先生に見てもらう'}
          </EQPrimaryButton>
        </div>
      </EQMobileShell>
      <EQBottomNav className="eq-learning-hub-bottom-nav" />
    </div>
  );
}
