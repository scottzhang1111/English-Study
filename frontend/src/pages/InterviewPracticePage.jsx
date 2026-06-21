import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getEikenInterviewFeedback, getEikenInterviewSet } from '../api';
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
      step: Number.isInteger(value.step) ? value.step : 0,
    };
  } catch (err) {
    return { answers: {}, feedbacks: {}, step: 0 };
  }
}

function writePracticeState(childId, setId, answers, feedbacks, step) {
  try {
    sessionStorage.setItem(storageKey(childId, setId), JSON.stringify({ answers, feedbacks, step }));
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

export default function InterviewPracticePage() {
  const { setId } = useParams();
  const navigate = useNavigate();
  const { children, childrenLoading, selectedChildId } = useChildren();
  const [interviewSet, setInterviewSet] = useState(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [feedbacks, setFeedbacks] = useState({});
  const [checkingQuestionKey, setCheckingQuestionKey] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [showModel, setShowModel] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechMessage, setSpeechMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const introSpokenRef = useRef(false);
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
    if (step === 0 && !introSpokenRef.current) {
      introSpokenRef.current = true;
      speakInterviewText("Hello. This is the Eiken Pre-2 Interview Test. Let's begin.");
      return;
    }
    const currentQuestion = interviewSet.questions?.[step - 1];
    if (!currentQuestion) return;
    const speechKey = `${interviewSet.id}:${currentQuestion.question_order}`;
    if (spokenQuestionRef.current === speechKey) return;
    spokenQuestionRef.current = speechKey;
    speakInterviewText(`Question ${currentQuestion.question_order}. ${currentQuestion.question_text}`);
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

  const answerKey = question ? String(question.id || question.question_order) : '';
  const currentAnswer = answers[answerKey] || '';
  const currentFeedback = feedbacks[answerKey] || null;
  const isChecking = checkingQuestionKey === answerKey;

  function updateAnswer(value) {
    const next = { ...answers, [answerKey]: value };
    const nextFeedbacks = { ...feedbacks };
    delete nextFeedbacks[answerKey];
    setAnswers(next);
    setFeedbacks(nextFeedbacks);
    setFeedbackMessage('');
    writePracticeState(childId, setId, next, nextFeedbacks, step);
  }

  async function checkAnswerWithAi() {
    const studentAnswer = currentAnswer.trim();
    if (!studentAnswer) {
      setFeedbackMessage('まず答えを書いてね');
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
    writePracticeState(childId, setId, answers, nextFeedbacks, step);
  }

  function stopSpeechRecognition() {
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }

  function repeatQuestion() {
    if (!question) return;
    setSpeechMessage('');
    speakInterviewText(`Question ${question.question_order}. ${question.question_text}`);
  }

  function startSpeechRecognition() {
    if (!question || typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechMessage('音声入力を利用できません');
      return;
    }

    stopSpeechRecognition();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setSpeechMessage('');
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) updateAnswer(transcript);
    };
    recognition.onerror = () => {
      setSpeechMessage('音声入力を利用できません');
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setIsListening(false);
    };
    recognitionRef.current = recognition;
    setIsListening(true);
    try {
      recognition.start();
    } catch (err) {
      recognitionRef.current = null;
      setIsListening(false);
      setSpeechMessage('音声入力を利用できません');
    }
  }

  function goNext() {
    stopSpeechRecognition();
    if (step >= questions.length) {
      writePracticeState(childId, setId, answers, feedbacks, step);
      navigate(`/interview/result/${setId}`);
      return;
    }
    const nextStep = step + 1;
    writePracticeState(childId, setId, answers, feedbacks, nextStep);
    setStep(nextStep);
    setShowModel(false);
    setFeedbackMessage('');
    setSpeechMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <EQPageShell className="eq-interview-page" contentClassName="eq-interview-page-content" maxWidth="760px">
      <EQHeroHeader
        eyebrow={interviewSet.external_id}
        title={interviewSet.title}
        subtitle={step === 0 ? 'まずはパッセージを落ち着いて音読しよう。' : `Question ${step} / ${questions.length}`}
        badges={[step === 0 ? 'PASSAGE' : `Q${step}`, `進行 ${step}/${questions.length}`]}
      />

      {step === 0 ? (
        <EQFantasyCard eyebrow="PASSAGE READING" title={interviewSet.passage_title} className="eq-interview-practice-card">
          <div className="eq-interview-passage-layout">
            <p className="eq-interview-passage">{interviewSet.passage_text}</p>
            <div className="eq-interview-passage-visual">
              {interviewSet.image_url && !imageFailed ? (
                <img
                  className="eq-interview-question-image eq-interview-passage-image"
                  src={interviewSet.image_url}
                  alt={`${interviewSet.title}のイラスト`}
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <p className="eq-interview-image-fallback" role="status">画像を読み込めませんでした。文章を参考に答えてみよう。</p>
              )}
            </div>
          </div>
          <EQFantasyButton fullWidth onClick={goNext}>次へ</EQFantasyButton>
        </EQFantasyCard>
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
              disabled={isChecking}
            />
          </label>

          <div className="eq-interview-speech-actions">
            <EQFantasyButton
              fullWidth
              disabled={isChecking || isListening}
              onClick={startSpeechRecognition}
            >
              {isListening ? '聞き取り中...' : '🎤 回答する'}
            </EQFantasyButton>
            <EQFantasyButton
              variant="blue"
              fullWidth
              disabled={isChecking || isListening}
              onClick={repeatQuestion}
            >
              🔊 もう一度聞く
            </EQFantasyButton>
          </div>

          {speechMessage ? <p className="eq-interview-speech-message" role="status">{speechMessage}</p> : null}

          {feedbackMessage ? <p className="eq-interview-feedback-message" role="status">{feedbackMessage}</p> : null}

          <EQFantasyButton
            variant="blue"
            fullWidth
            disabled={isChecking}
            onClick={checkAnswerWithAi}
          >
            {isChecking ? 'AIチェック中...' : 'AIチェック'}
          </EQFantasyButton>

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
                <div><dt>Model answer</dt><dd>{currentFeedback.model_answer_en || question.model_answer}</dd></div>
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
