'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  createTestAssignment,
  assignStudents,
  getTeacherAssignmentResults,
  getTeacherTestAssignments,
  getTest,
} from '@/lib/api/test';
import { apiGet } from '@/lib/api-utils';
import type { Test, TestAssignment } from '@/types/test';

type AssignmentRunParamsLike = {
  schedule?: {
    start_at?: string;
    end_at?: string;
  };
  attempts?: {
    default_max_attempts?: number;
  };
};

type TeacherStudentListItem = {
  student_teacher_link_id: string;
  student_id: string;
  display_name: string;
  status: 'pending' | 'active' | 'revoked';
  local_student_code?: string | null;
  tags?: string[];
};

const toLocalInput = (date: Date) => {
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
};

export default function TeacherTestDetailPage() {
  const params = useParams();
  const testId = params.testId as string;

  const [test, setTest] = useState<Test | null>(null);
  const [assignments, setAssignments] = useState<TestAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<TestAssignment | null>(null);
  const [students, setStudents] = useState<TeacherStudentListItem[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [studentQuery, setStudentQuery] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignedCounts, setAssignedCounts] = useState<Record<string, number>>({});

  const [note, setNote] = useState('');
  const [maxAttempts, setMaxAttempts] = useState(2);
  const [startAt, setStartAt] = useState(() => toLocalInput(new Date(Date.now() - 5 * 60 * 1000)));
  const [endAt, setEndAt] = useState(() => toLocalInput(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)));

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [testData, assignmentsData] = await Promise.all([
        getTest(testId),
        getTeacherTestAssignments(),
      ]);

      const list = Array.isArray(assignmentsData)
        ? assignmentsData
        : assignmentsData?.results || [];

      setTest(testData);
      setAssignments(list.filter((a) => a.test === testId));
    } catch (e) {
      console.error(e);
      setError('テスト詳細の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  const handleCreateAssignment = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError(null);

      const runParams = {
        schema_version: 1 as const,
        timezone: 'Asia/Tokyo' as const,
        schedule: {
          start_at: new Date(startAt).toISOString(),
          end_at: new Date(endAt).toISOString(),
        },
        timer: {
          mode: 'uniform' as const,
          seconds: 10,
        },
        attempts: {
          default_max_attempts: Number(maxAttempts),
          source_of_truth: 'testassignee' as const,
        },
        override_translations: {},
        ui: { theme: 'test_yellow_orange' },
        targets_snapshot: { students: [], groups: [] },
      };

      await createTestAssignment({
        test: testId,
        note: note || undefined,
        run_params: runParams,
      });

      setNote('');
      await loadData();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : '配信作成に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const rows = useMemo(
    () => [...assignments].sort((a, b) => (a.assigned_at < b.assigned_at ? 1 : -1)),
    [assignments]
  );

  const extractRunParams = (assignment: TestAssignment): AssignmentRunParamsLike => {
    const raw = assignment.run_params as Record<string, unknown> | undefined;
    if (!raw) return {};
    const nested = raw.run_params as AssignmentRunParamsLike | undefined;
    return nested || (raw as AssignmentRunParamsLike);
  };

  const openAssignModal = async (assignment: TestAssignment) => {
    setAssignTarget(assignment);
    setAssignModalOpen(true);
    setAssignError(null);
    setAssignLoading(true);

    try {
      const [studentsResponse, resultsResponse] = await Promise.all([
        apiGet('/teacher/students/'),
        getTeacherAssignmentResults(assignment.test_assignment_id),
      ]);

      const studentList = Array.isArray(studentsResponse) ? studentsResponse : [];
      setStudents(studentList);

      const assignedIds = new Set(
        (resultsResponse?.rows || []).map((row) => row.student_id)
      );
      setSelectedStudentIds(assignedIds);
      setAssignedCounts((prev) => ({
        ...prev,
        [assignment.test_assignment_id]: assignedIds.size,
      }));
    } catch (e) {
      console.error(e);
      setAssignError('生徒一覧の取得に失敗しました。');
    } finally {
      setAssignLoading(false);
    }
  };

  const closeAssignModal = () => {
    setAssignModalOpen(false);
    setAssignTarget(null);
    setStudents([]);
    setSelectedStudentIds(new Set());
    setStudentQuery('');
    setAssignError(null);
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const handleAssignStudents = async () => {
    if (!assignTarget) return;
    if (selectedStudentIds.size === 0) {
      setAssignError('割当対象の生徒を選択してください。');
      return;
    }

    try {
      setAssignSaving(true);
      setAssignError(null);
      const studentIds = Array.from(selectedStudentIds);
      const result = await assignStudents(assignTarget.test_assignment_id, {
        students: studentIds,
        groups: [],
      });
      setAssignedCounts((prev) => ({
        ...prev,
        [assignTarget.test_assignment_id]: (prev[assignTarget.test_assignment_id] || 0) + (result?.assigned_count || 0),
      }));
      closeAssignModal();
    } catch (e) {
      console.error(e);
      setAssignError('生徒割当の実行に失敗しました。');
    } finally {
      setAssignSaving(false);
    }
  };

  const filteredStudents = useMemo(() => {
    const keyword = studentQuery.trim().toLowerCase();
    return students
      .filter((student) => student.status === 'active')
      .filter((student) => {
        if (!keyword) return true;
        const code = (student.local_student_code || '').toLowerCase();
        const name = (student.display_name || '').toLowerCase();
        return name.includes(keyword) || code.includes(keyword);
      })
      .sort((a, b) => a.display_name.localeCompare(b.display_name));
  }, [students, studentQuery]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error && !test) {
    return (
      <div className="max-w-4xl mx-auto py-10">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">テスト詳細</h1>
        <p className="text-slate-600">{test?.title}</p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-lg bg-white shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">配信作成</h2>
        <form onSubmit={handleCreateAssignment} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <label className="flex flex-col text-sm text-slate-700">
            メモ
            <input
              className="mt-1 rounded border border-slate-300 px-3 py-2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例: 配信A"
            />
          </label>

          <label className="flex flex-col text-sm text-slate-700">
            最大受験回数
            <input
              type="number"
              min={1}
              max={99}
              className="mt-1 rounded border border-slate-300 px-3 py-2"
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(Number(e.target.value))}
            />
          </label>

          <label className="flex flex-col text-sm text-slate-700">
            開始日時
            <input
              type="datetime-local"
              className="mt-1 rounded border border-slate-300 px-3 py-2"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              required
            />
          </label>

          <label className="flex flex-col text-sm text-slate-700">
            終了日時
            <input
              type="datetime-local"
              className="mt-1 rounded border border-slate-300 px-3 py-2"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              required
            />
          </label>

          <div className="md:col-span-4">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? '作成中...' : '配信を作成'}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-lg bg-white shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">配信一覧</h2>
        </div>
        <div className="grid grid-cols-7 gap-4 px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <span>配信ID</span>
          <span>メモ</span>
          <span>開始</span>
          <span>終了</span>
          <span>回数</span>
          <span>対象学生数</span>
          <span className="text-right">操作</span>
        </div>
        {rows.map((assignment) => {
          const params = extractRunParams(assignment);
          return (
            <div
              key={assignment.test_assignment_id}
              className="grid grid-cols-7 gap-4 px-6 py-3 text-sm text-slate-700 border-t border-slate-100"
            >
              <span className="truncate">{assignment.test_assignment_id}</span>
              <span>{assignment.note || '-'}</span>
              <span>{params.schedule?.start_at ? new Date(params.schedule.start_at).toLocaleString() : '-'}</span>
              <span>{params.schedule?.end_at ? new Date(params.schedule.end_at).toLocaleString() : '-'}</span>
              <span>{params.attempts?.default_max_attempts ?? '-'}</span>
              <span>{assignedCounts[assignment.test_assignment_id] ?? '-'}</span>
              <span className="text-right">
                <button
                  type="button"
                  onClick={() => openAssignModal(assignment)}
                  className="text-slate-600 hover:text-slate-900 hover:underline font-medium"
                >
                  生徒割当
                </button>
                <Link
                  href={`/teacher/test-assignments/${assignment.test_assignment_id}/results`}
                  className="text-indigo-600 hover:text-indigo-800 hover:underline font-medium"
                >
                  結果を見る
                </Link>
              </span>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="px-6 py-6 text-sm text-slate-500">配信はまだありません。</div>
        )}
      </div>

      {assignModalOpen && assignTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-3xl rounded-lg bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">生徒割当</h3>
                <p className="text-sm text-slate-500">配信ID: {assignTarget.test_assignment_id}</p>
              </div>
              <button
                type="button"
                onClick={closeAssignModal}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {assignError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                  {assignError}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700">検索</label>
                <input
                  type="text"
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="表示名 / 生徒コードで検索"
                  value={studentQuery}
                  onChange={(e) => setStudentQuery(e.target.value)}
                />
              </div>

              <div className="max-h-72 overflow-y-auto rounded border border-slate-200">
                {assignLoading ? (
                  <div className="p-4 text-sm text-slate-500">読み込み中...</div>
                ) : filteredStudents.length === 0 ? (
                  <div className="p-4 text-sm text-slate-500">対象の生徒が見つかりません。</div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {filteredStudents.map((student) => {
                      const checked = selectedStudentIds.has(student.student_id);
                      return (
                        <li key={student.student_id} className="flex items-center gap-3 px-4 py-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleStudentSelection(student.student_id)}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                          />
                          <div>
                            <div className="text-sm font-medium text-slate-900">{student.display_name}</div>
                            {student.local_student_code && (
                              <div className="text-xs text-slate-500">コード: {student.local_student_code}</div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
              <span className="text-sm text-slate-600">
                選択中: {selectedStudentIds.size} 人
              </span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeAssignModal}
                  className="px-4 py-2 rounded-md border border-slate-300 text-sm text-slate-700 hover:bg-slate-50"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleAssignStudents}
                  disabled={assignSaving || assignLoading}
                  className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {assignSaving ? '割当中...' : '割当する'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
