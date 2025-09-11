'use client';

import { useSession, signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';

interface Student {
  id: string;
  email: string;
  display_name: string;
  groups: string[];
  total_quiz_count: number;
  average_score: number;
  last_activity: string;
  joined_at: string;
  total_questions_answered: number;
  correct_answers: number;
}

interface QuizSession {
  id: string;
  quiz_name: string;
  group: string;
  score: number;
  total_questions: number;
  correct_answers: number;
  completed_at: string;
  time_taken: number;
}

export default function StudentDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const studentId = params.id as string;
  
  const [student, setStudent] = useState<Student | null>(null);
  const [quizSessions, setQuizSessions] = useState<QuizSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      signIn("google");
      return;
    }
    if (status === "authenticated") {
      fetchStudentDetails();
    }
  }, [status, studentId]);

  const fetchStudentDetails = async () => {
    try {
      // デモデータ（実際のAPIと置き換え予定）
      const demoStudents = {
        '1': {
          id: '1',
          email: 'student1@example.com',
          display_name: '田中太郎',
          groups: ['数学A 高校1年', '物理基礎'],
          total_quiz_count: 25,
          average_score: 78.5,
          last_activity: '2024-01-20T15:30:00Z',
          joined_at: '2024-01-16T09:00:00Z',
          total_questions_answered: 250,
          correct_answers: 196
        },
        '2': {
          id: '2',
          email: 'student2@example.com',
          display_name: '佐藤花子',
          groups: ['英語初級', '数学A 高校1年'],
          total_quiz_count: 30,
          average_score: 82.3,
          last_activity: '2024-01-20T16:45:00Z',
          joined_at: '2024-01-17T10:00:00Z',
          total_questions_answered: 300,
          correct_answers: 247
        }
      };

      const studentData = demoStudents[studentId as keyof typeof demoStudents];
      if (!studentData) {
        setError('生徒が見つかりません');
        return;
      }

      setStudent(studentData);

      // デモクイズセッションデータ
      const demoSessions: QuizSession[] = [
        {
          id: '1',
          quiz_name: '数学基礎テスト',
          group: '数学A 高校1年',
          score: 85,
          total_questions: 10,
          correct_answers: 8,
          completed_at: '2024-01-20T14:30:00Z',
          time_taken: 600
        },
        {
          id: '2',
          quiz_name: '物理運動の法則',
          group: '物理基礎',
          score: 72,
          total_questions: 15,
          correct_answers: 11,
          completed_at: '2024-01-19T16:15:00Z',
          time_taken: 900
        },
        {
          id: '3',
          quiz_name: '復習テスト',
          group: '数学A 高校1年',
          score: 90,
          total_questions: 8,
          correct_answers: 7,
          completed_at: '2024-01-18T18:45:00Z',
          time_taken: 480
        },
        {
          id: '4',
          quiz_name: '物理基礎確認',
          group: '物理基礎',
          score: 68,
          total_questions: 12,
          correct_answers: 8,
          completed_at: '2024-01-17T20:30:00Z',
          time_taken: 720
        }
      ];

      setQuizSessions(demoSessions.slice(0, studentData.total_quiz_count || 10));
    } catch (err) {
      console.error('Failed to fetch student details:', err);
      setError('生徒詳細の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!session || !student) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            生徒が見つかりません
          </h2>
          <Link
            href="/admin-dashboard/students"
            className="text-indigo-600 hover:text-indigo-800"
          >
            生徒一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link href="/admin-dashboard" className="text-xl font-semibold text-gray-900">
                Quiz App 管理者
              </Link>
              <Link href="/admin-dashboard/students" className="text-gray-600 hover:text-gray-900">
                生徒管理
              </Link>
              <span className="text-indigo-600 font-medium">
                {student.display_name}
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">{session.user?.name}</span>
              <img
                src={session.user?.image || "/default-avatar.png"}
                alt="avatar"
                className="w-8 h-8 rounded-full border"
              />
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {error && (
            <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <p className="text-yellow-800">{error}</p>
              <p className="text-sm text-yellow-600 mt-1">
                デモデータを表示しています。
              </p>
            </div>
          )}

          {/* 生徒基本情報 */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                生徒詳細
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                学習履歴と成績情報
              </p>
            </div>
            
            <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
              <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">表示名</dt>
                  <dd className="mt-1 text-sm text-gray-900">{student.display_name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">メールアドレス</dt>
                  <dd className="mt-1 text-sm text-gray-900">{student.email}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">参加日</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(student.joined_at).toLocaleDateString('ja-JP')}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">最終活動</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(student.last_activity).toLocaleDateString('ja-JP')}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">所属グループ</dt>
                  <dd className="mt-1">
                    <div className="flex flex-wrap gap-2">
                      {student.groups.map((group, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {group}
                        </span>
                      ))}
                    </div>
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* 学習統計 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">📊</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        クイズ回数
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {student.total_quiz_count} 回
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">📈</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        平均スコア
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {student.average_score.toFixed(1)}%
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">❓</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        総問題数
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {student.total_questions_answered} 問
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">✅</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        正答数
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {student.correct_answers} 問
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* クイズ履歴 */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                クイズ履歴
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                最近のクイズ受験履歴
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      クイズ名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      グループ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      スコア
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      正答率
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      所要時間
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      完了日時
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {quizSessions.map((session) => (
                    <tr key={session.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {session.quiz_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {session.group}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          session.score >= 80 
                            ? 'bg-green-100 text-green-800'
                            : session.score >= 60
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {session.score}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {session.correct_answers}/{session.total_questions}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDuration(session.time_taken)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(session.completed_at).toLocaleDateString('ja-JP')} {new Date(session.completed_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {quizSessions.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">📝</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  クイズ履歴がありません
                </h3>
                <p className="text-gray-600">
                  まだクイズを受験していません。
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
