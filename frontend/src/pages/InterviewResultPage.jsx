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

function readAnswers(childId, setId) {
  try {
    const key = `eiken_interview_practice_v1:${childId}:${setId}`;
    const value = JSON.parse(sessionStorage.getItem(key) || '{}');
    return value.answers && typeof value.answers === 'object' ? value.answers : {};
  } catch (err) {
    return {};
  }
}

export default function InterviewResultPage() {
  const { setId } = useParams();
  const navigate = useNavigate();
  const { children, childrenLoading, selectedChildId } = useChildren();
  const [interviewSet, setInterviewSet] = useState(null);
  const [answers, setAnswers] = useState({});
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
        setAnswers(readAnswers(currentChild?.id, setId));
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

      <section className="eq-interview-result-list" aria-label="回答一覧">
        {(interviewSet.questions || []).map((question) => {
          const answer = answers[String(question.id || question.question_order)]?.trim();
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
