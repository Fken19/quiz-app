'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/api-utils';
import type { Test, TestResult } from '@/types/quiz';
import { 
  ClipboardDocumentListIcon, 
  UserGroupIcon, 
  BookOpenIcon,
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

interface DashboardStats {
  totalTests: number;
  activeTests: number;
  totalStudents: number;
  completedResults: number;
}

export default function TeacherDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalTests: 0,
    activeTests: 0,
    totalStudents: 0,
    completedResults: 0,
  });
  const [pendingTests, setPendingTests] = useState<Test[]>([]);
  const [recentResults, setRecentResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const [testsResponse, resultsResponse, studentsResponse] = await Promise.all([
          apiGet('/api/tests/?page_size=100'),
          apiGet('/api/test-results/?page_size=10').catch(() => ({ results: [] })),
          apiGet('/api/student-teacher-links/').catch(() => ({ results: [] })),
        ]);
        
        const tests: Test[] = Array.isArray(testsResponse) ? testsResponse : testsResponse?.results || [];
        const results: TestResult[] = Array.isArray(resultsResponse)
          ? resultsResponse
          : resultsResponse?.results || [];
        const students = Array.isArray(studentsResponse) ? studentsResponse : studentsResponse?.results || [];

        const activeTests = tests.filter((test) => !test.archived_at);
        const completedResults = results.filter((r) => r.completed_at);

        setStats({
          totalTests: tests.length,
          activeTests: activeTests.length,
          totalStudents: students.length,
          completedResults: completedResults.length,
        });

        setPendingTests(activeTests);
        setRecentResults(results);
      } catch (err) {
        console.error(err);
        setError('ダッシュボード情報の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-10">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <XCircleIcon className="h-5 w-5" />
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">講師ダッシュボード</h1>
        <p className="text-slate-600">テスト管理と生徒の学習状況を一目で確認</p>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link href="/teacher/tests" className="group">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-all duration-200 hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">総テスト数</p>
                <p className="text-3xl font-bold text-slate-900">{stats.totalTests}</p>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <ClipboardDocumentListIcon className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            <p className="text-xs text-blue-600 mt-3 group-hover:underline">
              アクティブ: {stats.activeTests}件
            </p>
          </div>
        </Link>

        <Link href="/teacher/students" className="group">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-all duration-200 hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">生徒数</p>
                <p className="text-3xl font-bold text-slate-900">{stats.totalStudents}</p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <UserGroupIcon className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <p className="text-xs text-green-600 mt-3 group-hover:underline">
              生徒一覧を見る →
            </p>
          </div>
        </Link>

        <Link href="/teacher/vocab" className="group">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-all duration-200 hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">語彙管理</p>
                <p className="text-3xl font-bold text-slate-900">
                  <BookOpenIcon className="h-10 w-10 text-purple-600" />
                </p>
              </div>
              <div className="bg-purple-100 rounded-full p-3">
                <BookOpenIcon className="h-8 w-8 text-purple-600" />
              </div>
            </div>
            <p className="text-xs text-purple-600 mt-3 group-hover:underline">
              語彙を管理 →
            </p>
          </div>
        </Link>

        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">完了済み</p>
              <p className="text-3xl font-bold text-slate-900">{stats.completedResults}</p>
            </div>
            <div className="bg-indigo-100 rounded-full p-3">
              <ChartBarIcon className="h-8 w-8 text-indigo-600" />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            テスト結果の提出数
          </p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Tests */}
        <section className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardDocumentListIcon className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-slate-900">進行中のテスト</h2>
            </div>
            <span className="bg-indigo-100 text-indigo-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              {stats.activeTests}件
            </span>
          </div>
          <div className="divide-y max-h-96 overflow-y-auto">
            {pendingTests.slice(0, 5).map((test) => {
              const isOverdue = test.due_at && new Date(test.due_at) < new Date();
              return (
                <Link
                  key={test.test_id}
                  href={`/teacher/tests/${test.test_id}`}
                  className="block px-6 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">{test.title}</p>
                      {test.description && (
                        <p className="text-sm text-slate-600 mt-1 line-clamp-1">{test.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    {test.due_at ? (
                      <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600' : 'text-slate-500'}`}>
                        <ClockIcon className="h-4 w-4" />
                        締切: {new Date(test.due_at).toLocaleString('ja-JP')}
                      </span>
                    ) : (
                      <span className="text-slate-400">締切なし</span>
                    )}
                  </div>
                </Link>
              );
            })}
            {pendingTests.length === 0 && (
              <div className="px-6 py-8 text-center text-slate-500">
                <ClipboardDocumentListIcon className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                <p>進行中のテストはありません</p>
              </div>
            )}
          </div>
          {pendingTests.length > 5 && (
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200">
              <Link href="/teacher/tests" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                すべてのテストを見る →
              </Link>
            </div>
          )}
        </section>

        {/* Recent Results */}
        <section className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ChartBarIcon className="h-5 w-5 text-green-600" />
              <h2 className="text-lg font-semibold text-slate-900">最新の提出</h2>
            </div>
          </div>
          <div className="divide-y max-h-96 overflow-y-auto">
            {recentResults.map((result) => {
              const isCompleted = !!result.completed_at;
              return (
                <div
                  key={result.test_result_id}
                  className="px-6 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {isCompleted ? (
                          <CheckCircleIcon className="h-5 w-5 text-green-600" />
                        ) : (
                          <ClockIcon className="h-5 w-5 text-amber-600" />
                        )}
                        <span className="font-medium text-slate-900">
                          テスト: {result.test.substring(0, 8)}...
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">
                        生徒ID: {result.student.substring(0, 8)}...
                      </p>
                    </div>
                    <div className="text-right">
                      {result.score !== null && result.score !== undefined ? (
                        <div className="text-2xl font-bold text-indigo-600">{result.score}点</div>
                      ) : (
                        <div className="text-sm text-slate-400">未採点</div>
                      )}
                      <div className="text-xs text-slate-500 mt-1">
                        {new Date(result.started_at).toLocaleDateString('ja-JP')}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {recentResults.length === 0 && (
              <div className="px-6 py-8 text-center text-slate-500">
                <ChartBarIcon className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                <p>提出履歴がまだありません</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Quick Actions */}
      <section className="bg-gradient-to-r from-indigo-500 to-blue-500 rounded-xl shadow-lg p-6 text-white">
        <h2 className="text-xl font-bold mb-4">クイックアクション</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/teacher/tests"
            className="bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-lg p-4 transition-all duration-200 hover:scale-105"
          >
            <ClipboardDocumentListIcon className="h-8 w-8 mb-2" />
            <p className="font-medium">新しいテストを作成</p>
          </Link>
          <Link
            href="/teacher/students"
            className="bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-lg p-4 transition-all duration-200 hover:scale-105"
          >
            <UserGroupIcon className="h-8 w-8 mb-2" />
            <p className="font-medium">生徒を管理</p>
          </Link>
          <Link
            href="/teacher/vocab"
            className="bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-lg p-4 transition-all duration-200 hover:scale-105"
          >
            <BookOpenIcon className="h-8 w-8 mb-2" />
            <p className="font-medium">語彙を追加</p>
          </Link>
        </div>
      </section>
    </div>
  );
}
