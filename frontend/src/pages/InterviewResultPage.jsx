import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getEikenInterviewSet } from '../api';
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

function readPracticeState(childId, setId) {
  try {
    const key = `eiken_interview_practice_v1:${childId}:${setId}`;
    const value = JSON.parse(sessionStorage.getItem(key) || '{}');
    return {
      answers: value.answers && typeof value.answers === 'object' ? value.answers : {},
      feedbacks: value.feedbacks && typeof value.feedbacks === 'object' ? value.feedbacks : {},
      readingTranscript: String(value.readingTranscript || ''),
      readingFeedback: value.readingFeedback && typeof value.readingFeedback === 'object' ? value.readingFeedback : null,
    };
  } catch (err) {
    return { answers: {}, feedbacks: {}, readingTranscript: '', readingFeedback: null };
  }
}

export default function InterviewResultPage() {
  const { setId } = useParams();
  const navigate = useNavigate();
  const { children, childrenLoading, selectedChildId } = useChildren();
  const [interviewSet, setInterviewSet] = useState(null);
  const [answers, setAnswers] = useState({});
  const [feedbacks, setFeedbacks] = useState({});
  const [readingTranscript, setReadingTranscript] = useState('');
  const [readingFeedback, setReadingFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const currentChild = useMemo(
    () => children.find((child) => String(child.id) === String(selectedChildId)) || children[0],
    [children, selectedChildId],
  );
  const canPractice = isPre2Level(currentChild);

  useEffect(() => {
    if (childrenLoading) return undefined;
    if (!canPractice) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    getEikenInterviewSet(setId)
      .then((payload) => {
        if (!active) return;
        setInterviewSet(payload.set || null);
        const saved = readPracticeState(currentChild?.id, setId);
        setAnswers(saved.answers);
        setFeedbacks(saved.feedbacks);
        setReadingTranscript(saved.readingTranscript);
        setReadingFeedback(saved.readingFeedback);
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 401) {
          setError('ログインの有効期限が切れました。もう一度ログインしてください。');
        } else if (err.status === 404) {
          setError('面接セットが見つかりません');
        } else {
          setError(err.message || '練習結果を読み込めませんでした。');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [canPractice, childrenLoading, currentChild?.id, setId]);

  if (childrenLoading || loading) return <div className="eq-interview-loading">読み込み中...</div>;

  if (!canPractice || error || !interviewSet) {
    return (
      <EQPageShell className="eq-interview-page" withBottomNav>
        <p className={`eq-interview-status ${error ? 'is-error' : ''}`}>
          {error || (!canPractice ? 'この練習は英検準2級で利用できます。' : '面接セットが見つかりません。')}
        </p>
        <EQFantasyButton as={Link} to="/interview" fullWidth>セット一覧へ</EQFantasyButton>
      </EQPageShell>
    );
  }

  function restartPractice() {
    try {
      sessionStorage.removeItem(`eiken_interview_practice_v1:${currentChild?.id}:${setId}`);
    } catch (err) {
      // The next practice still starts normally when sessionStorage is unavailable.
    }
    navigate(`/interview/${setId}`);
  }

  if ((interviewSet.questions || []).length === 0) {
    return (
      <EQPageShell className="eq-interview-page" withBottomNav>
        <EQHeroHeader title={interviewSet.title} subtitle="面接問題を準備しています。" />
        <p className="eq-interview-status">準備中</p>
        <EQFantasyButton as={Link} to="/interview" fullWidth>セット一覧へ</EQFantasyButton>
      </EQPageShell>
    );
  }

  return (
    <EQPageShell className="eq-interview-page" contentClassName="eq-interview-page-content" maxWidth="820px">
      <EQHeroHeader
        eyebrow="PRACTICE RESULT"
        title="今回の練習結果"
        subtitle={`${interviewSet.title} の答えを、お手本と見比べてみよう。`}
        badges={['5問', '自己チェック']}
      />

      <EQFantasyCard
        eyebrow="PASSAGE READING"
        title={interviewSet.passage_title}
        actions={<EQFantasyBadge variant="blue">音読</EQFantasyBadge>}
        className="eq-interview-result-card"
      >
        <div className="eq-interview-result-block is-child">
          <strong>音読の記録</strong>
          <p>{readingTranscript.trim() || '未入力'}</p>
        </div>
        {readingFeedback ? (
          <div className="eq-interview-result-feedback eq-interview-reading-result-feedback">
            <div>
              <strong>Reading Feedback</strong>
              <span>{readingFeedback.reading_score == null ? '記録済み' : `${readingFeedback.reading_score} / 10`}</span>
            </div>
            {readingFeedback.reading_score != null ? (
              <small>
                Completion {readingFeedback.completion_score}/3 ・ Pronunciation {readingFeedback.pronunciation_score}/3 ・ Fluency {readingFeedback.fluency_score}/2 ・ Confidence {readingFeedback.confidence_score}/2
              </small>
            ) : null}
            <p><b>Good point</b>{readingFeedback.good_point_ja}</p>
            <p><b>Fix point</b>{readingFeedback.fix_point_ja}</p>
            {readingFeedback.try_again_phrase ? <p><b>Try again</b>{readingFeedback.try_again_phrase}</p> : null}
          </div>
        ) : null}
      </EQFantasyCard>

      <section className="eq-interview-result-list" aria-label="回答一覧">
        {(interviewSet.questions || []).map((question) => {
          const answerKey = String(question.question_order);
          const legacyAnswerKey = question.id ? String(question.id) : '';
          const answer = (answers[answerKey] || answers[legacyAnswerKey] || '').trim();
          const feedback = feedbacks[answerKey] || feedbacks[legacyAnswerKey];
          return (
            <EQFantasyCard
              key={question.id}
              eyebrow={`QUESTION ${question.question_order}`}
              title={question.question_text}
              actions={<EQFantasyBadge variant="blue">Q{question.question_order}</EQFantasyBadge>}
              className="eq-interview-result-card"
            >
              <div className="eq-interview-result-block is-child">
                <strong>あなたの答え</strong>
                <p>{answer || '未入力'}</p>
              </div>
              <div className="eq-interview-result-block">
                <strong>お手本</strong>
                <p>{question.model_answer}</p>
              </div>
              <div className="eq-interview-result-tip">
                <strong>答え方のコツ</strong>
                <p>{question.tip_ja}</p>
              </div>
              {feedback ? (
                <div className="eq-interview-result-feedback">
                  <div>
                    <strong>AIフィードバック</strong>
                    <span>{feedback.total_score == null ? 'チェック済み' : `${feedback.total_score} / 7`}</span>
                  </div>
                  {feedback.total_score != null ? (
                    <small>Content {feedback.content_score}/3 ・ Grammar {feedback.grammar_score}/2 ・ Fluency {feedback.fluency_score}/2</small>
                  ) : null}
                  <p><b>Good point</b>{feedback.good_point_ja}</p>
                  <p><b>Fix point</b>{feedback.fix_point_ja}</p>
                  <p><b>Better answer</b>{feedback.model_answer_en || question.model_answer}</p>
                  {feedback.model_answer_ja ? <p><b>日本語</b>{feedback.model_answer_ja}</p> : null}
                </div>
              ) : null}
            </EQFantasyCard>
          );
        })}
      </section>

      <div className="eq-interview-result-actions">
        <EQFantasyButton fullWidth onClick={restartPractice}>もう一度練習する</EQFantasyButton>
        <EQFantasyButton as={Link} to="/interview" variant="blue" fullWidth>セット一覧へ</EQFantasyButton>
      </div>
      <EQBottomNav />
    </EQPageShell>
  );
}
