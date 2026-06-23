import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  getEikenInterviewFeedback,
  getEikenInterviewReadingFeedback,
  getEikenInterviewSet,
} from '../api';
import { useChildren } from '../ChildrenContext';
import {
  EQBottomNav,
  EQFantasyBadge,
  EQFantasyButton,
  EQFantasyCard,
  EQHeroHeader,
  EQPageShell,
} from '../components/eigo';

function isPre2Level(child) {
  const level = String(child?.targetLevel || child?.target_level || child?.learningGoal || child?.learning_goal || '').toLowerCase();
  return level === 'eiken_pre2' || level.includes('準2') || level.includes('準２');
}

function storageKey(childId, setId) {
  return `eiken_interview_practice_v1:${childId}:${setId}`;
}

function readPracticeState(childId, setId) {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey(childId, setId)) || '{}');
    return {
      answers: value.answers && typeof value.answers === 'object' ? value.answers : {},
      feedbacks: value.feedbacks && typeof value.feedbacks === 'object' ? value.feedbacks : {},
      readingTranscript: String(value.readingTranscript || ''),
      readingFeedback: value.readingFeedback && typeof value.readingFeedback === 'object' ? value.readingFeedback : null,
      step: Number.isInteger(value.step) ? value.step : 0,
    };
  } catch (err) {
    return { answers: {}, feedbacks: {}, readingTranscript: '', readingFeedback: null, step: 0 };
  }
}

function writePracticeState(childId, setId, answers, feedbacks, readingTranscript, readingFeedback, step) {
  try {
    sessionStorage.setItem(storageKey(childId, setId), JSON.stringify({
      answers,
      feedbacks,
      readingTranscript,
      readingFeedback,
      step,
    }));
  } catch (err) {
    // Practice still works in memory when sessionStorage is unavailable.
  }
}

function speakInterviewText(text) {
  const cleanText = String(text || '').trim();
  if (
    !cleanText
    || typeof window === 'undefined'
    || !window.speechSynthesis
    || !window.SpeechSynthesisUtterance
  ) {
    return false;
  }
  window.speechSynthesis.cancel();
  const utterance = new window.SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'en-US';
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
  return true;
}

function getQuestionSpeechText(question) {
  if (!question) return '';
  const pictureGuidance = Number(question.question_order) === 2
    ? 'Please look at the picture. '
    : '';
  return `${pictureGuidance}Question ${question.question_order}. ${question.question_text}`;
}

export default function InterviewPracticePage() {
  const { setId } = useParams();
  const navigate = useNavigate();
  const { children, childrenLoading, selectedChildId } = useChildren();
  const [interviewSet, setInterviewSet] = useState(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [feedbacks, setFeedbacks] = useState({});
  const [readingTranscript, setReadingTranscript] = useState('');
  const [readingFeedback, setReadingFeedback] = useState(null);
  const [isCheckingReading, setIsCheckingReading] = useState(false);
  const [readingMessage, setReadingMessage] = useState('');
  const [checkingQuestionKey, setCheckingQuestionKey] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [showModel, setShowModel] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [isReadingListening, setIsReadingListening] = useState(false);
  const [readingSpeechMessage, setReadingSpeechMessage] = useState('');
  const [isQuestionListening, setIsQuestionListening] = useState(false);
  const [questionSpeechMessage, setQuestionSpeechMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const guidanceSpokenRef = useRef(false);
  const spokenQuestionRef = useRef('');
  const recognitionRef = useRef(null);
  const currentChild = useMemo(
    () => children.find((child) => String(child.id) === String(selectedChildId)) || children[0],
    [children, selectedChildId],
  );
  const childId = currentChild?.id;
  const canPractice = isPre2Level(currentChild);
  const questions = interviewSet?.questions || [];
  const question = step > 0 ? questions[step - 1] : null;

  useEffect(() => {
    if (childrenLoading) return undefined;
    if (!canPractice) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError('');
    getEikenInterviewSet(setId)
      .then((payload) => {
        if (!active) return;
        const nextSet = payload.set || null;
        const saved = readPracticeState(childId, setId);
        const questionCount = nextSet?.questions?.length || 0;
        setInterviewSet(nextSet);
        setAnswers(saved.answers);
        setFeedbacks(saved.feedbacks);
        setReadingTranscript(saved.readingTranscript);
        setReadingFeedback(saved.readingFeedback);
        setStep(Math.min(Math.max(saved.step, 0), questionCount));
        setImageFailed(false);
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 401) {
          setError('ログインの有効期限が切れました。もう一度ログインしてください。');
        } else if (err.status === 404) {
          setError('面接セットが見つかりません');
        } else {
          setError(err.message || '面接セットを読み込めませんでした。');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [canPractice, childId, childrenLoading, setId]);

  useEffect(() => {
    if (loading || !canPractice || !interviewSet) return;
    if (step === 0 && !guidanceSpokenRef.current) {
      guidanceSpokenRef.current = true;
      speakInterviewText('Please read the passage aloud.');
      return;
    }
    const currentQuestion = interviewSet.questions?.[step - 1];
    if (!currentQuestion) return;
    const speechKey = `${interviewSet.id}:${currentQuestion.question_order}`;
    if (spokenQuestionRef.current === speechKey) return;
    spokenQuestionRef.current = speechKey;
    speakInterviewText(getQuestionSpeechText(currentQuestion));
  }, [canPractice, interviewSet, loading, step]);

  useEffect(() => () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
      recognitionRef.current = null;
    }
  }, []);

  if (childrenLoading || loading) return <div className="eq-interview-loading">読み込み中...</div>;

  if (!canPractice) {
    return (
      <EQPageShell className="eq-interview-page" withBottomNav>
        <EQHeroHeader title="英検準2級 面接練習" subtitle="この練習は英検準2級で利用できます。" />
        <EQFantasyButton as={Link} to="/learning-hub" fullWidth>学習メニューへ</EQFantasyButton>
      </EQPageShell>
    );
  }

  if (error || !interviewSet) {
    return (
      <EQPageShell className="eq-interview-page" withBottomNav>
        <p className="eq-interview-status is-error">{error || '面接セットが見つかりません。'}</p>
        <EQFantasyButton as={Link} to="/interview" fullWidth>セット一覧へ</EQFantasyButton>
      </EQPageShell>
    );
  }

  if (questions.length === 0) {
    return (
      <EQPageShell className="eq-interview-page" withBottomNav>
        <EQHeroHeader title={interviewSet.title} subtitle="面接問題を準備しています。" />
        <p className="eq-interview-status">準備中</p>
        <EQFantasyButton as={Link} to="/interview" fullWidth>セット一覧へ</EQFantasyButton>
      </EQPageShell>
    );
  }

  const answerKey = question ? String(question.question_order) : '';
  const legacyAnswerKey = question?.id ? String(question.id) : '';
  const currentAnswer = answers[answerKey] || answers[legacyAnswerKey] || '';
  const currentFeedback = feedbacks[answerKey] || feedbacks[legacyAnswerKey] || null;
  const isChecking = checkingQuestionKey === answerKey;

  function updateAnswer(value) {
    const next = { ...answers, [answerKey]: value };
    const nextFeedbacks = { ...feedbacks };
    delete nextFeedbacks[answerKey];
    if (legacyAnswerKey) delete nextFeedbacks[legacyAnswerKey];
    setAnswers(next);
    setFeedbacks(nextFeedbacks);
    setFeedbackMessage('');
    writePracticeState(childId, setId, next, nextFeedbacks, readingTranscript, readingFeedback, step);
  }

  async function checkAnswerWithAi() {
    const studentAnswer = currentAnswer.trim();
    if (!studentAnswer) {
      setFeedbackMessage('まず答えてね');
      return;
    }

    setCheckingQuestionKey(answerKey);
    setFeedbackMessage('');
    let feedback;
    try {
      feedback = await getEikenInterviewFeedback({
        childId,
        setId,
        questionOrder: question.question_order,
        questionText: question.question_text,
        studentAnswer,
        modelAnswer: question.model_answer,
        tipJa: question.tip_ja,
      });
    } catch (err) {
      feedback = {
        content_score: null,
        grammar_score: null,
        fluency_score: null,
        total_score: null,
        good_point_ja: '回答を保存しました。',
        fix_point_ja: 'AIチェックは現在利用できません。お手本を見て復習しましょう。',
        model_answer_en: question.model_answer,
        model_answer_ja: '',
      };
    } finally {
      setCheckingQuestionKey('');
    }
    const nextFeedbacks = { ...feedbacks, [answerKey]: feedback };
    setFeedbacks(nextFeedbacks);
    writePracticeState(childId, setId, answers, nextFeedbacks, readingTranscript, readingFeedback, step);
  }

  function updateReadingTranscript(value) {
    setReadingTranscript(value);
    setReadingFeedback(null);
    setReadingMessage('');
    writePracticeState(childId, setId, answers, feedbacks, value, null, step);
  }

  async function checkReadingWithAi() {
    const transcript = readingTranscript.trim();
    if (!transcript) {
      setReadingMessage('まず音読してね');
      return;
    }

    setIsCheckingReading(true);
    setReadingMessage('');
    let feedback;
    try {
      feedback = await getEikenInterviewReadingFeedback({
        childId,
        setId,
        transcript,
        passageText: interviewSet.passage_text,
      });
    } catch (err) {
      feedback = {
        reading_score: null,
        completion_score: null,
        pronunciation_score: null,
        fluency_score: null,
        confidence_score: null,
        good_point_ja: '音読を記録しました。最後まで読めたら大きな一歩です。',
        fix_point_ja: 'AIチェックは現在利用できません。もう一度ゆっくり読んでみよう。',
        try_again_phrase: '',
      };
    } finally {
      setIsCheckingReading(false);
    }
    setReadingFeedback(feedback);
    writePracticeState(childId, setId, answers, feedbacks, readingTranscript, feedback, step);
  }

  function stopReadingRecognition({ abort = false } = {}) {
    const recognition = recognitionRef.current;
    if (recognition) {
      if (abort) {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.abort();
        recognitionRef.current = null;
      } else {
        recognition.stop();
      }
    }
    setIsReadingListening(false);
  }

  function repeatQuestion() {
    if (!question) return;
    setQuestionSpeechMessage('');
    speakInterviewText(getQuestionSpeechText(question));
  }

  function stopQuestionRecognition({ abort = false } = {}) {
    const recognition = recognitionRef.current;
    if (recognition) {
      if (abort) {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.abort();
        recognitionRef.current = null;
      } else {
        recognition.stop();
      }
    }
    setIsQuestionListening(false);
  }

  function startQuestionRecognition() {
    if (typeof window === 'undefined' || !question) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setQuestionSpeechMessage('このブラウザでは音声入力を利用できません。文字で入力してね。');
      return;
    }

    stopQuestionRecognition({ abort: true });
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setQuestionSpeechMessage('');
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const parts = [];
      for (let index = 0; index < event.results.length; index += 1) {
        const part = event.results[index]?.[0]?.transcript?.trim();
        if (part) parts.push(part);
      }
      if (parts.length) updateAnswer(parts.join(' '));
    };
    recognition.onerror = () => {
      setQuestionSpeechMessage('このブラウザでは音声入力を利用できません。文字で入力してね。');
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setIsQuestionListening(false);
    };
    recognitionRef.current = recognition;
    setIsQuestionListening(true);
    try {
      recognition.start();
    } catch (err) {
      recognitionRef.current = null;
      setIsQuestionListening(false);
      setQuestionSpeechMessage('このブラウザでは音声入力を利用できません。文字で入力してね。');
    }
  }

  function repeatReadingGuidance() {
    setReadingSpeechMessage('');
    speakInterviewText('Please read the passage aloud.');
  }

  function startReadingRecognition() {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setReadingSpeechMessage('このブラウザでは音声入力を利用できません。文字で入力してね。');
      return;
    }

    stopReadingRecognition({ abort: true });
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setReadingSpeechMessage('');
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const parts = [];
      for (let index = 0; index < event.results.length; index += 1) {
        const part = event.results[index]?.[0]?.transcript?.trim();
        if (part) parts.push(part);
      }
      if (parts.length) updateReadingTranscript(parts.join(' '));
    };
    recognition.onerror = () => {
      setReadingSpeechMessage('このブラウザでは音声入力を利用できません。文字で入力してね。');
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setIsReadingListening(false);
    };
    recognitionRef.current = recognition;
    setIsReadingListening(true);
    try {
      recognition.start();
    } catch (err) {
      recognitionRef.current = null;
      setIsReadingListening(false);
      setReadingSpeechMessage('このブラウザでは音声入力を利用できません。文字で入力してね。');
    }
  }

  function goNext() {
    stopReadingRecognition({ abort: true });
    stopQuestionRecognition({ abort: true });
    if (step >= questions.length) {
      writePracticeState(childId, setId, answers, feedbacks, readingTranscript, readingFeedback, step);
      navigate(`/interview/result/${setId}`);
      return;
    }
    const nextStep = step + 1;
    writePracticeState(childId, setId, answers, feedbacks, readingTranscript, readingFeedback, nextStep);
    setStep(nextStep);
    setShowModel(false);
    setFeedbackMessage('');
    setQuestionSpeechMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <EQPageShell className="eq-interview-page" contentClassName="eq-interview-page-content" maxWidth="760px">
      <EQHeroHeader
        eyebrow={interviewSet.external_id}
        title={interviewSet.title}
        subtitle={step === 0 ? 'パッセージを声に出して読んでみよう' : `Question ${step} / ${questions.length}`}
        badges={[step === 0 ? 'PASSAGE' : `Q${step}`, `進行 ${step}/${questions.length}`]}
        className={step === 0 ? 'eq-interview-reading-hero' : ''}
      />

      {step === 0 ? (
        <>
          <EQFantasyCard eyebrow="READING MODE" title={interviewSet.passage_title} className="eq-interview-practice-card eq-interview-reading-card">
            <div className="eq-interview-reading-guidance">
              <div className="eq-interview-reading-guidance__copy">
                <span>🎙 Interviewer</span>
                <strong>Please read the passage aloud.</strong>
                <small>パッセージを声に出して読んでみよう</small>
              </div>
              <EQFantasyButton
                variant="blue"
                disabled={isReadingListening || isCheckingReading}
                onClick={repeatReadingGuidance}
              >
                🔊 もう一度聞く
              </EQFantasyButton>
            </div>

            <p className="eq-interview-passage">{interviewSet.passage_text}</p>

            <details className="eq-interview-reading-transcript">
              <summary>音声入力の結果</summary>
              <label className="eq-interview-answer-field">
                <span>認識結果を確認・修正できます</span>
                <textarea
                  value={readingTranscript}
                  onChange={(event) => updateReadingTranscript(event.target.value)}
                  placeholder="音声入力の結果がここに入ります。文字で入力しても大丈夫です。"
                  rows="6"
                  disabled={isReadingListening || isCheckingReading}
                />
              </label>
            </details>

            {readingSpeechMessage ? <p className="eq-interview-speech-message" role="status">{readingSpeechMessage}</p> : null}
            {readingMessage ? <p className="eq-interview-feedback-message" role="status">{readingMessage}</p> : null}

            {readingFeedback ? (
              <div className="eq-interview-ai-feedback eq-interview-reading-feedback" aria-live="polite">
                <div className="eq-interview-ai-feedback-heading">
                  <strong>Reading Feedback</strong>
                  <span>
                    {readingFeedback.reading_score == null
                      ? '記録済み'
                      : `${readingFeedback.reading_score} / 5`}
                  </span>
                </div>
                {readingFeedback.reading_score != null ? (
                  <p className="eq-interview-ai-feedback-scores">
                    Completion {readingFeedback.completion_score}/3 ・ Pronunciation {readingFeedback.pronunciation_score}/3 ・ Fluency {readingFeedback.fluency_score}/2 ・ Confidence {readingFeedback.confidence_score}/2
                  </p>
                ) : null}
                <dl>
                  <div><dt>よかったところ</dt><dd>{readingFeedback.good_point_ja}</dd></div>
                  <div><dt>直すところ</dt><dd>{readingFeedback.fix_point_ja}</dd></div>
                  {readingFeedback.try_again_phrase ? <div><dt>もう一度読むポイント</dt><dd>{readingFeedback.try_again_phrase}</dd></div> : null}
                </dl>
              </div>
            ) : null}
          </EQFantasyCard>

          <div className="eq-interview-reading-toolbar" aria-label="音読の操作">
            <div className="eq-interview-reading-actions">
              <EQFantasyButton
                fullWidth
                disabled={isReadingListening || isCheckingReading}
                onClick={startReadingRecognition}
              >
                🎤 音読開始
              </EQFantasyButton>
              <EQFantasyButton
                variant="blue"
                fullWidth
                className={isReadingListening ? 'is-listening' : ''}
                disabled={!isReadingListening}
                onClick={() => stopReadingRecognition()}
              >
                停止
              </EQFantasyButton>
              <EQFantasyButton
                variant="blue"
                fullWidth
                disabled={isReadingListening || isCheckingReading}
                onClick={checkReadingWithAi}
              >
                {isCheckingReading ? 'AIチェック中...' : 'AIチェック'}
              </EQFantasyButton>
              <EQFantasyButton
                fullWidth
                disabled={isReadingListening || isCheckingReading}
                onClick={goNext}
              >
                次へ
              </EQFantasyButton>
            </div>
          </div>
        </>
      ) : (
        <EQFantasyCard
          eyebrow={`QUESTION ${question?.question_order || step}`}
          title={question?.question_text}
          className="eq-interview-practice-card"
          actions={<EQFantasyBadge variant="blue">Q{question?.question_order || step}</EQFantasyBadge>}
        >
          {question?.question_order === 2 && interviewSet.image_url && !imageFailed ? (
            <img
              className="eq-interview-question-image"
              src={interviewSet.image_url}
              alt={`${interviewSet.title}のイラスト`}
              onError={() => setImageFailed(true)}
            />
          ) : null}
          {question?.question_order === 2 && (!interviewSet.image_url || imageFailed) ? (
            <p className="eq-interview-image-fallback" role="status">画像を読み込めませんでした。文章を参考に答えてみよう。</p>
          ) : null}

          <label className="eq-interview-answer-field">
            <span>あなたの答え</span>
            <textarea
              value={currentAnswer}
              onChange={(event) => updateAnswer(event.target.value)}
              placeholder="英語で答えを書いてみよう"
              rows="5"
              disabled={isQuestionListening || isChecking}
            />
          </label>

          <div className="eq-interview-question-actions">
            <EQFantasyButton
              fullWidth
              disabled={isQuestionListening || isChecking}
              onClick={startQuestionRecognition}
            >
              🎤 回答を録音
            </EQFantasyButton>
            <EQFantasyButton
              variant="blue"
              fullWidth
              className={isQuestionListening ? 'is-listening' : ''}
              disabled={!isQuestionListening}
              onClick={() => stopQuestionRecognition()}
            >
              停止
            </EQFantasyButton>
            <EQFantasyButton
              variant="blue"
              fullWidth
              disabled={isQuestionListening || isChecking}
              onClick={repeatQuestion}
            >
              🔊 もう一度聞く
            </EQFantasyButton>
            <EQFantasyButton
              variant="blue"
              fullWidth
              disabled={isQuestionListening || isChecking}
              onClick={checkAnswerWithAi}
            >
              {isChecking ? 'AIチェック中...' : 'AIチェック'}
            </EQFantasyButton>
          </div>

          {questionSpeechMessage ? <p className="eq-interview-speech-message" role="status">{questionSpeechMessage}</p> : null}
          {feedbackMessage ? <p className="eq-interview-feedback-message" role="status">{feedbackMessage}</p> : null}

          {currentFeedback ? (
            <div className="eq-interview-ai-feedback" aria-live="polite">
              <div className="eq-interview-ai-feedback-heading">
                <strong>AIフィードバック</strong>
                <span>{currentFeedback.total_score == null ? 'チェック済み' : `${currentFeedback.total_score} / 7`}</span>
              </div>
              {currentFeedback.total_score != null ? (
                <p className="eq-interview-ai-feedback-scores">
                  Content {currentFeedback.content_score}/3 ・ Grammar {currentFeedback.grammar_score}/2 ・ Fluency {currentFeedback.fluency_score}/2
                </p>
              ) : null}
              <dl>
                <div><dt>Good point</dt><dd>{currentFeedback.good_point_ja}</dd></div>
                <div><dt>Fix point</dt><dd>{currentFeedback.fix_point_ja}</dd></div>
                <div><dt>Better answer</dt><dd>{currentFeedback.model_answer_en || question.model_answer}</dd></div>
              </dl>
            </div>
          ) : null}

          <EQFantasyButton variant="blue" fullWidth onClick={() => setShowModel((value) => !value)}>
            {showModel ? 'お手本を閉じる' : 'お手本を見る'}
          </EQFantasyButton>

          {showModel ? (
            <div className="eq-interview-model-answer">
              <strong>お手本</strong>
              <p>{question?.model_answer}</p>
              <strong>答え方のコツ</strong>
              <p>{question?.tip_ja}</p>
            </div>
          ) : null}

          <EQFantasyButton fullWidth disabled={isChecking} onClick={goNext}>
            {step >= questions.length ? '練習結果を見る' : '次へ'}
          </EQFantasyButton>
        </EQFantasyCard>
      )}
      <EQBottomNav />
    </EQPageShell>
  );
}
