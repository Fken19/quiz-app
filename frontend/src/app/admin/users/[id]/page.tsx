'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';

interface User {
  id: string;
  email: string;
  username: string;
  display_name: string;
  is_staff: boolean;
  created_at: string;
  last_login?: string;
  quiz_sessions_count?: number;
  average_score?: number;
  total_questions_answered?: number;
  correct_answers?: number;
  groups?: string[];
}

interface QuizSession {
  id: string;
  quiz_name: string;
  score: number;
  total_questions: number;
  correct_answers: number;
  completed_at: string;
  time_taken: number;
}

export default function AdminUserDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  
  const [user, setUser] = useState<User | null>(null);
  const [quizSessions, setQuizSessions] = useState<QuizSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    display_name: '',
    email: '',
    is_staff: false
  });

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    fetchUserDetails();
  }, [session, status, router, userId]);

  const fetchUserDetails = async () => {
    try {
      // デモデータを使用
      const demoUsers = {
        '1': {
          id: '1',
          email: 'student1@example.com',
          username: 'student1',
          display_name: '田中太郎',
          is_staff: false,
          created_at: '2024-01-15T10:30:00Z',
          last_login: '2024-01-20T15:30:00Z',
          quiz_sessions_count: 15,
          average_score: 78.5,
          total_questions_answered: 150,
          correct_answers: 118,
          groups: ['数学A', '数学B']
        },
        '2': {
          id: '2',
          email: 'student2@example.com',
          username: 'student2',
          display_name: '佐藤花子',
          is_staff: false,
          created_at: '2024-01-16T14:20:00Z',
          last_login: '2024-01-20T16:45:00Z',
          quiz_sessions_count: 12,
          average_score: 82.3,
          total_questions_answered: 120,
          correct_answers: 99,
          groups: ['数学A', '物理']
        },
        '3': {
          id: '3',
          email: 'student3@example.com',
          username: 'student3',
          display_name: '鈴木次郎',
          is_staff: false,
          created_at: '2024-01-17T09:15:00Z',
          last_login: '2024-01-19T20:10:00Z',
          quiz_sessions_count: 8,
          average_score: 65.8,
          total_questions_answered: 80,
          correct_answers: 53,
          groups: ['数学A']
        },
        '4': {
          id: '4',
          email: 'teacher@school.com',
          username: 'teacher',
          display_name: '山田先生',
          is_staff: true,
          created_at: '2024-01-01T09:00:00Z',
          last_login: '2024-01-20T08:30:00Z',
          quiz_sessions_count: 2,
          average_score: 95.0,
          total_questions_answered: 20,
          correct_answers: 19,
          groups: []
        },
        '5': {
          id: '5',
          email: 'student4@example.com',
          username: 'student4',
          display_name: '高橋美咲',
          is_staff: false,
          created_at: '2024-01-18T13:45:00Z',
          last_login: '2024-01-20T17:20:00Z',
          quiz_sessions_count: 20,
          average_score: 88.7,
          total_questions_answered: 200,
          correct_answers: 177,
          groups: ['数学A', '数学B', '物理']
        }
      };

      const userData = demoUsers[userId as keyof typeof demoUsers];
      if (!userData) {
        setError('ユーザーが見つかりません');
        return;
      }

      setUser(userData);
      setEditForm({
        display_name: userData.display_name,
        email: userData.email,
        is_staff: userData.is_staff
      });

      // デモクイズセッションデータ
      const demoSessions: QuizSession[] = [
        {
          id: '1',
          quiz_name: '数学基礎テスト',
          score: 85,
          total_questions: 10,
          correct_answers: 8,
          completed_at: '2024-01-20T14:30:00Z',
          time_taken: 600
        },
        {
          id: '2',
          quiz_name: '数学応用問題',
          score: 72,
          total_questions: 15,
          correct_answers: 11,
          completed_at: '2024-01-19T16:15:00Z',
          time_taken: 900
        },
        {
          id: '3',
          quiz_name: '復習テスト',
          score: 90,
          total_questions: 8,
          correct_answers: 7,
          completed_at: '2024-01-18T18:45:00Z',
          time_taken: 480
        }
      ];

      setQuizSessions(demoSessions.slice(0, userData.quiz_sessions_count || 3));
    } catch (err) {
      console.error('Failed to fetch user details:', err);
      setError('ユーザー詳細の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    try {
      // 実際のAPIコール予定地
      console.log('Saving user updates:', editForm);
      
      // デモ用の更新
      if (user) {
        setUser({
          ...user,
          display_name: editForm.display_name,
          email: editForm.email,
          is_staff: editForm.is_staff
        });
      }
      
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update user:', err);
      setError('ユーザー更新に失敗しました');
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!session || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            ユーザーが見つかりません
          </h2>
          <Link
            href="/admin/users"
            className="text-indigo-600 hover:text-indigo-800"
          >
            ユーザー一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ナビゲーションバー */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link href="/admin" className="text-xl font-semibold text-gray-900">
                Quiz App
              </Link>
              <Link href="/admin" className="text-gray-600 hover:text-gray-900">
                管理者画面
              </Link>
              <Link href="/admin/users" className="text-gray-600 hover:text-gray-900">
                ユーザー管理
              </Link>
              <span className="text-indigo-600 font-medium">
                {user.display_name || user.username}
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                {session.user?.name} (管理者)
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
          {error && (
            <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <p className="text-yellow-800">{error}</p>
              <p className="text-sm text-yellow-600 mt-1">
                デモデータを表示しています。
              </p>
            </div>
          )}

          {/* ユーザー基本情報 */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    ユーザー詳細
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">
                    アカウント情報と学習履歴
                  </p>
                </div>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  {isEditing ? 'キャンセル' : '編集'}
                </button>
              </div>
            </div>
            
            <div className="px-4 py-5 sm:p-6">
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      表示名
                    </label>
                    <input
                      type="text"
                      value={editForm.display_name}
                      onChange={(e) => setEditForm({...editForm, display_name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      メールアドレス
                    </label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_staff"
                      checked={editForm.is_staff}
                      onChange={(e) => setEditForm({...editForm, is_staff: e.target.checked})}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="is_staff" className="ml-2 block text-sm text-gray-900">
                      管理者権限
                    </label>
                  </div>
                  <div className="flex space-x-3 pt-4">
                    <button
                      onClick={handleSaveEdit}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">表示名</dt>
                    <dd className="mt-1 text-sm text-gray-900">{user.display_name}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">ユーザー名</dt>
                    <dd className="mt-1 text-sm text-gray-900">{user.username}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">メールアドレス</dt>
                    <dd className="mt-1 text-sm text-gray-900">{user.email}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">役割</dt>
                    <dd className="mt-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.is_staff 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {user.is_staff ? '講師' : '生徒'}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">登録日</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {new Date(user.created_at).toLocaleDateString('ja-JP')}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">最終ログイン</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {user.last_login 
                        ? new Date(user.last_login).toLocaleDateString('ja-JP')
                        : 'なし'
                      }
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">所属グループ</dt>
                    <dd className="mt-1">
                      {user.groups && user.groups.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {user.groups.map((group, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                            >
                              {group}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">なし</span>
                      )}
                    </dd>
                  </div>
                </dl>
              )}
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
                        {user.quiz_sessions_count || 0} 回
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
                        {user.average_score ? `${user.average_score.toFixed(1)}%` : '未受験'}
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
                        {user.total_questions_answered || 0} 問
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
                        {user.correct_answers || 0} 問
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
                最近のクイズ履歴
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      クイズ名
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
