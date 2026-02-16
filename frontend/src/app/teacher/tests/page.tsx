'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  duplicateTest,
  getTeacherTestAssignments,
  getTeacherTests,
  updateTest,
} from '@/lib/api/test';
import type { Test, TestAssignment } from '@/types/test';

type AssignmentRunParamsLike = {
  schedule?: {
    start_at?: string;
    end_at?: string;
  };
};

const extractRunParams = (assignment: TestAssignment): AssignmentRunParamsLike => {
  const raw = assignment.run_params as Record<string, unknown> | undefined;
  if (!raw) return {};
  const nested = raw.run_params as AssignmentRunParamsLike | undefined;
  return nested || (raw as AssignmentRunParamsLike);
};

const isActiveAssignment = (assignment: TestAssignment, nowMs: number): boolean => {
  const schedule = extractRunParams(assignment).schedule;
  if (!schedule?.start_at || !schedule?.end_at) return false;
  const start = new Date(schedule.start_at).getTime();
  const end = new Date(schedule.end_at).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return start <= nowMs && nowMs <= end;
};

export default function TeacherTestsPage() {
  const router = useRouter();
  const [tests, setTests] = useState<Test[]>([]);
  const [assignments, setAssignments] = useState<TestAssignment[]>([]);
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [testsResponse, assignmentsResponse] = await Promise.all([
        getTeacherTests(),
        getTeacherTestAssignments(),
      ]);
      const testList: Test[] = Array.isArray(testsResponse)
        ? testsResponse
        : testsResponse?.results || [];
      const assignmentList: TestAssignment[] = Array.isArray(assignmentsResponse)
        ? assignmentsResponse
        : assignmentsResponse?.results || [];

      setTests(testList);
      setAssignments(assignmentList);
      setTitleDrafts(
        testList.reduce<Record<string, string>>((acc, test) => {
          acc[test.test_id] = test.title;
          return acc;
        }, {})
      );
    } catch (err) {
      console.error(err);
      setError('テスト一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeAssignmentCounts = useMemo(() => {
    const nowMs = Date.now();
    return assignments.reduce<Record<string, number>>((acc, assignment) => {
      if (!isActiveAssignment(assignment, nowMs)) return acc;
      acc[assignment.test] = (acc[assignment.test] || 0) + 1;
      return acc;
    }, {});
  }, [assignments]);

  const visibleTests = useMemo(
    () => tests.filter((test) => includeArchived || !test.archived_at),
    [tests, includeArchived]
  );

  const handleTitleBlur = async (test: Test) => {
    const nextTitle = (titleDrafts[test.test_id] || '').trim();
    if (!nextTitle || nextTitle === test.title) return;
    try {
      const updated = await updateTest(test.test_id, { title: nextTitle });
      setTests((prev) => prev.map((item) => (item.test_id === test.test_id ? updated : item)));
    } catch (err) {
      console.error(err);
      setError('タイトルの更新に失敗しました');
      setTitleDrafts((prev) => ({ ...prev, [test.test_id]: test.title }));
    }
  };

  const handleTitleCommit = async (test: Test) => {
    await handleTitleBlur(test);
    setEditingTestId(null);
  };

  const handleArchiveTest = async (test: Test) => {
    if (test.archived_at) return;
    if (!window.confirm('このテストをアーカイブしますか？')) return;
    try {
      const updated = await updateTest(test.test_id, { archived_at: new Date().toISOString() });
      setTests((prev) => prev.map((item) => (item.test_id === test.test_id ? updated : item)));
      setActionMessage('テストをアーカイブしました');
    } catch (err) {
      console.error(err);
      setError('アーカイブに失敗しました');
    }
  };

  const handleUnarchiveTest = async (test: Test) => {
    if (!test.archived_at) return;
    if (!window.confirm('このテストのアーカイブを解除しますか？')) return;
    try {
      const updated = await updateTest(test.test_id, { archived_at: null });
      setTests((prev) => prev.map((item) => (item.test_id === test.test_id ? updated : item)));
      setActionMessage('アーカイブを解除しました');
    } catch (err) {
      console.error(err);
      setError('アーカイブ解除に失敗しました');
    }
  };

  const handleDuplicateTest = async (test: Test) => {
    const suggestedTitle = `${test.title} (copy)`;
    const input = window.prompt('複製後のタイトル（空欄なら自動）', suggestedTitle);
    if (input === null) return;
    const title = input.trim();
    try {
      await duplicateTest(test.test_id, title || undefined);
      setActionMessage('テストを複製しました');
      await loadData();
    } catch (err) {
      console.error(err);
      setError('複製に失敗しました');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">テスト一覧</h1>
          <p className="text-slate-600">テストの編集と配信状況を確認します。</p>
        </div>
        <div className="flex items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              checked={includeArchived}
              onChange={(event) => setIncludeArchived(event.target.checked)}
            />
            アーカイブ含む
          </label>
          <Link
            href="/teacher/tests/new"
            className="inline-flex items-center px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
          >
            新しいテストを作成
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {actionMessage && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {actionMessage}
        </div>
      )}

      <div className="bg-white shadow rounded-lg divide-y">
        <div className="grid grid-cols-5 gap-4 px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <span>タイトル</span>
          <span>問題数</span>
          <span>公開数</span>
          <span>最終更新</span>
          <span className="text-right">操作</span>
        </div>
        {visibleTests.map((test) => (
          <div
            key={test.test_id}
            onClick={(event) => {
              if (editingTestId === test.test_id) return;
              const target = event.target as HTMLElement;
              if (target.closest('button, a, input, textarea, select')) return;
              router.push(`/teacher/tests/${test.test_id}`);
            }}
            className="grid grid-cols-5 gap-4 px-6 py-3 text-sm text-slate-700 border-t border-slate-100 cursor-pointer hover:bg-slate-50"
          >
            <div className="flex flex-col gap-1">
              {editingTestId === test.test_id ? (
                <input
                  autoFocus
                  className="rounded border border-slate-200 px-2 py-1 text-sm"
                  value={titleDrafts[test.test_id] ?? test.title}
                  onChange={(event) =>
                    setTitleDrafts((prev) => ({ ...prev, [test.test_id]: event.target.value }))
                  }
                  onBlur={() => {
                    void handleTitleCommit(test);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.currentTarget.blur();
                    }
                    if (event.key === 'Escape') {
                      setTitleDrafts((prev) => ({ ...prev, [test.test_id]: test.title }));
                      setEditingTestId(null);
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  onDoubleClick={() => setEditingTestId(test.test_id)}
                  className="text-left text-slate-900 hover:text-slate-700"
                  title="ダブルクリックで編集"
                >
                  {test.title}
                </button>
              )}
              {test.archived_at && <span className="text-xs text-amber-600">アーカイブ済み</span>}
            </div>
            <span>{test.question_count ?? '-'}</span>
            <span>{activeAssignmentCounts[test.test_id] ?? 0}</span>
            <span>{new Date(test.updated_at).toLocaleString()}</span>
            <div className="flex flex-wrap justify-end gap-2">
              <Link
                href={`/teacher/tests/${test.test_id}/edit`}
                className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                内容編集
              </Link>
              <button
                type="button"
                onClick={() => handleDuplicateTest(test)}
                className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                複製
              </button>
              <button
                type="button"
                onClick={() =>
                  test.archived_at ? handleUnarchiveTest(test) : handleArchiveTest(test)
                }
                className={
                  test.archived_at
                    ? 'inline-flex items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100'
                    : 'inline-flex items-center justify-center rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100'
                }
              >
                {test.archived_at ? 'アーカイブ解除' : 'アーカイブ'}
              </button>
            </div>
          </div>
        ))}
        {visibleTests.length === 0 && (
          <div className="px-6 py-6 text-sm text-slate-500">表示できるテストがありません。</div>
        )}
      </div>
    </div>
  );
}
