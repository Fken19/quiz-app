'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api-utils';
import type { ApiUser, StudentTeacherLink, UserProfile } from '@/types/quiz';

interface StudentRow {
  link: StudentTeacherLink;
  user?: ApiUser | null;
  profile?: UserProfile | null;
}

export default function TeacherStudentsPage() {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchStudents = async () => {
      try {
        setLoading(true);
        const response = await apiGet('/api/student-teacher-links/').catch(() => ({ results: [] }));
        const links: StudentTeacherLink[] = Array.isArray(response) ? response : response?.results || [];

        const studentIds = Array.from(new Set(links.map((l) => l.student))).filter(Boolean) as string[];
        const users = await Promise.all(studentIds.map((id) => apiGet(`/api/users/${id}/`).catch(() => null)));
        const profiles = await Promise.all(
          studentIds.map((id) => apiGet(`/api/user-profiles/${id}/`).catch(() => null)),
        );
        const userMap = new Map<string, ApiUser>();
        users.forEach((u: any) => {
          if (u && 'user_id' in u) userMap.set(u.user_id, u as ApiUser);
        });
        const profileMap = new Map<string, UserProfile>();
        profiles.forEach((p: any) => {
          if (p && 'user' in p) profileMap.set(p.user, p as UserProfile);
        });

        const rowsData: StudentRow[] = links.map((link) => ({
          link,
          user: userMap.get(link.student),
          profile: profileMap.get(link.student),
        }));
        setRows(rowsData);
      } catch (err) {
        console.error(err);
        setError('生徒一覧の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      setActionMessage(null);
      await apiPost(`/api/student-teacher-links/${id}/approve/`, {});
      setActionMessage('承認しました');
      await fetchStudents();
    } catch (err) {
      console.error(err);
      setActionMessage('承認に失敗しました');
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      setActionMessage(null);
      await apiPost(`/api/student-teacher-links/${id}/revoke/`, {});
      setActionMessage('解除しました');
      await fetchStudents();
    } catch (err) {
      console.error(err);
      setActionMessage('解除に失敗しました');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-10">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">生徒一覧</h1>
        <p className="text-slate-600">講師にリンク済みの生徒アカウントを表示します。</p>
      </header>

      {actionMessage && <p className="text-sm text-slate-700">{actionMessage}</p>}

      <div className="bg-white shadow rounded-lg divide-y">
        <div className="grid grid-cols-5 gap-4 px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <span>氏名/表示名</span>
          <span>メール</span>
          <span>ステータス</span>
          <span>連携/申請日時</span>
          <span>操作</span>
        </div>
        {rows.map(({ link, user, profile }) => {
          const display = profile?.display_name || user?.email || link.student;
          const statusBadge =
            link.status === 'active'
              ? 'bg-green-100 text-green-700'
              : link.status === 'pending'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-slate-200 text-slate-600';
          return (
            <div key={link.student_teacher_link_id} className="grid grid-cols-5 gap-4 px-6 py-3 text-sm text-slate-800">
              <span className="font-semibold">{display}</span>
              <span className="text-slate-700">{user?.email ?? link.student}</span>
              <span>
                <span className={`px-2 py-1 rounded text-xs inline-block ${statusBadge}`}>{link.status}</span>
              </span>
              <span className="text-slate-700">{new Date(link.linked_at).toLocaleString()}</span>
              <div className="flex items-center gap-2">
                {link.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => handleApprove(link.student_teacher_link_id)}
                    className="px-3 py-1 text-xs rounded bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    承認
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleRevoke(link.student_teacher_link_id)}
                  className="px-3 py-1 text-xs rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  解除
                </button>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="px-6 py-6 text-sm text-slate-500">リンク済みの生徒はいません。</div>
        )}
      </div>
    </div>
  );
}
