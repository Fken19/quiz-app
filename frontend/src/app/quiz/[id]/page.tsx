'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { quizAPI, Quiz, Question, QuizSession, Answer } from '@/services/api';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function QuizPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const quizId = params.id as string;

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [session_data, setSessionData] = useState<QuizSession | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    fetchQuizData();
  }, [session, status, router, quizId]);

  useEffect(() => {
    if (quizStarted && timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (quizStarted && timeLeft === 0) {
      handleSubmitQuiz();
    }
  }, [timeLeft, quizStarted]);

  const fetchQuizData = async () => {
    try {
      // デモデータを使用（実際のAPIが利用できない場合）
      const demoQuiz: Quiz = {
        id: quizId,
        title: 'JavaScript基礎',
        description: 'JavaScript の基本的な概念と構文に関するクイズです。',
        level: 'beginner',
        questions_count: 3,
        time_limit: 300, // 5分
        pass_score: 70,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      const demoQuestions: Question[] = [
        {
          id: '1',
          quiz_id: quizId,
          question_text: 'JavaScriptで変数を宣言するキーワードはどれですか？',
          option_a: 'variable',
          option_b: 'var',
          option_c: 'declare',
          option_d: 'define',
          correct_answer: 'B',
          explanation: 'JavaScriptでは var, let, const を使って変数を宣言します。',
          difficulty: 1,
          order: 1
        },
        {
          id: '2',
          quiz_id: quizId,
          question_text: 'JavaScriptの関数を定義する方法として正しいのはどれですか？',
          option_a: 'function myFunc() {}',
          option_b: 'def myFunc() {}',
          option_c: 'func myFunc() {}',
          option_d: 'method myFunc() {}',
          correct_answer: 'A',
          explanation: 'JavaScriptでは function キーワードを使って関数を定義します。',
          difficulty: 1,
          order: 2
        },
        {
          id: '3',
          quiz_id: quizId,
          question_text: 'JavaScriptで配列の長さを取得するプロパティはどれですか？',
          option_a: 'size',
          option_b: 'count',
          option_c: 'length',
          option_d: 'total',
          correct_answer: 'C',
          explanation: '配列の長さは length プロパティで取得できます。',
          difficulty: 1,
          order: 3
        }
      ];

      setQuiz(demoQuiz);
      setQuestions(demoQuestions);
      setTimeLeft(demoQuiz.time_limit);
    } catch (err) {
      console.error('Failed to fetch quiz data:', err);
      setError('クイズデータの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleStartQuiz = async () => {
    try {
      setQuizStarted(true);
      // 実際のAPIでは、ここでセッションを開始
      // const session = await quizAPI.startSession(quizId);
      // setSessionData(session);
    } catch (err) {
      console.error('Failed to start quiz:', err);
      setError('クイズの開始に失敗しました');
    }
  };

  const handleAnswerSelect = (answer: string) => {
    setSelectedAnswer(answer);
    const currentQuestion = questions[currentQuestionIndex];
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: answer
    }));
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      const nextQuestion = questions[currentQuestionIndex + 1];
      setSelectedAnswer(answers[nextQuestion.id] || '');
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      const prevQuestion = questions[currentQuestionIndex - 1];
      setSelectedAnswer(answers[prevQuestion.id] || '');
    }
  };

  const handleSubmitQuiz = async () => {
    setSubmitting(true);
    try {
      // 回答をチェックして採点
      let correctAnswers = 0;
      questions.forEach(question => {
        if (answers[question.id] === question.correct_answer) {
          correctAnswers++;
        }
      });
      
      const score = Math.round((correctAnswers / questions.length) * 100);
      setFinalScore(score);
      setQuizCompleted(true);
    } catch (err) {
      console.error('Failed to submit quiz:', err);
      setError('クイズの提出に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">エラー</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/quiz')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md"
          >
            クイズ一覧に戻る
          </button>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            クイズが見つかりません
          </h2>
          <button
            onClick={() => router.push('/quiz')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md"
          >
            クイズ一覧に戻る
          </button>
        </div>
      </div>
    );
  }

  if (quizCompleted) {
    const isPassed = finalScore !== null && finalScore >= quiz.pass_score;
    
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className={`text-6xl mb-4 ${isPassed ? '🎉' : '😔'}`}>
              {isPassed ? '🎉' : '😔'}
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              クイズ完了！
            </h2>
            <div className="mb-6">
              <p className="text-lg text-gray-600 mb-2">あなたのスコア</p>
              <p className={`text-4xl font-bold ${isPassed ? 'text-green-600' : 'text-red-600'}`}>
                {finalScore}%
              </p>
              <p className="text-sm text-gray-500 mt-2">
                合格ライン: {quiz.pass_score}%
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => router.push('/quiz')}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-md font-medium"
              >
                他のクイズに挑戦
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-md font-medium"
              >
                ダッシュボードに戻る
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!quizStarted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {quiz.title}
            </h2>
            <p className="text-gray-600 mb-6">
              {quiz.description}
            </p>
            <div className="space-y-3 mb-6 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>問題数:</span>
                <span>{quiz.questions_count} 問</span>
              </div>
              <div className="flex justify-between">
                <span>制限時間:</span>
                <span>{Math.floor(quiz.time_limit / 60)} 分</span>
              </div>
              <div className="flex justify-between">
                <span>合格ライン:</span>
                <span>{quiz.pass_score}%</span>
              </div>
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

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-semibold text-gray-900">
              {quiz.title}
            </h1>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                問題 {currentQuestionIndex + 1} / {questions.length}
              </div>
              <div className={`text-sm font-medium ${timeLeft <= 60 ? 'text-red-600' : 'text-gray-600'}`}>
                残り時間: {formatTime(timeLeft)}
              </div>
            </div>
          </div>
          {/* プログレスバー */}
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* 問題表示 */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-xl font-medium text-gray-900 mb-6">
            {currentQuestion.question_text}
          </h2>
          
          <div className="space-y-3">
            {[
              { key: 'A', text: currentQuestion.option_a },
              { key: 'B', text: currentQuestion.option_b },
              { key: 'C', text: currentQuestion.option_c },
              { key: 'D', text: currentQuestion.option_d }
            ].map((option) => (
              <button
                key={option.key}
                onClick={() => handleAnswerSelect(option.key)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                  selectedAnswer === option.key
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span className="font-medium text-gray-700 mr-3">
                  {option.key}.
                </span>
                <span className="text-gray-900">{option.text}</span>
              </button>
            ))}
          </div>

          {/* ナビゲーションボタン */}
          <div className="flex justify-between mt-8">
            <button
              onClick={handlePrevQuestion}
              disabled={currentQuestionIndex === 0}
              className="px-4 py-2 text-gray-600 bg-gray-200 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              前の問題
            </button>
            
            {currentQuestionIndex === questions.length - 1 ? (
              <button
                onClick={handleSubmitQuiz}
                disabled={submitting}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium disabled:opacity-50"
              >
                {submitting ? '提出中...' : 'クイズを提出'}
              </button>
            ) : (
              <button
                onClick={handleNextQuestion}
                disabled={!selectedAnswer}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                次の問題
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
