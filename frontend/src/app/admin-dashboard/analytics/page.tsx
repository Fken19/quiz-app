"use client";

import AdminLayout from '@/components/AdminLayout';
import { useSession, signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';

interface Analytics {
  total_students: number;
  total_groups: number;
  total_quiz_sessions: number;
  average_score: number;
  score_distribution: {
    range: string;
    count: number;
    percentage: number;
  }[];
  group_performance: {
    group_name: string;
    student_count: number;
    average_score: number;
    total_sessions: number;
  }[];
  daily_activity: {
    date: string;
    quiz_sessions: number;
    active_students: number;
  }[];
}

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      signIn("google");
      return;
    }
    if (status === "authenticated") {
      fetchAnalytics();
    }
  }, [status]);

  const fetchAnalytics = async () => {
    try {
      // デモデータ（実際のAPIと置き換え予定）
      setAnalytics({
        total_students: 45,
        total_groups: 8,
        total_quiz_sessions: 312,
        average_score: 76.8,
        score_distribution: [
          { range: '90-100%', count: 8, percentage: 17.8 },
          { range: '80-89%', count: 15, percentage: 33.3 },
          { range: '70-79%', count: 12, percentage: 26.7 },
          { range: '60-69%', count: 7, percentage: 15.6 },
          { range: '0-59%', count: 3, percentage: 6.7 }
        ],
        group_performance: [
          {
            group_name: '数学A 高校1年',
            student_count: 15,
            average_score: 78.5,
            total_sessions: 125
          },
          {
            group_name: '英語初級',
            student_count: 12,
            average_score: 82.3,
            total_sessions: 96
          },
          {
            group_name: '物理基礎',
            student_count: 8,
            average_score: 71.5,
            total_sessions: 64
          },
          {
            group_name: '化学基礎',
            student_count: 10,
            average_score: 68.9,
            total_sessions: 27
          }
        ],
        daily_activity: [
          { date: '2024-01-20', quiz_sessions: 28, active_students: 15 },
          { date: '2024-01-19', quiz_sessions: 22, active_students: 12 },
          { date: '2024-01-18', quiz_sessions: 31, active_students: 18 },
          { date: '2024-01-17', quiz_sessions: 19, active_students: 10 },
          { date: '2024-01-16', quiz_sessions: 25, active_students: 14 },
          { date: '2024-01-15', quiz_sessions: 33, active_students: 20 },
          { date: '2024-01-14', quiz_sessions: 17, active_students: 9 }
        ]
      });
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setError('分析データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!session || !analytics) {
    return null;
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gray-50">
        {/* ヘッダー */}
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center space-x-8">
                <Link href="/admin-dashboard" className="text-xl font-semibold text-gray-900">
                  Quiz App 管理者
                </Link>
                <span className="text-indigo-600 font-medium">成績分析</span>
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
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900">
                成績分析
              </h2>
              <p className="mt-2 text-gray-600">
                詳細な成績データと学習傾向の分析です。
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

            {/* 概要統計 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-sm">👥</span>
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          総生徒数
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {analytics.total_students}
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
                        <span className="text-white font-bold text-sm">📚</span>
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          総グループ数
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {analytics.total_groups}
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
                        <span className="text-white font-bold text-sm">📝</span>
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          総クイズ回数
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {analytics.total_quiz_sessions}
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
                        <span className="text-white font-bold text-sm">⭐</span>
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          全体平均スコア
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {analytics.average_score}%
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* スコア分布 */}
            <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  スコア分布
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  生徒のスコア分布状況
                </p>
              </div>
              <div className="border-t border-gray-200">
                <div className="px-4 py-5 sm:p-6">
                  <div className="space-y-4">
                    {analytics.score_distribution.map((item, index) => (
                      <div key={index} className="flex items-center">
                        <div className="w-20 text-sm font-medium text-gray-900">
                          {item.range}
                        </div>
                        <div className="flex-1 mx-4">
                          <div className="bg-gray-200 rounded-full h-4">
                            <div
                              className="bg-indigo-600 h-4 rounded-full"
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                        </div>
                        <div className="w-16 text-sm text-gray-500 text-right">
                          {item.count}名
                        </div>
                        <div className="w-16 text-sm text-gray-500 text-right">
                          ({item.percentage}%)
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* グループ別成績 */}
            <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  グループ別成績
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  各グループのパフォーマンス比較
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        グループ名
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        生徒数
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        平均スコア
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        総クイズ回数
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        1人あたり平均
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {analytics.group_performance.map((group, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {group.group_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {group.student_count}名
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            group.average_score >= 80 
                              ? 'bg-green-100 text-green-800'
                              : group.average_score >= 70
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {group.average_score.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {group.total_sessions}回
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {(group.total_sessions / group.student_count).toFixed(1)}回
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 日別活動量 */}
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  最近の活動量
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  過去7日間の学習活動
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        日付
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        クイズ回数
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        アクティブ生徒数
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        参加率
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {analytics.daily_activity.map((day, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {new Date(day.date).toLocaleDateString('ja-JP')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {day.quiz_sessions}回
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {day.active_students}名
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                              <div
                                className="bg-indigo-600 h-2 rounded-full"
                                style={{ width: `${(day.active_students / analytics.total_students) * 100}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-500">
                              {((day.active_students / analytics.total_students) * 100).toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </AdminLayout>
  );
}
