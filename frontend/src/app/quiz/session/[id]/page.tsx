"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { v2API } from '@/services/api';

type QuizChoice = { text_ja: string; is_correct: boolean };
type QuizWord = { word_id: string; text_en: string; part_of_speech?: string | null };
type QuizQuestion = { order: number; word: QuizWord; choices: QuizChoice[] };

export default function QuizSessionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session, status } = useSession();
  const token = session?.backendAccessToken || '';

  // ローディング・エラー
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // データ
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [segmentTitle, setSegmentTitle] = useState('');

  // 進行状態
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // 選択・判定
  const [selectedText, setSelectedText] = useState<string>('');
  const [showJudge, setShowJudge] = useState(false);
  const [judgeResult, setJudgeResult] = useState<'correct' | 'wrong' | 'timeout' | null>(null);
  const [judgeText, setJudgeText] = useState('');
  const [judgeIcon, setJudgeIcon] = useState('');
  const [judgeDisabled, setJudgeDisabled] = useState(false);
  const [answerSubmitting, setAnswerSubmitting] = useState(false);

  // タイミング
  const QUESTION_LIMIT_MS = 10_000;
  const [timeLeftMs, setTimeLeftMs] = useState<number>(QUESTION_LIMIT_MS);
  const rafRef = useRef<number | null>(null);
  const deadlineRef = useRef<number>(0);
  const timedOutRef = useRef<boolean>(false);
  const quizStartRef = useRef<number | null>(null);
  const qStartRef = useRef<number | null>(null);

  // 回答（結果送信用）
  const [answers, setAnswers] = useState<Array<{
    word: string;
    question_order: number;
    selected_text: string;
    is_correct: boolean;
    reaction_time_ms: number;
  }>>([]);
  const answersRef = useRef<typeof answers>([]);
  const submitLockRef = useRef<boolean>(false);
  const submittedRef = useRef<boolean>(false);
  const [finalScorePct, setFinalScorePct] = useState<number | null>(null);

  // 初期ロード: セッション→セグメント→問題
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (status === 'loading') return;
        if (!session) {
          router.push('/auth/signin');
          return;
        }
        const sessionDetail = await v2API.getSession(id, token);
        const segId = (sessionDetail as any)?.segment?.segment_id;
        setSegmentTitle((sessionDetail as any)?.segment?.segment_name || '');
        if (!segId) throw new Error('セグメント情報の取得に失敗しました');

        const quiz = await v2API.getSegmentQuiz(segId, token);
        if (!cancelled) {
          // クライアント側でも一度だけシャッフルして、毎回同じ順序にならないようにする
          const shuffledQs = (quiz.questions as any).map((q: QuizQuestion) => ({
            ...q,
            choices: shuffleChoices(q.choices)
          }));
          setQuestions(shuffledQs);
          setLoading(false);
        }
      } catch (e: any) {
        setError(e?.message || '読み込みに失敗しました');
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, status, session, token, router]);

  const currentQuestion = useMemo(() => questions[currentIndex], [questions, currentIndex]);

  // 選択肢をランダム化（v2のchoices配列を並べ替え）
  const shuffleChoices = (choices: QuizChoice[]) => {
    const arr = [...choices];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // クイズ開始
  const handleStartQuiz = () => {
    setQuizStarted(true);
    setCurrentIndex(0);
    setSelectedText('');
    setShowJudge(false);
    setJudgeResult(null);
    setJudgeDisabled(false);
    setTimeLeftMs(QUESTION_LIMIT_MS);
    deadlineRef.current = (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) + QUESTION_LIMIT_MS;
    timedOutRef.current = false;
    quizStartRef.current = Date.now();
    qStartRef.current = Date.now();
  };

  // 高精度タイマー
  useEffect(() => {
    if (!quizStarted || showJudge || answerSubmitting) return;
    const now = (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
    if (!deadlineRef.current) {
      deadlineRef.current = now + QUESTION_LIMIT_MS;
      timedOutRef.current = false;
      setTimeLeftMs(QUESTION_LIMIT_MS);
    }
    const tick = () => {
      const current = (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
      const remain = Math.max(0, deadlineRef.current - current);
      setTimeLeftMs(remain);
      if (remain <= 0) {
        if (!timedOutRef.current) {
          timedOutRef.current = true;
          handleJudge('timeout');
        }
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [quizStarted, showJudge, answerSubmitting]);

  // クイズ完了時は結果詳細ページへ遷移（Hooks のルール上、トップレベルで実行）
  useEffect(() => {
    if (quizCompleted) {
      router.push(`/quiz/${id}/result`);
    }
  }, [quizCompleted, id, router]);

  // 解答選択
  const handleAnswerSelect = async (choice: QuizChoice) => {
    if (showJudge || judgeDisabled || answerSubmitting) return;
    // UI 用に選択状態を更新しつつ、送信用テキストは引数で handleJudge に渡す
    setSelectedText(choice.text_ja);
    setJudgeDisabled(true);
    setAnswerSubmitting(true);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    try {
      // setState は非同期のため、選択肢テキストは引数で明示的に渡す
      handleJudge(choice.is_correct ? 'correct' : 'wrong', choice.text_ja);
    } finally {
      setAnswerSubmitting(false);
    }
  };

  // 判定→回答記録
  const handleJudge = (result: 'correct' | 'wrong' | 'timeout', selectedTextInput?: string) => {
    setShowJudge(true);
    setJudgeResult(result);
    setJudgeDisabled(true);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    let text = '';
    let icon = '';
    if (result === 'correct') { text = '正解！'; icon = '◯'; }
    else if (result === 'wrong') { text = '不正解'; icon = '×'; }
    else { text = '時間切れ'; icon = '⏱️'; }
    setJudgeText(text);
    setJudgeIcon(icon);

    // 回答記録（提出用バッファ）
    const q = currentQuestion;
    if (!q) return;
    const elapsed = Math.max(0, qStartRef.current ? Date.now() - qStartRef.current : 0);
    setAnswers(prev => {
      const next = prev.concat({
        word: q.word.word_id,
        question_order: q.order,
        // 送信する選択テキストは、引数優先で使用（state は非同期更新のため）
        selected_text: result === 'timeout' ? 'Unknown' : (selectedTextInput || selectedText || 'Unknown'),
        is_correct: result === 'correct',
        reaction_time_ms: result === 'timeout' ? QUESTION_LIMIT_MS : elapsed,
      });
      answersRef.current = next;
      return next;
    });
  };

  // 次の問題 or 提出
  const handleNext = async () => {
    if (!showJudge) return;
    setJudgeDisabled(true);
    setShowJudge(false);
    setJudgeResult(null);
    setJudgeText('');
    setJudgeIcon('');
    setSelectedText('');

    if (currentIndex + 1 < questions.length) {
      const next = currentIndex + 1;
      setCurrentIndex(next);
      setTimeLeftMs(QUESTION_LIMIT_MS);
      deadlineRef.current = (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) + QUESTION_LIMIT_MS;
      timedOutRef.current = false;
      setJudgeDisabled(false);
      qStartRef.current = Date.now();
    } else {
      // 最後→提出
      try {
        setLoading(true);
        if (submittedRef.current) return; // 二重送信防止（恒久）
        submittedRef.current = true;
        if (submitLockRef.current) return; // 念のためのロック
        submitLockRef.current = true;
        const total = Math.max(0, quizStartRef.current ? Date.now() - quizStartRef.current : 0);
        // 注意: バックエンドは results が必ず10件であることを期待
        // fields: word(UUID), question_order(1..10), selected_text, is_correct(bool), reaction_time_ms(ms)
        let resultsToSend = answersRef.current;
        // 念のため不足があれば現在問題の回答を補完
        if (resultsToSend.length !== questions.length) {
          const q = currentQuestion;
          if (q) {
            const exists = resultsToSend.some(r => r.question_order === q.order);
            if (!exists) {
              const elapsed = Math.max(0, qStartRef.current ? Date.now() - qStartRef.current : 0);
              resultsToSend = resultsToSend.concat({
                word: q.word.word_id,
                question_order: q.order,
                selected_text: selectedText || 'Unknown',
                is_correct: false,
                reaction_time_ms: elapsed || QUESTION_LIMIT_MS,
              });
            }
          }
        }
        // 最終的に10件にそろえる（不足分はタイムアウト扱いで埋める）
        if (resultsToSend.length < questions.length) {
          const byOrder = new Map(resultsToSend.map(r => [r.question_order, r]));
          for (let i = 1; i <= questions.length; i++) {
            if (!byOrder.has(i)) {
              const qq = questions[i - 1];
              byOrder.set(i, {
                word: qq.word.word_id,
                question_order: i,
                selected_text: 'Unknown',
                is_correct: false,
                reaction_time_ms: QUESTION_LIMIT_MS,
              });
            }
          }
          resultsToSend = Array.from(byOrder.values()).sort((a, b) => a.question_order - b.question_order);
        }
        const res = await v2API.submitResults(id, { results: resultsToSend, total_time_ms: total }, token);
        const pct = typeof res?.score_percentage === 'number' ? Math.round(res.score_percentage) : 0;
        setFinalScorePct(pct);
        setQuizCompleted(true);
      } catch (e: any) {
        // エラー時でも NaN 表示を避ける
        console.error('submitResults failed:', e);
        setFinalScorePct(0);
        setQuizCompleted(true);
        // 失敗時のみ再試行を許可
        submittedRef.current = false;
      } finally {
        setLoading(false);
        submitLockRef.current = false;
      }
    }
  };

  // ローディング/エラー
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">エラー</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/quiz/start')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md"
          >
            クイズ選択に戻る
          </button>
        </div>
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">クイズが見つかりません</h2>
          <button
            onClick={() => router.push('/quiz/start')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md"
          >
            クイズ選択に戻る
          </button>
        </div>
      </div>
    );
  }

  if (quizCompleted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-700">結果ページへ移動しています…</p>
        </div>
      </div>
    );
  }

  if (!quizStarted) {
    return (
      <div className="h-[100dvh] bg-gray-50 flex items-center justify-center overflow-hidden">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 md:p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">英単語クイズ</h2>
            {segmentTitle && <p className="text-gray-600 mb-6">{segmentTitle}</p>}
            <div className="space-y-3 mb-6 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>問題数:</span>
                <span>{questions.length} 問</span>
              </div>
              <div className="flex justify-between">
                <span>制限時間:</span>
                <span>1問あたり 10 秒</span>
              </div>
            </div>
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                英単語を見て、正しい日本語訳を選択してください。<br/>
                各問題の反応時間も記録されます。
              </p>
            </div>
            <button
              onClick={handleStartQuiz}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-md font-medium text-lg"
            >
              クイズを開始
            </button>
          </div>
        </div>
      </div>
    );
  }

  const q = currentQuestion;
  const total = questions.length;
  const progressPct = ((currentIndex + 1) / total) * 100;

  return (
    <div className="h-[100dvh] bg-gray-50 flex flex-col overflow-hidden touch-none">
      {/* ヘッダー */}
      <div className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 py-3 md:py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-semibold text-gray-900">英単語クイズ</h1>
            <div className="text-sm text-gray-600">問題 {currentIndex + 1} / {total}</div>
          </div>
          {/* プログレスバー */}
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-indigo-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* 問題表示 */}
      <div className="max-w-4xl mx-auto px-4 py-4 md:py-6 flex-1 w-full overflow-hidden">
  <div className="bg-white rounded-lg shadow-lg p-4 md:p-6 h-full overflow-hidden flex flex-col">
          {/* 英単語 */}
          <div className="text-center mb-4 md:mb-6">
            <h2 className="font-bold text-gray-900 mb-1" style={{ fontSize: 'clamp(22px, 6vw, 40px)' }}>{q.word.text_en}</h2>
          </div>

          {/* タイマー */}
          <div className="mb-4 md:mb-6">
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              {(() => {
                const pct = Math.max(0, Math.min(1, timeLeftMs / QUESTION_LIMIT_MS));
                return (
                  <div
                    className="h-3 rounded-full"
                    style={{
                      transform: `scaleX(${pct})`,
                      transformOrigin: 'left',
                      backgroundColor: '#3b82f6',
                      willChange: 'transform',
                    }}
                  />
                );
              })()}
            </div>
            <div className="mt-2 text-center text-base md:text-lg font-semibold">
              <span className="text-indigo-600">残り</span>
              <span className="ml-1 text-2xl text-indigo-700">{(timeLeftMs / 1000).toFixed(2)}</span>
              <span className="ml-1 text-indigo-600">秒</span>
            </div>
          </div>

          <p className="text-sm md:text-base text-gray-700 mb-3 md:mb-4 text-center">この英単語の意味として正しいものを選択してください</p>

          {answerSubmitting && (
            <div className="flex justify-center mb-4" aria-live="polite">
              <span className="text-sm text-gray-500">判定中…</span>
            </div>
          )}

          {/* 選択肢（画面内に収まるよう4分割） */}
          <div className="grid grid-rows-4 gap-3 md:gap-4 flex-1 overflow-hidden">
            {q.choices.map((c, index) => (
              <button
                key={`${c.text_ja}-${index}`}
                onClick={() => handleAnswerSelect(c)}
                disabled={showJudge || judgeDisabled || answerSubmitting}
                className={`rounded-lg border transition-transform transform-gpu text-left w-full h-full p-3 md:p-4 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 ${selectedText === c.text_ja ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white'} ${(showJudge || judgeDisabled || answerSubmitting) ? 'opacity-60 pointer-events-none' : 'hover:translate-y-[-2px] hover:shadow-lg active:translate-y-0 active:scale-[0.995]'}`}
                style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.03)', transition: 'transform 120ms ease, box-shadow 120ms ease' }}
              >
                <div className="flex items-center h-full">
                  <span className="font-bold text-base md:text-lg text-gray-700 mr-3 shrink-0">{String.fromCharCode(65 + index)}.</span>
                  <span className="text-base md:text-lg text-gray-900" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.text_ja}</span>
                </div>
              </button>
            ))}
          </div>

          {/* 判定オーバーレイ */}
          {showJudge && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30" onClick={handleNext} style={{ cursor: 'pointer' }}>
              <div className="bg-white rounded-lg shadow-lg p-10 flex flex-col items-center">
                <div className="text-6xl mb-4">{judgeIcon}</div>
                <div className="text-2xl font-bold mb-2">{judgeText}</div>
                <div className="text-gray-600 text-lg">画面のどこでもタップして次へ</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
