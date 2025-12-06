'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiGet, apiPost, apiPatch, ApiError } from '@/lib/api-utils';
import type { Test, TestResult, StudentTeacherLink } from '@/types/quiz';
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
  const router = useRouter();
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
  const [pendingLinks, setPendingLinks] = useState<StudentTeacherLink[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [selectedPending, setSelectedPending] = useState<StudentTeacherLink | null>(null);
  const [pendingActionError, setPendingActionError] = useState<string | null>(null);
  const [pendingActionLoading, setPendingActionLoading] = useState(false);
  const [initialSetupLink, setInitialSetupLink] = useState<StudentTeacherLink | null>(null);
  const [initialSetupForm, setInitialSetupForm] = useState({
    custom_display_name: '',
    local_student_code: '',
    tags: '',
    private_note: '',
    kana_for_sort: '',
    color: '',
  });
  const [initialSetupSaving, setInitialSetupSaving] = useState(false);
  const [initialSetupError, setInitialSetupError] = useState<string | null>(null);

  const handleTeacherApiError = useCallback((err: unknown) => {
    if (err instanceof ApiError && err.status === 403) {
      router.replace('/teacher/access-denied');
      return true;
    }
    return false;
  }, [router]);

  const fetchPendingLinks = useCallback(async () => {
    try {
      setPendingLoading(true);
      const response = await apiGet('/api/student-teacher-links/?status=pending&page_size=50');
      const list: StudentTeacherLink[] = Array.isArray(response) ? response : response?.results || [];
      setPendingLinks(list);
    } catch (err) {
      console.error('Pending links fetch error:', err);
      if (handleTeacherApiError(err)) return;
    } finally {
      setPendingLoading(false);
    }
  }, [handleTeacherApiError]);

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
        console.error('Dashboard fetch error:', err);
        if (handleTeacherApiError(err)) return;
        setError('ダッシュボード情報の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    fetchPendingLinks();
  }, [router, handleTeacherApiError, fetchPendingLinks]);

  const openPendingModal = (link: StudentTeacherLink | null) => {
    setPendingActionError(null);
    setSelectedPending(link);
  };

  const refreshPending = async () => {
    await fetchPendingLinks();
  };

  const handleApprovePending = async () => {
    if (!selectedPending) return;
    try {
      const approvedLink = selectedPending;
      setPendingActionLoading(true);
      setPendingActionError(null);
      await apiPost(`/api/student-teacher-links/${selectedPending.student_teacher_link_id}/approve/`, {});
      await refreshPending();
      setSelectedPending(null);
      setInitialSetupLink(approvedLink);
      setInitialSetupForm({
        custom_display_name: approvedLink.custom_display_name || approvedLink.student_display_name || '',
        local_student_code: approvedLink.local_student_code || '',
        tags: (approvedLink.tags || []).join(','),
        private_note: approvedLink.private_note || '',
        kana_for_sort: approvedLink.kana_for_sort || '',
        color: approvedLink.color || '',
      });
    } catch (err) {
      console.error('Approve pending error:', err);
      if (handleTeacherApiError(err)) return;
      setPendingActionError('承認に失敗しました。時間をおいて再試行してください。');
    } finally {
      setPendingActionLoading(false);
    }
  };

  const handleRejectPending = async () => {
    if (!selectedPending) return;
    try {
      setPendingActionLoading(true);
      setPendingActionError(null);
      await apiPost(`/api/student-teacher-links/${selectedPending.student_teacher_link_id}/revoke/`, {});
      await refreshPending();
      setSelectedPending(null);
    } catch (err) {
      console.error('Reject pending error:', err);
      if (handleTeacherApiError(err)) return;
      setPendingActionError('拒否に失敗しました。時間をおいて再試行してください。');
    } finally {
      setPendingActionLoading(false);
    }
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return '---';
    try {
      return new Date(value).toLocaleString('ja-JP');
    } catch {
      return value;
    }
  };

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
        <section className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-emerald-50 to-green-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserGroupIcon className="h-5 w-5 text-emerald-600" />
              <h2 className="text-lg font-semibold text-slate-900">紐付け申請</h2>
            </div>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              {pendingLinks.length} 件
            </span>
          </div>
          <div className="p-6 space-y-4">
            {pendingLoading ? (
              <div className="text-center text-sm text-slate-500">読み込み中...</div>
            ) : pendingLinks.length === 0 ? (
              <p className="text-sm text-slate-500">現在、紐付け申請はありません。</p>
            ) : (
              <>
                <ul className="divide-y">
                  {pendingLinks.slice(0, 3).map((link) => (
                    <li key={link.student_teacher_link_id}>
                      <button
                        type="button"
                        onClick={() => openPendingModal(link)}
                        className="w-full text-left py-3 flex items-center justify-between gap-3 hover:bg-emerald-50 rounded-lg px-2 transition"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {link.student_display_name || '名前未設定'}
                          </p>
                          <p className="text-xs text-slate-500">
                            申請日時: {formatDateTime(link.linked_at)}
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-emerald-700">
                          詳細 →
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {pendingLinks.length > 3 && (
                  <button
                    type="button"
                    onClick={() => openPendingModal(pendingLinks[0])}
                    className="text-sm text-emerald-700 font-semibold hover:underline"
                  >
                    すべての申請を見る →
                  </button>
                )}
              </>
            )}
          </div>
        </section>
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

      {selectedPending && (
        <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">申請内容の確認</h3>
              <button
                type="button"
                onClick={() => openPendingModal(null)}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col items-center text-center gap-3">
              {selectedPending.student_avatar_url ? (
                <img
                  src={selectedPending.student_avatar_url}
                  alt={`${selectedPending.student_display_name || '生徒'}のアイコン`}
                  className="w-24 h-24 rounded-full object-cover border border-slate-200"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center text-3xl text-slate-500">
                  👤
                </div>
              )}
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {selectedPending.student_display_name || '名前未設定'}
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  {selectedPending.student_grade || '学年・クラス情報は未設定'}
                </p>
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700 max-h-48 overflow-y-auto whitespace-pre-wrap">
              {selectedPending.student_self_intro || '自己紹介はまだ登録されていません。'}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>申請日時: {formatDateTime(selectedPending.linked_at)}</span>
              <span>プロフィール更新: {formatDateTime(selectedPending.student_profile_updated_at)}</span>
            </div>
            {pendingActionError && (
              <p className="text-sm text-red-600 text-center">{pendingActionError}</p>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleRejectPending}
                disabled={pendingActionLoading}
                className="flex-1 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {pendingActionLoading ? '処理中...' : '拒否する'}
              </button>
              <button
                type="button"
                onClick={handleApprovePending}
                disabled={pendingActionLoading}
                className="flex-1 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {pendingActionLoading ? '処理中...' : '承認する'}
              </button>
            </div>
            <button
              type="button"
              onClick={() => openPendingModal(null)}
              className="w-full text-sm text-slate-500 hover:text-slate-700"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
      {initialSetupLink && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">生徒の初期設定</h3>
              <button
                type="button"
                onClick={() => setInitialSetupLink(null)}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-slate-600">
              承認した生徒の表示名やタグ、メモをここでまとめて設定できます。（あとから生徒一覧でも変更できます）
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-800">表示名</label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={initialSetupForm.custom_display_name}
                  onChange={(e) => setInitialSetupForm({ ...initialSetupForm, custom_display_name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-800">ローカルコード</label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={initialSetupForm.local_student_code}
                  onChange={(e) => setInitialSetupForm({ ...initialSetupForm, local_student_code: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-800">タグ（カンマ区切り）</label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={initialSetupForm.tags}
                  onChange={(e) => setInitialSetupForm({ ...initialSetupForm, tags: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-800">並び替え用かな</label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={initialSetupForm.kana_for_sort}
                  onChange={(e) => setInitialSetupForm({ ...initialSetupForm, kana_for_sort: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-800">色コード</label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="#RRGGBB"
                  value={initialSetupForm.color}
                  onChange={(e) => setInitialSetupForm({ ...initialSetupForm, color: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-800">メモ</label>
                <textarea
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  rows={3}
                  value={initialSetupForm.private_note}
                  onChange={(e) => setInitialSetupForm({ ...initialSetupForm, private_note: e.target.value })}
                />
              </div>
            </div>
            {initialSetupError && (
              <p className="text-sm text-red-600">{initialSetupError}</p>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setInitialSetupLink(null)}
                className="flex-1 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                スキップ
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!initialSetupLink) return;
                  setInitialSetupError(null);
                  try {
                    setInitialSetupSaving(true);
                    await apiPatch('/api/teacher/students/', {
                      student_teacher_link_id: initialSetupLink.student_teacher_link_id,
                      custom_display_name: initialSetupForm.custom_display_name,
                      local_student_code: initialSetupForm.local_student_code,
                      tags: initialSetupForm.tags
                        .split(',')
                        .map((t) => t.trim())
                        .filter(Boolean),
                      private_note: initialSetupForm.private_note,
                      kana_for_sort: initialSetupForm.kana_for_sort,
                      color: initialSetupForm.color,
                    });
                    setInitialSetupLink(null);
                    setActionMessage('生徒の初期設定を保存しました');
                  } catch (err) {
                    console.error('Initial setup save error:', err);
                    setInitialSetupError('初期設定の保存に失敗しました。時間をおいて再試行してください。');
                  } finally {
                    setInitialSetupSaving(false);
                  }
                }}
                disabled={initialSetupSaving}
                className="flex-1 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {initialSetupSaving ? '保存中...' : '保存して完了'}
              </button>
            </div>
          </div>
        </div>
      )}

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
