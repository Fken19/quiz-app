'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { quizAPI, Quiz } from '@/services/api';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function QuizList() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    // クイズ一覧を取得
    const fetchQuizzes = async () => {
      try {
        const data = await quizAPI.getQuizzes();
        setQuizzes(data);
      } catch (err) {
        console.error('Failed to fetch quizzes:', err);
        setError('クイズの取得に失敗しました');
        // エラーの場合はデモデータを表示
        setQuizzes([
          {
            id: '1',
            title: 'JavaScript基礎',
            description: 'JavaScript の基本的な概念と構文に関するクイズです。',
            level: 'beginner',
            questions_count: 10,
            time_limit: 600,
            pass_score: 70,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          },
          {
            id: '2',
            title: 'React中級',
            description: 'React のコンポーネント、state、props に関する中級レベルのクイズです。',
            level: 'intermediate',
            questions_count: 15,
            time_limit: 900,
            pass_score: 75,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          },
          {
            id: '3',
            title: 'TypeScript上級',
            description: 'TypeScript の高度な型システムと実践的な使用方法に関するクイズです。',
            level: 'advanced',
            questions_count: 20,
            time_limit: 1200,
            pass_score: 80,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchQuizzes();
  }, [session, status, router]);

  const getLevelBadgeColor = (level: string) => {
    switch (level) {
      case 'beginner':
        return 'bg-green-100 text-green-800';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800';
      case 'advanced':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getLevelText = (level: string) => {
    switch (level) {
      case 'beginner':
        return '初級';
      case 'intermediate':
        return '中級';
      case 'advanced':
        return '上級';
      default:
        return level;
    }
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ナビゲーションバー */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link href="/dashboard" className="text-xl font-semibold text-gray-900">
                Quiz App
              </Link>
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                ダッシュボード
              </Link>
              <span className="text-indigo-600 font-medium">クイズ</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                {session.user?.name}
              </span>
              <button
                onClick={() => router.push('/auth/signout')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-md text-sm font-medium"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">
              利用可能なクイズ
            </h2>
            <p className="mt-2 text-gray-600">
              チャレンジしたいクイズを選択してください。
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <p className="text-yellow-800">{error}</p>
              <p className="text-sm text-yellow-600 mt-1">
                デモデータを表示しています。
              </p>
            </div>
          )}

          {/* クイズカード */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quizzes.map((quiz) => (
              <div key={quiz.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {quiz.title}
                    </h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getLevelBadgeColor(quiz.level)}`}>
                      {getLevelText(quiz.level)}
                    </span>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                    {quiz.description}
                  </p>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-500">
                      <span className="mr-2">📝</span>
                      <span>{quiz.questions_count} 問</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <span className="mr-2">⏱️</span>
                      <span>{Math.floor(quiz.time_limit / 60)} 分</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <span className="mr-2">🎯</span>
                      <span>合格ライン: {quiz.pass_score}%</span>
                    </div>
                  </div>
                  
                  <Link
                    href={`/quiz/${quiz.id}`}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-md text-sm font-medium text-center block transition-colors"
                  >
                    クイズを開始
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {quizzes.length === 0 && !loading && !error && (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">📚</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                クイズがありません
              </h3>
              <p className="text-gray-600">
                現在利用可能なクイズがありません。
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
