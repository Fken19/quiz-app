'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  assignStudents,
  createTestAssignment,
  downloadTeacherAssignmentResultsCSV,
  duplicateTest,
  getTeacherAssignmentResults,
  getTeacherTestAssignments,
  getTest,
  unassignStudents,
  updateTest,
  updateTestAssignment,
} from '@/lib/api/test';
import { apiGet } from '@/lib/api-utils';
import type { TeacherAssignmentResult, Test, TestAssignment } from '@/types/test';

type AssignmentRunParamsLike = {
  schedule?: {
    start_at?: string;
    end_at?: string;
  };
  attempts?: {
    default_max_attempts?: number;
  };
  timer?: {
    mode?: 'uniform';
    seconds?: number;
  };
  passing?: {
    percentage?: number | null;
  };
  control?: {
    paused?: boolean;
  };
  announcement?: {
    message?: string | null;
    updated_at?: string | null;
  };
  ui?: {
    theme?: string;
    show_test_content?: boolean;
  };
};

type AssignmentStatus = 'upcoming' | 'active' | 'ended' | 'unknown';

type TeacherStudentListItem = {
  student_teacher_link_id: string;
  student_id: string;
  display_name: string;
  status: 'pending' | 'active' | 'revoked';
  local_student_code?: string | null;
  tags?: string[];
};

type RosterFolderListItem = {
  roster_folder_id: string;
  name: string;
  member_count?: number;
  archived_at?: string | null;
};

type RosterMembershipListItem = {
  roster_membership_id: string;
  roster_folder_id: string;
  student?: string;
  student_id?: string;
};

const statusLabels: Record<AssignmentStatus, string> = {
  upcoming: '開始前',
  active: '公開中',
  ended: '終了',
  unknown: '未設定',
};

const assigneeStatusLabels: Record<TeacherAssignmentResult['status'], string> = {
  attempted: '受験済み',
  unattempted: '未受験',
  expired_unattempted: '期限切れ',
};

const assigneeStatusStyles: Record<TeacherAssignmentResult['status'], string> = {
  attempted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  unattempted: 'bg-slate-50 text-slate-600 border-slate-200',
  expired_unattempted: 'bg-amber-50 text-amber-700 border-amber-200',
};

const toLocalInput = (date: Date) => {
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
};

const toLocalInputSafe = (value?: string) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return toLocalInput(parsed);
};

const formatTotalSeconds = (totalSeconds: number) => {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '-';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}分${seconds.toString().padStart(2, '0')}秒`;
};

const getRunParamsObject = (assignment: TestAssignment): Record<string, unknown> => {
  const raw = assignment.run_params as Record<string, unknown> | undefined;
  if (!raw) return {};
  const nested = raw.run_params as Record<string, unknown> | undefined;
  return nested || raw;
};

const extractRunParams = (assignment: TestAssignment): AssignmentRunParamsLike => {
  return getRunParamsObject(assignment) as AssignmentRunParamsLike;
};

const getAssignmentStatus = (assignment: TestAssignment, nowMs: number): AssignmentStatus => {
  const schedule = extractRunParams(assignment).schedule;
  if (!schedule?.start_at || !schedule?.end_at) return 'unknown';
  const start = new Date(schedule.start_at).getTime();
  const end = new Date(schedule.end_at).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 'unknown';
  if (nowMs < start) return 'upcoming';
  if (nowMs <= end) return 'active';
  return 'ended';
};

export default function TeacherTestDetailPage() {
  const params = useParams();
  const testId = params.testId as string;

  const [test, setTest] = useState<Test | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [assignments, setAssignments] = useState<TestAssignment[]>([]);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [startAtDrafts, setStartAtDrafts] = useState<Record<string, string>>({});
  const [endAtDrafts, setEndAtDrafts] = useState<Record<string, string>>({});
  const [maxAttemptsDrafts, setMaxAttemptsDrafts] = useState<Record<string, string>>({});
  const [timerSecondsDrafts, setTimerSecondsDrafts] = useState<Record<string, string>>({});
  const [totalTimeDrafts, setTotalTimeDrafts] = useState<Record<string, string>>({});
  const [passingPercentageDrafts, setPassingPercentageDrafts] = useState<Record<string, string>>({});
  const [announcementDrafts, setAnnouncementDrafts] = useState<Record<string, string>>({});
  const [editingField, setEditingField] = useState<{
    assignmentId: string;
    field:
      | 'note'
      | 'start_at'
      | 'end_at'
      | 'max_attempts'
      | 'timer_seconds'
      | 'total_time'
      | 'passing_percentage'
      | 'announcement';
  } | null>(null);
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState<'all' | AssignmentStatus>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<TestAssignment | null>(null);
  const [students, setStudents] = useState<TeacherStudentListItem[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [assignedStudentIds, setAssignedStudentIds] = useState<Set<string>>(new Set());
  const [assignedRows, setAssignedRows] = useState<TeacherAssignmentResult[]>([]);
  const [assignedSummary, setAssignedSummary] = useState<{
    assignee_count: number;
    attempted_count: number;
    unattempted_count: number;
  } | null>(null);
  const [groups, setGroups] = useState<RosterFolderListItem[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [groupMembers, setGroupMembers] = useState<Record<string, string[]>>({});
  const [groupLoadingIds, setGroupLoadingIds] = useState<Set<string>>(new Set());
  const [studentQuery, setStudentQuery] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignedCounts, setAssignedCounts] = useState<Record<string, number>>({});

  const [note, setNote] = useState('');
  const [maxAttempts, setMaxAttempts] = useState(2);
  const [timerSeconds, setTimerSeconds] = useState(10);
  const [totalTimeSeconds, setTotalTimeSeconds] = useState(0);
  const [passingPercentage, setPassingPercentage] = useState(80);
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [showTestContent, setShowTestContent] = useState(true);
  const [startAt, setStartAt] = useState(() => toLocalInput(new Date(Date.now() - 5 * 60 * 1000)));
  const [endAt, setEndAt] = useState(() => {
    const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    end.setHours(23, 59, 0, 0);
    return toLocalInput(end);
  });

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

      const filteredAssignments = list.filter((assignment) => assignment.test === testId);

      setTest(testData);
      setTitleDraft(testData.title);
      const questionCount = testData.question_count || 0;
      setTotalTimeSeconds((prev) =>
        prev > 0 ? prev : questionCount * (Number(timerSeconds) || 10)
      );
      setAssignments(filteredAssignments);
      setNoteDrafts(
        filteredAssignments.reduce<Record<string, string>>((acc, assignment) => {
          acc[assignment.test_assignment_id] = assignment.note || '';
          return acc;
        }, {})
      );
      setStartAtDrafts(
        filteredAssignments.reduce<Record<string, string>>((acc, assignment) => {
          const params = extractRunParams(assignment);
          acc[assignment.test_assignment_id] = toLocalInputSafe(params.schedule?.start_at);
          return acc;
        }, {})
      );
      setEndAtDrafts(
        filteredAssignments.reduce<Record<string, string>>((acc, assignment) => {
          const params = extractRunParams(assignment);
          acc[assignment.test_assignment_id] = toLocalInputSafe(params.schedule?.end_at);
          return acc;
        }, {})
      );
      setMaxAttemptsDrafts(
        filteredAssignments.reduce<Record<string, string>>((acc, assignment) => {
          const params = extractRunParams(assignment);
          acc[assignment.test_assignment_id] = params.attempts?.default_max_attempts
            ? String(params.attempts.default_max_attempts)
            : '';
          return acc;
        }, {})
      );
      setTimerSecondsDrafts(
        filteredAssignments.reduce<Record<string, string>>((acc, assignment) => {
          const params = extractRunParams(assignment);
          const perQuestionSeconds = params.timer?.seconds ?? 10;
          acc[assignment.test_assignment_id] = String(perQuestionSeconds);
          return acc;
        }, {})
      );
      setTotalTimeDrafts(
        filteredAssignments.reduce<Record<string, string>>((acc, assignment) => {
          const params = extractRunParams(assignment);
          const perQuestionSeconds = params.timer?.seconds ?? 10;
          const totalSeconds = (testData.question_count || 0) * perQuestionSeconds;
          acc[assignment.test_assignment_id] = totalSeconds ? String(totalSeconds) : '';
          return acc;
        }, {})
      );
      setPassingPercentageDrafts(
        filteredAssignments.reduce<Record<string, string>>((acc, assignment) => {
          const params = extractRunParams(assignment);
          const passing = params.passing?.percentage;
          acc[assignment.test_assignment_id] = Number.isFinite(passing as number)
            ? String(passing)
            : '';
          return acc;
        }, {})
      );
      setAnnouncementDrafts(
        filteredAssignments.reduce<Record<string, string>>((acc, assignment) => {
          const params = extractRunParams(assignment);
          acc[assignment.test_assignment_id] = params.announcement?.message || '';
          return acc;
        }, {})
      );
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

  const handleTitleBlur = async () => {
    if (!test) return;
    const nextTitle = titleDraft.trim();
    if (!nextTitle || nextTitle === test.title) return;
    try {
      const updated = await updateTest(test.test_id, { title: nextTitle });
      setTest(updated);
      setActionMessage('タイトルを更新しました');
    } catch (e) {
      console.error(e);
      setError('タイトルの更新に失敗しました');
      setTitleDraft(test.title);
    }
  };

  const handleTitleCommit = async () => {
    await handleTitleBlur();
    setIsEditingTitle(false);
  };

  const handleArchiveTest = async () => {
    if (!test || test.archived_at) return;
    if (!window.confirm('このテストをアーカイブしますか？')) return;
    try {
      const updated = await updateTest(test.test_id, { archived_at: new Date().toISOString() });
      setTest(updated);
      setActionMessage('テストをアーカイブしました');
    } catch (e) {
      console.error(e);
      setError('アーカイブに失敗しました');
    }
  };

  const handleDuplicateTest = async () => {
    if (!test) return;
    const suggestedTitle = `${test.title} (copy)`;
    const input = window.prompt('複製後のタイトル（空欄なら自動）', suggestedTitle);
    if (input === null) return;
    const title = input.trim();
    try {
      await duplicateTest(test.test_id, title || undefined);
      setActionMessage('テストを複製しました');
      await loadData();
    } catch (e) {
      console.error(e);
      setError('複製に失敗しました');
    }
  };

  const handleTimerSecondsChange = (value: number) => {
    const normalized = Math.min(Math.max(value || 1, 1), 120);
    setTimerSeconds(normalized);
    if (questionCount > 0) {
      setTotalTimeSeconds(normalized * questionCount);
    }
  };

  const handleTotalTimeSecondsChange = (value: number) => {
    const total = Math.max(value || 1, 1);
    if (questionCount > 0) {
      const perQuestion = Math.ceil(total / questionCount);
      const normalized = Math.min(Math.max(perQuestion, 1), 120);
      setTimerSeconds(normalized);
      setTotalTimeSeconds(normalized * questionCount);
      return;
    }
    setTotalTimeSeconds(total);
  };

  const handleCreateAssignment = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError(null);

      const trimmedAnnouncement = announcementMessage.trim();
      const questionCount = test?.question_count ?? 0;
      const normalizedTimerSeconds = Math.min(Math.max(Number(timerSeconds) || 10, 1), 120);
      const normalizedPassingPercentage = Math.min(
        Math.max(Math.round(Number(passingPercentage) || 0), 0),
        100
      );
      const runParams = {
        schema_version: 1 as const,
        timezone: 'Asia/Tokyo' as const,
        schedule: {
          start_at: new Date(startAt).toISOString(),
          end_at: new Date(endAt).toISOString(),
        },
        timer: {
          mode: 'uniform' as const,
          seconds: normalizedTimerSeconds,
        },
        attempts: {
          default_max_attempts: Number(maxAttempts),
          source_of_truth: 'testassignee' as const,
        },
        passing: {
          percentage: normalizedPassingPercentage,
        },
        announcement: trimmedAnnouncement
          ? { message: trimmedAnnouncement, updated_at: new Date().toISOString() }
          : {},
        override_translations: {},
        ui: { theme: 'test_yellow_orange', show_test_content: showTestContent },
        targets_snapshot: { students: [], groups: [] },
      };

      await createTestAssignment({
        test: testId,
        note: note || undefined,
        run_params: runParams,
      });

      setNote('');
      setAnnouncementMessage('');
      await loadData();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : '配信作成に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const rows = useMemo(() => {
    const nowMs = Date.now();
    const filtered = assignments.filter((assignment) => {
      if (assignmentStatusFilter === 'all') return true;
      return getAssignmentStatus(assignment, nowMs) === assignmentStatusFilter;
    });
    return [...filtered].sort((a, b) => (a.assigned_at < b.assigned_at ? 1 : -1));
  }, [assignments, assignmentStatusFilter]);

  const refreshAssignedData = async (assignmentId: string) => {
    const resultsResponse = await getTeacherAssignmentResults(assignmentId);
    const rowsData = resultsResponse?.rows || [];
    setAssignedRows(rowsData);
    setAssignedSummary(resultsResponse?.summary || null);
    const assignedIds = new Set(rowsData.map((row) => row.student_id));
    setAssignedStudentIds(assignedIds);
    setSelectedStudentIds(new Set(assignedIds));
    setAssignedCounts((prev) => ({
      ...prev,
      [assignmentId]: rowsData.length,
    }));
    return assignedIds;
  };

  const openAssignModal = async (assignment: TestAssignment) => {
    setAssignTarget(assignment);
    setAssignModalOpen(true);
    setAssignError(null);
    setAssignLoading(true);

    try {
      const [studentsResponse, groupsResponse, resultsResponse] = await Promise.all([
        apiGet('/teacher/students/'),
        apiGet('/roster-folders/?page_size=200'),
        getTeacherAssignmentResults(assignment.test_assignment_id),
      ]);

      const studentList = Array.isArray(studentsResponse) ? studentsResponse : [];
      setStudents(studentList);

      const groupList = Array.isArray(groupsResponse)
        ? groupsResponse
        : groupsResponse?.results || [];
      setGroups(groupList);

      const rowsData = resultsResponse?.rows || [];
      setAssignedRows(rowsData);
      setAssignedSummary(resultsResponse?.summary || null);
      const assignedIds = new Set(rowsData.map((row) => row.student_id));
      setAssignedStudentIds(assignedIds);
      setAssignedCounts((prev) => ({
        ...prev,
        [assignment.test_assignment_id]: assignedIds.size,
      }));
      setSelectedStudentIds(new Set(assignedIds));
      setSelectedGroupIds(new Set());
      setGroupMembers({});
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
    setAssignedStudentIds(new Set());
    setAssignedRows([]);
    setAssignedSummary(null);
    setGroups([]);
    setSelectedGroupIds(new Set());
    setGroupMembers({});
    setGroupLoadingIds(new Set());
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

  const fetchGroupMembers = async (groupId: string) => {
    if (groupMembers[groupId]) return groupMembers[groupId];
    setGroupLoadingIds((prev) => new Set(prev).add(groupId));
    try {
      const response = await apiGet(`/roster-memberships/?roster_folder_id=${groupId}&page_size=200`);
      const list: RosterMembershipListItem[] = Array.isArray(response?.results)
        ? response.results
        : Array.isArray(response)
          ? response
          : [];
      const studentIds = list
        .map((item) => (typeof item.student === 'string' ? item.student : item.student_id))
        .filter((value): value is string => Boolean(value));
      setGroupMembers((prev) => ({ ...prev, [groupId]: studentIds }));
      return studentIds;
    } catch (e) {
      console.error(e);
      setAssignError('グループの生徒取得に失敗しました。');
      return [];
    } finally {
      setGroupLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
    }
  };

  const handleAssignStudents = async () => {
    if (!assignTarget) return;
    try {
      setAssignSaving(true);
      setAssignError(null);
      const toAssign = Array.from(selectedStudentIds).filter(
        (studentId) => !assignedStudentIds.has(studentId) && activeStudentIds.has(studentId)
      );
      const toUnassign = Array.from(assignedStudentIds).filter(
        (studentId) => !selectedStudentIds.has(studentId)
      );

      if (toAssign.length === 0 && toUnassign.length === 0) {
        setAssignError('変更がありません。');
        return;
      }

      if (toAssign.length > 0) {
        await assignStudents(assignTarget.test_assignment_id, {
          students: toAssign,
          groups: [],
        });
      }
      if (toUnassign.length > 0) {
        await unassignStudents(assignTarget.test_assignment_id, { students: toUnassign });
      }

      await refreshAssignedData(assignTarget.test_assignment_id);
    } catch (e) {
      console.error(e);
      setAssignError('割当の反映に失敗しました。');
    } finally {
      setAssignSaving(false);
    }
  };

  const toggleGroupSelection = async (groupId: string) => {
    if (selectedGroupIds.has(groupId)) {
      setSelectedGroupIds((prev) => {
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
      return;
    }
    setSelectedGroupIds((prev) => new Set(prev).add(groupId));
    const members = await fetchGroupMembers(groupId);
    const activeMembers = members.filter((studentId) => activeStudentIds.has(studentId));
    if (activeMembers.length > 0) {
      setSelectedStudentIds((prev) => {
        const next = new Set(prev);
        activeMembers.forEach((studentId) => next.add(studentId));
        return next;
      });
    }
  };

  const isEditing = (
    assignmentId: string,
    field:
      | 'note'
      | 'start_at'
      | 'end_at'
      | 'max_attempts'
      | 'timer_seconds'
      | 'total_time'
      | 'passing_percentage'
      | 'announcement'
  ) => editingField?.assignmentId === assignmentId && editingField.field === field;

  const actionButtonBase =
    'inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-semibold transition whitespace-nowrap';

  const questionCount = test?.question_count ?? 0;

  const updateTimerDraftsFromPerQuestion = (assignmentId: string, perQuestionSeconds: number) => {
    const normalized = Math.min(Math.max(perQuestionSeconds, 1), 120);
    const totalSeconds = questionCount ? normalized * questionCount : normalized;
    setTimerSecondsDrafts((prev) => ({ ...prev, [assignmentId]: String(normalized) }));
    setTotalTimeDrafts((prev) => ({ ...prev, [assignmentId]: String(totalSeconds) }));
  };

  const updateTimerDraftsFromTotal = (assignmentId: string, totalSeconds: number) => {
    const total = Math.max(totalSeconds, 0);
    const perQuestion = questionCount ? Math.ceil(total / questionCount) : total;
    const normalized = Math.min(Math.max(perQuestion, 1), 120);
    const normalizedTotal = questionCount ? normalized * questionCount : normalized;
    setTotalTimeDrafts((prev) => ({ ...prev, [assignmentId]: String(normalizedTotal) }));
    setTimerSecondsDrafts((prev) => ({ ...prev, [assignmentId]: String(normalized) }));
  };

  const syncDraftsFromAssignment = (assignment: TestAssignment) => {
    const params = extractRunParams(assignment);
    setNoteDrafts((prev) => ({ ...prev, [assignment.test_assignment_id]: assignment.note || '' }));
    setStartAtDrafts((prev) => ({
      ...prev,
      [assignment.test_assignment_id]: toLocalInputSafe(params.schedule?.start_at),
    }));
    setEndAtDrafts((prev) => ({
      ...prev,
      [assignment.test_assignment_id]: toLocalInputSafe(params.schedule?.end_at),
    }));
    setMaxAttemptsDrafts((prev) => ({
      ...prev,
      [assignment.test_assignment_id]: params.attempts?.default_max_attempts
        ? String(params.attempts.default_max_attempts)
        : '',
    }));
    setTimerSecondsDrafts((prev) => ({
      ...prev,
      [assignment.test_assignment_id]: String(params.timer?.seconds ?? 10),
    }));
    const totalSeconds = (test?.question_count || 0) * (params.timer?.seconds ?? 10);
    setTotalTimeDrafts((prev) => ({
      ...prev,
      [assignment.test_assignment_id]: totalSeconds ? String(totalSeconds) : '',
    }));
    setPassingPercentageDrafts((prev) => ({
      ...prev,
      [assignment.test_assignment_id]: Number.isFinite(params.passing?.percentage as number)
        ? String(params.passing?.percentage)
        : '',
    }));
    setAnnouncementDrafts((prev) => ({
      ...prev,
      [assignment.test_assignment_id]: params.announcement?.message || '',
    }));
  };

  const buildUpdatedRunParams = (
    assignment: TestAssignment,
    patch: AssignmentRunParamsLike
  ) => {
    const current = getRunParamsObject(assignment) as AssignmentRunParamsLike;
    return {
      ...current,
      ...patch,
      schedule: { ...(current.schedule || {}), ...(patch.schedule || {}) },
      attempts: { ...(current.attempts || {}), ...(patch.attempts || {}) },
      timer: { ...(current.timer || {}), ...(patch.timer || {}) },
      passing: { ...(current.passing || {}), ...(patch.passing || {}) },
      control: { ...(current.control || {}), ...(patch.control || {}) },
      announcement: { ...(current.announcement || {}), ...(patch.announcement || {}) },
      ui: { ...(current.ui || {}), ...(patch.ui || {}) },
    };
  };

  const updateAssignmentRunParams = async (
    assignment: TestAssignment,
    patch: AssignmentRunParamsLike
  ) => {
    const updatedRunParams = buildUpdatedRunParams(assignment, patch);
    const updated = await updateTestAssignment(assignment.test_assignment_id, {
      run_params: updatedRunParams,
    });
    setAssignments((prev) =>
      prev.map((item) =>
        item.test_assignment_id === assignment.test_assignment_id ? updated : item
      )
    );
    syncDraftsFromAssignment(updated);
    return updated;
  };

  const handleNoteBlur = async (assignment: TestAssignment) => {
    const nextNote = (noteDrafts[assignment.test_assignment_id] || '').trim();
    if ((assignment.note || '') === nextNote) return;
    try {
      const updated = await updateTestAssignment(assignment.test_assignment_id, { note: nextNote });
      setAssignments((prev) =>
        prev.map((item) => (item.test_assignment_id === assignment.test_assignment_id ? updated : item))
      );
      syncDraftsFromAssignment(updated);
    } catch (e) {
      console.error(e);
      setError('メモの更新に失敗しました');
      setNoteDrafts((prev) => ({ ...prev, [assignment.test_assignment_id]: assignment.note || '' }));
    }
  };

  const handleScheduleBlur = async (
    assignment: TestAssignment,
    field: 'start_at' | 'end_at'
  ) => {
    const draftValue =
      field === 'start_at'
        ? startAtDrafts[assignment.test_assignment_id]
        : endAtDrafts[assignment.test_assignment_id];
    if (!draftValue) {
      syncDraftsFromAssignment(assignment);
      return;
    }
    const parsed = new Date(draftValue);
    if (Number.isNaN(parsed.getTime())) {
      syncDraftsFromAssignment(assignment);
      return;
    }
    try {
      await updateAssignmentRunParams(assignment, {
        schedule: {
          [field]: parsed.toISOString(),
        },
      });
    } catch (e) {
      console.error(e);
      setError('配信期間の更新に失敗しました');
      syncDraftsFromAssignment(assignment);
    }
  };

  const handleMaxAttemptsBlur = async (assignment: TestAssignment) => {
    const raw = maxAttemptsDrafts[assignment.test_assignment_id];
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 99) {
      setError('最大受験回数は1〜99の整数で入力してください。');
      syncDraftsFromAssignment(assignment);
      return;
    }
    try {
      await updateAssignmentRunParams(assignment, {
        attempts: { default_max_attempts: parsed },
      });
    } catch (e) {
      console.error(e);
      setError('受験回数の更新に失敗しました');
      syncDraftsFromAssignment(assignment);
    }
  };

  const handleTimerSecondsBlur = async (assignment: TestAssignment) => {
    const raw = timerSecondsDrafts[assignment.test_assignment_id];
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 120) {
      setError('解答時間は1〜120の整数（秒/問）で入力してください。');
      syncDraftsFromAssignment(assignment);
      return;
    }
    updateTimerDraftsFromPerQuestion(assignment.test_assignment_id, parsed);
    try {
      await updateAssignmentRunParams(assignment, {
        timer: { mode: 'uniform', seconds: parsed },
      });
    } catch (e) {
      console.error(e);
      setError('解答時間の更新に失敗しました');
      syncDraftsFromAssignment(assignment);
    }
  };

  const handleTotalTimeBlur = async (assignment: TestAssignment) => {
    const raw = totalTimeDrafts[assignment.test_assignment_id];
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 1) {
      setError('合計時間は1以上の整数（秒）で入力してください。');
      syncDraftsFromAssignment(assignment);
      return;
    }
    const perQuestion = questionCount ? Math.ceil(parsed / questionCount) : parsed;
    const normalized = Math.min(Math.max(perQuestion, 1), 120);
    updateTimerDraftsFromPerQuestion(assignment.test_assignment_id, normalized);
    try {
      await updateAssignmentRunParams(assignment, {
        timer: { mode: 'uniform', seconds: normalized },
      });
    } catch (e) {
      console.error(e);
      setError('合計時間の更新に失敗しました');
      syncDraftsFromAssignment(assignment);
    }
  };

  const handlePassingPercentageBlur = async (assignment: TestAssignment) => {
    const raw = passingPercentageDrafts[assignment.test_assignment_id];
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
      setError('合格正答率は0〜100の整数で入力してください。');
      syncDraftsFromAssignment(assignment);
      return;
    }
    try {
      await updateAssignmentRunParams(assignment, {
        passing: { percentage: parsed },
      });
    } catch (e) {
      console.error(e);
      setError('合格正答率の更新に失敗しました');
      syncDraftsFromAssignment(assignment);
    }
  };

  const handleAnnouncementBlur = async (assignment: TestAssignment) => {
    const message = (announcementDrafts[assignment.test_assignment_id] || '').trim();
    const nextAnnouncement = message
      ? { message, updated_at: new Date().toISOString() }
      : { message: null, updated_at: null };
    try {
      await updateAssignmentRunParams(assignment, {
        announcement: nextAnnouncement,
      });
    } catch (e) {
      console.error(e);
      setError('メッセージの更新に失敗しました');
      syncDraftsFromAssignment(assignment);
    }
  };

  const handleTogglePaused = async (assignment: TestAssignment) => {
    const params = extractRunParams(assignment);
    const isPaused = Boolean(params.control?.paused);
    const confirmMessage = isPaused
      ? 'この配信を再開しますか？'
      : 'この配信を一時停止しますか？';
    if (!window.confirm(confirmMessage)) return;
    try {
      await updateAssignmentRunParams(assignment, {
        control: { paused: !isPaused },
      });
    } catch (e) {
      console.error(e);
      setError('配信の停止切り替えに失敗しました');
    }
  };

  const handleStopNow = async (assignment: TestAssignment) => {
    if (!window.confirm('この配信を完全停止しますか？')) return;
    try {
      await updateAssignmentRunParams(assignment, {
        schedule: { end_at: new Date().toISOString() },
        control: { paused: false },
      });
    } catch (e) {
      console.error(e);
      setError('配信終了の更新に失敗しました');
    }
  };

  const handleToggleContentVisibility = async (assignment: TestAssignment) => {
    const params = extractRunParams(assignment);
    const isPublic = params.ui?.show_test_content !== false;
    try {
      await updateAssignmentRunParams(assignment, {
        ui: { show_test_content: !isPublic },
      });
    } catch (e) {
      console.error(e);
      setError('テスト内容公開の更新に失敗しました');
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
      .sort((a, b) => {
        const assignedA = assignedStudentIds.has(a.student_id);
        const assignedB = assignedStudentIds.has(b.student_id);
        if (assignedA !== assignedB) return assignedA ? -1 : 1;
        return a.display_name.localeCompare(b.display_name);
      });
  }, [students, studentQuery, assignedStudentIds]);

  const studentMap = useMemo(() => {
    return new Map(students.map((student) => [student.student_id, student]));
  }, [students]);

  const activeStudentIds = useMemo(() => {
    return new Set(students.filter((student) => student.status === 'active').map((student) => student.student_id));
  }, [students]);

  const sortedAssignedRows = useMemo(() => {
    const statusRank: Record<TeacherAssignmentResult['status'], number> = {
      unattempted: 0,
      attempted: 1,
      expired_unattempted: 2,
    };
    return [...assignedRows].sort((a, b) => {
      const rank = statusRank[a.status] - statusRank[b.status];
      if (rank !== 0) return rank;
      return a.student_name.localeCompare(b.student_name);
    });
  }, [assignedRows]);

  const plannedAssignCount = useMemo(() => {
    let count = 0;
    selectedStudentIds.forEach((studentId) => {
      if (!assignedStudentIds.has(studentId) && activeStudentIds.has(studentId)) count += 1;
    });
    return count;
  }, [activeStudentIds, assignedStudentIds, selectedStudentIds]);

  const plannedUnassignCount = useMemo(() => {
    let count = 0;
    assignedStudentIds.forEach((studentId) => {
      if (!selectedStudentIds.has(studentId)) count += 1;
    });
    return count;
  }, [assignedStudentIds, selectedStudentIds]);

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
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">テスト詳細</h1>
          {isEditingTitle ? (
            <input
              autoFocus
              className="w-full max-w-xl rounded border border-slate-200 px-3 py-2 text-sm"
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={() => {
                void handleTitleCommit();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.currentTarget.blur();
                }
                if (event.key === 'Escape') {
                  setTitleDraft(test?.title || '');
                  setIsEditingTitle(false);
                }
              }}
            />
          ) : (
            <button
              type="button"
              onDoubleClick={() => {
                if (test) setIsEditingTitle(true);
              }}
              className="w-full max-w-xl text-left text-sm text-slate-900 hover:text-slate-700"
              title="ダブルクリックで編集"
            >
              {test?.title || '-'}
            </button>
          )}
          <div className="text-sm text-slate-600">
            問題数: {test?.question_count ?? '-'}
          </div>
          {test?.archived_at && <p className="text-xs text-amber-600">アーカイブ済み</p>}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleDuplicateTest}
            className="px-4 py-2 rounded-md border border-slate-300 text-sm text-slate-700 hover:bg-slate-50"
          >
            複製
          </button>
          <button
            type="button"
            onClick={handleArchiveTest}
            disabled={Boolean(test?.archived_at)}
            className="px-4 py-2 rounded-md bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-50"
          >
            アーカイブ
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {actionMessage && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {actionMessage}
        </div>
      )}

      <div className="rounded-lg bg-white shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">配信作成</h2>
        <form onSubmit={handleCreateAssignment} className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <label className="flex flex-col text-sm text-slate-700 md:col-span-2">
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
            合計時間（秒）
            <input
              type="number"
              min={1}
              className="mt-1 rounded border border-slate-300 px-3 py-2"
              value={totalTimeSeconds}
              onChange={(e) => handleTotalTimeSecondsChange(Number(e.target.value))}
            />
            <span className="mt-1 text-xs text-slate-500">
              出題数: {questionCount}問
            </span>
          </label>

          <label className="flex flex-col text-sm text-slate-700">
            1問あたり秒数
            <input
              type="number"
              min={1}
              max={120}
              className="mt-1 rounded border border-slate-300 px-3 py-2"
              value={timerSeconds}
              onChange={(e) => handleTimerSecondsChange(Number(e.target.value))}
            />
            <span className="mt-1 text-xs text-slate-500">
              合計: {totalTimeSeconds}秒
            </span>
          </label>

          <label className="flex flex-col text-sm text-slate-700">
            合格正答率（%）
            <input
              type="number"
              min={0}
              max={100}
              className="mt-1 rounded border border-slate-300 px-3 py-2"
              value={passingPercentage}
              onChange={(e) => setPassingPercentage(Number(e.target.value))}
            />
            <span className="mt-1 text-xs text-slate-500">
              0〜100の整数
            </span>
          </label>

          <label className="flex flex-col text-sm text-slate-700">
            テスト内容公開
            <select
              className="mt-1 rounded border border-slate-300 px-3 py-2"
              value={showTestContent ? 'public' : 'private'}
              onChange={(e) => setShowTestContent(e.target.value === 'public')}
            >
              <option value="public">公開</option>
              <option value="private">非公開</option>
            </select>
            <span className="mt-1 text-xs text-slate-500">
              非公開だと生徒は内容を閲覧できません。
            </span>
          </label>

          <label className="flex flex-col text-sm text-slate-700 md:col-span-3">
            開始日時
            <input
              type="datetime-local"
              className="mt-1 rounded border border-slate-300 px-3 py-2"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              required
            />
          </label>

          <label className="flex flex-col text-sm text-slate-700 md:col-span-3">
            終了日時
            <input
              type="datetime-local"
              className="mt-1 rounded border border-slate-300 px-3 py-2"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              required
            />
          </label>

          <label className="flex flex-col text-sm text-slate-700 md:col-span-6">
            配信メッセージ（生徒画面に表示）
            <textarea
              rows={2}
              className="mt-1 rounded border border-slate-300 px-3 py-2"
              value={announcementMessage}
              onChange={(e) => setAnnouncementMessage(e.target.value)}
              placeholder="例: 開始前に本文をよく読んでください"
            />
          </label>

          <div className="md:col-span-6">
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
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">配信一覧</h2>
            <p className="text-sm text-slate-500">開始前/公開中/終了の配信をすべて表示します。</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            状態
            <select
              value={assignmentStatusFilter}
              onChange={(event) =>
                setAssignmentStatusFilter(event.target.value as 'all' | AssignmentStatus)
              }
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="all">全て</option>
              <option value="upcoming">開始前</option>
              <option value="active">公開中</option>
              <option value="ended">終了</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-[1.2fr_1fr_1fr_0.6fr_1.1fr_0.6fr_1.2fr_0.6fr_0.6fr_0.7fr_1.8fr] gap-4 px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <span>メモ</span>
          <span>開始</span>
          <span>終了</span>
          <span>回数</span>
          <span>合計時間</span>
          <span>合格正答率(%)</span>
          <span>メッセージ</span>
          <span>内容</span>
          <span>状態</span>
          <span>対象学生数</span>
          <span className="text-right">操作</span>
        </div>
        {rows.map((assignment) => {
          const params = extractRunParams(assignment);
          const status = getAssignmentStatus(assignment, Date.now());
          const isPaused = Boolean(params.control?.paused);
          const statusLabel = isPaused ? '停止中' : statusLabels[status];
          const announcementText = params.announcement?.message || '';
          const isContentPublic = params.ui?.show_test_content !== false;
          return (
            <div
              key={assignment.test_assignment_id}
              className="grid grid-cols-[1.2fr_1fr_1fr_0.6fr_1.1fr_0.6fr_1.2fr_0.6fr_0.6fr_0.7fr_1.8fr] gap-4 px-6 py-3 text-sm text-slate-700 border-t border-slate-100"
            >
              <div className="flex flex-col gap-1">
                {isEditing(assignment.test_assignment_id, 'note') ? (
                  <input
                    autoFocus
                    className="rounded border border-slate-200 px-2 py-1 text-sm"
                    value={noteDrafts[assignment.test_assignment_id] ?? ''}
                    onChange={(event) =>
                      setNoteDrafts((prev) => ({
                        ...prev,
                        [assignment.test_assignment_id]: event.target.value,
                      }))
                    }
                    onBlur={() => {
                      void handleNoteBlur(assignment);
                      setEditingField(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.currentTarget.blur();
                      }
                      if (event.key === 'Escape') {
                        syncDraftsFromAssignment(assignment);
                        setEditingField(null);
                      }
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onDoubleClick={() =>
                      setEditingField({ assignmentId: assignment.test_assignment_id, field: 'note' })
                    }
                    className="text-left text-slate-900 hover:text-slate-700"
                    title="ダブルクリックで編集"
                  >
                    {noteDrafts[assignment.test_assignment_id] || '-'}
                  </button>
                )}
              </div>
              <div>
                {isEditing(assignment.test_assignment_id, 'start_at') ? (
                  <input
                    type="datetime-local"
                    autoFocus
                    className="rounded border border-slate-200 px-2 py-1 text-sm"
                    value={startAtDrafts[assignment.test_assignment_id] ?? ''}
                    onChange={(event) =>
                      setStartAtDrafts((prev) => ({
                        ...prev,
                        [assignment.test_assignment_id]: event.target.value,
                      }))
                    }
                    onBlur={() => {
                      void handleScheduleBlur(assignment, 'start_at');
                      setEditingField(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.currentTarget.blur();
                      }
                      if (event.key === 'Escape') {
                        syncDraftsFromAssignment(assignment);
                        setEditingField(null);
                      }
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onDoubleClick={() =>
                      setEditingField({ assignmentId: assignment.test_assignment_id, field: 'start_at' })
                    }
                    className="text-left text-slate-900 hover:text-slate-700"
                    title="ダブルクリックで編集"
                  >
                    {params.schedule?.start_at ? new Date(params.schedule.start_at).toLocaleString() : '-'}
                  </button>
                )}
              </div>
              <div>
                {isEditing(assignment.test_assignment_id, 'end_at') ? (
                  <input
                    type="datetime-local"
                    autoFocus
                    className="rounded border border-slate-200 px-2 py-1 text-sm"
                    value={endAtDrafts[assignment.test_assignment_id] ?? ''}
                    onChange={(event) =>
                      setEndAtDrafts((prev) => ({
                        ...prev,
                        [assignment.test_assignment_id]: event.target.value,
                      }))
                    }
                    onBlur={() => {
                      void handleScheduleBlur(assignment, 'end_at');
                      setEditingField(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.currentTarget.blur();
                      }
                      if (event.key === 'Escape') {
                        syncDraftsFromAssignment(assignment);
                        setEditingField(null);
                      }
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onDoubleClick={() =>
                      setEditingField({ assignmentId: assignment.test_assignment_id, field: 'end_at' })
                    }
                    className="text-left text-slate-900 hover:text-slate-700"
                    title="ダブルクリックで編集"
                  >
                    {params.schedule?.end_at ? new Date(params.schedule.end_at).toLocaleString() : '-'}
                  </button>
                )}
              </div>
              <div>
                {isEditing(assignment.test_assignment_id, 'max_attempts') ? (
                  <input
                    type="number"
                    min={1}
                    max={99}
                    autoFocus
                    className="w-20 rounded border border-slate-200 px-2 py-1 text-sm"
                    value={maxAttemptsDrafts[assignment.test_assignment_id] ?? ''}
                    onChange={(event) =>
                      setMaxAttemptsDrafts((prev) => ({
                        ...prev,
                        [assignment.test_assignment_id]: event.target.value,
                      }))
                    }
                    onBlur={() => {
                      void handleMaxAttemptsBlur(assignment);
                      setEditingField(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.currentTarget.blur();
                      }
                      if (event.key === 'Escape') {
                        syncDraftsFromAssignment(assignment);
                        setEditingField(null);
                      }
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onDoubleClick={() =>
                      setEditingField({ assignmentId: assignment.test_assignment_id, field: 'max_attempts' })
                    }
                    className="text-left text-slate-900 hover:text-slate-700"
                    title="ダブルクリックで編集"
                  >
                    {params.attempts?.default_max_attempts ?? '-'}
                  </button>
                )}
              </div>
              <div>
                {isEditing(assignment.test_assignment_id, 'total_time') ? (
                  <div
                    className="flex flex-col gap-2"
                    tabIndex={-1}
                    onBlur={(event) => {
                      if (event.currentTarget.contains(event.relatedTarget as Node)) return;
                      void handleTotalTimeBlur(assignment);
                      setEditingField(null);
                    }}
                  >
                    <input
                      type="number"
                      min={1}
                      autoFocus
                      className="w-24 rounded border border-slate-200 px-2 py-1 text-sm"
                      value={totalTimeDrafts[assignment.test_assignment_id] ?? ''}
                      onChange={(event) =>
                        updateTimerDraftsFromTotal(
                          assignment.test_assignment_id,
                          Number(event.target.value)
                        )
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          syncDraftsFromAssignment(assignment);
                          setEditingField(null);
                        }
                      }}
                      placeholder="合計(秒)"
                    />
                    <input
                      type="number"
                      min={1}
                      max={120}
                      className="w-24 rounded border border-slate-200 px-2 py-1 text-sm"
                      value={timerSecondsDrafts[assignment.test_assignment_id] ?? ''}
                      onChange={(event) =>
                        updateTimerDraftsFromPerQuestion(
                          assignment.test_assignment_id,
                          Number(event.target.value)
                        )
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.currentTarget.blur();
                        }
                        if (event.key === 'Escape') {
                          syncDraftsFromAssignment(assignment);
                          setEditingField(null);
                        }
                      }}
                      placeholder="1問(秒)"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onDoubleClick={() =>
                      setEditingField({ assignmentId: assignment.test_assignment_id, field: 'total_time' })
                    }
                    className="text-left text-slate-900 hover:text-slate-700"
                    title="ダブルクリックで編集"
                  >
                    {formatTotalSeconds((params.timer?.seconds ?? 10) * (test?.question_count ?? 0))}
                  </button>
                )}
              </div>
              <div>
                {isEditing(assignment.test_assignment_id, 'passing_percentage') ? (
                  <input
                    type="number"
                    min={0}
                    max={100}
                    autoFocus
                    className="w-20 rounded border border-slate-200 px-2 py-1 text-sm"
                    value={passingPercentageDrafts[assignment.test_assignment_id] ?? ''}
                    onChange={(event) =>
                      setPassingPercentageDrafts((prev) => ({
                        ...prev,
                        [assignment.test_assignment_id]: event.target.value,
                      }))
                    }
                    onBlur={() => {
                      void handlePassingPercentageBlur(assignment);
                      setEditingField(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.currentTarget.blur();
                      }
                      if (event.key === 'Escape') {
                        syncDraftsFromAssignment(assignment);
                        setEditingField(null);
                      }
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onDoubleClick={() =>
                      setEditingField({ assignmentId: assignment.test_assignment_id, field: 'passing_percentage' })
                    }
                    className="text-left text-slate-900 hover:text-slate-700"
                    title="ダブルクリックで編集"
                  >
                    {params.passing?.percentage ?? '-'}
                  </button>
                )}
              </div>
              <div>
                {isEditing(assignment.test_assignment_id, 'announcement') ? (
                  <textarea
                    autoFocus
                    rows={2}
                    className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                    value={announcementDrafts[assignment.test_assignment_id] ?? ''}
                    onChange={(event) =>
                      setAnnouncementDrafts((prev) => ({
                        ...prev,
                        [assignment.test_assignment_id]: event.target.value,
                      }))
                    }
                    onBlur={() => {
                      void handleAnnouncementBlur(assignment);
                      setEditingField(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        syncDraftsFromAssignment(assignment);
                        setEditingField(null);
                      }
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onDoubleClick={() =>
                      setEditingField({ assignmentId: assignment.test_assignment_id, field: 'announcement' })
                    }
                    className="text-left text-slate-900 hover:text-slate-700"
                    title="ダブルクリックで編集"
                  >
                    {announcementText ? announcementText : '-'}
                  </button>
                )}
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => handleToggleContentVisibility(assignment)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    isContentPublic
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300'
                      : 'border-slate-200 bg-slate-100 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {isContentPublic ? '公開' : '非公開'}
                </button>
              </div>
              <span className={isPaused ? 'text-amber-600 font-semibold' : ''}>{statusLabel}</span>
              <span>{assignedCounts[assignment.test_assignment_id] ?? '-'}</span>
              <span className="text-right flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => openAssignModal(assignment)}
                  className={`${actionButtonBase} border-slate-300 text-slate-700 hover:border-slate-400 hover:text-slate-900 bg-white`}
                >
                  生徒割当
                </button>
                <Link
                  href={`/teacher/test-assignments/${assignment.test_assignment_id}/results`}
                  className={`${actionButtonBase} border-indigo-300 text-indigo-700 hover:border-indigo-400 hover:text-indigo-900 bg-indigo-50`}
                >
                  結果
                </Link>
                <button
                  type="button"
                  onClick={() => downloadTeacherAssignmentResultsCSV(assignment.test_assignment_id)}
                  className={`${actionButtonBase} border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800 bg-slate-50`}
                >
                  CSV
                </button>
                {isPaused ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleStopNow(assignment)}
                      className={`${actionButtonBase} border-rose-300 text-rose-700 hover:border-rose-400 hover:text-rose-800 bg-rose-50`}
                    >
                      完全停止
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTogglePaused(assignment)}
                      className={`${actionButtonBase} border-emerald-300 text-emerald-700 hover:border-emerald-400 hover:text-emerald-800 bg-emerald-50`}
                    >
                      再開
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleTogglePaused(assignment)}
                    className={`${actionButtonBase} border-amber-300 text-amber-700 hover:border-amber-400 hover:text-amber-800 bg-amber-50`}
                  >
                    一時停止
                  </button>
                )}
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
          <div className="w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-lg bg-white shadow-lg">
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

            <div className="max-h-[70vh] overflow-y-auto px-6 py-4 space-y-4">
              {assignError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                  {assignError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr]">
                <section className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">割当済み</h4>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>合計 {assignedSummary?.assignee_count ?? assignedRows.length}人</span>
                      <span>受験済 {assignedSummary?.attempted_count ?? 0}</span>
                      <span>未受験 {assignedSummary?.unattempted_count ?? 0}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">右の一覧でチェックを外すと解除予定になります。</p>

                  <div className="max-h-[45vh] overflow-y-auto rounded border border-slate-200 bg-slate-50/40">
                    {assignLoading ? (
                      <div className="p-4 text-sm text-slate-500">読み込み中...</div>
                    ) : sortedAssignedRows.length === 0 ? (
                      <div className="p-4 text-sm text-slate-500">割当済みの生徒はまだいません。</div>
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {sortedAssignedRows.map((row) => {
                          const studentInfo = studentMap.get(row.student_id);
                          const willUnassign = !selectedStudentIds.has(row.student_id);
                          return (
                            <li key={row.assignee_id} className="px-4 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="text-sm font-semibold text-slate-900">{row.student_name}</div>
                                  {studentInfo?.local_student_code && (
                                    <div className="text-xs text-slate-500">
                                      コード: {studentInfo.local_student_code}
                                    </div>
                                  )}
                                  <div className="flex flex-wrap gap-2 text-xs">
                                    <span
                                      className={`rounded-full border px-2 py-0.5 ${assigneeStatusStyles[row.status]}`}
                                    >
                                      {assigneeStatusLabels[row.status]}
                                    </span>
                                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-600">
                                      受験 {row.attempt_count}回
                                    </span>
                                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-600">
                                      残り {row.remaining_attempts}回
                                    </span>
                                    {willUnassign && (
                                      <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-700">
                                        解除予定
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-slate-900">グループで選択</h4>
                      <span className="text-xs text-slate-500">選択: {selectedGroupIds.size}件</span>
                    </div>
                    <div className="max-h-48 overflow-y-auto rounded border border-slate-200">
                      {assignLoading ? (
                        <div className="p-4 text-sm text-slate-500">読み込み中...</div>
                      ) : groups.length === 0 ? (
                        <div className="p-4 text-sm text-slate-500">グループがありません。</div>
                      ) : (
                        <ul className="divide-y divide-slate-100">
                          {groups.map((group) => {
                            const checked = selectedGroupIds.has(group.roster_folder_id);
                            const isLoading = groupLoadingIds.has(group.roster_folder_id);
                            return (
                              <li key={group.roster_folder_id} className="flex items-center gap-3 px-4 py-2">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => void toggleGroupSelection(group.roster_folder_id)}
                                  disabled={isLoading}
                                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 disabled:opacity-50"
                                />
                                <div className="text-sm text-slate-900">{group.name}</div>
                                {isLoading && (
                                  <span className="text-xs text-slate-400">読込中...</span>
                                )}
                                {typeof group.member_count === 'number' && (
                                  <span className="ml-auto text-xs text-slate-500">{group.member_count}人</span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      グループを選ぶと該当の生徒に自動でチェックが入ります。
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">生徒を選択</label>
                    <input
                      type="text"
                      className="rounded border border-slate-300 px-3 py-2 text-sm"
                      placeholder="表示名 / 生徒コードで検索"
                      value={studentQuery}
                      onChange={(e) => setStudentQuery(e.target.value)}
                    />

                    <div className="max-h-[45vh] overflow-y-auto rounded border border-slate-200">
                      {assignLoading ? (
                        <div className="p-4 text-sm text-slate-500">読み込み中...</div>
                      ) : filteredStudents.length === 0 ? (
                        <div className="p-4 text-sm text-slate-500">対象の生徒が見つかりません。</div>
                      ) : (
                        <ul className="divide-y divide-slate-100">
                          {filteredStudents.map((student) => {
                            const isAssigned = assignedStudentIds.has(student.student_id);
                            const checked = selectedStudentIds.has(student.student_id);
                            const willUnassign = isAssigned && !checked;
                            const willAssign = !isAssigned && checked;
                            return (
                              <li
                                key={student.student_id}
                                className={`flex items-center gap-3 px-4 py-3 ${
                                  willUnassign
                                    ? 'bg-rose-50'
                                    : willAssign
                                      ? 'bg-emerald-50/50'
                                      : isAssigned
                                        ? 'bg-slate-50'
                                        : ''
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleStudentSelection(student.student_id)}
                                  className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                                />
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-slate-900">{student.display_name}</div>
                                  {student.local_student_code && (
                                    <div className="text-xs text-slate-500">
                                      コード: {student.local_student_code}
                                    </div>
                                  )}
                                </div>
                                {isAssigned && checked && (
                                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-500">
                                    割当済み
                                  </span>
                                )}
                                {willAssign && (
                                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                                    追加予定
                                  </span>
                                )}
                                {willUnassign && (
                                  <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs text-rose-700">
                                    解除予定
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      チェックを外すと割当解除、チェックを入れると追加になります。
                    </p>
                  </div>
                </section>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
              <span className="text-sm text-slate-600">
                選択中: 生徒 {selectedStudentIds.size} / グループ {selectedGroupIds.size} ・ 追加予定{' '}
                {plannedAssignCount} / 解除予定 {plannedUnassignCount}
              </span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeAssignModal}
                  className="px-4 py-2 rounded-md border border-slate-300 text-sm text-slate-700 hover:bg-slate-50"
                >
                  閉じる
                </button>
                <button
                  type="button"
                  onClick={handleAssignStudents}
                  disabled={assignSaving || assignLoading}
                  className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {assignSaving ? '反映中...' : '変更を反映'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
