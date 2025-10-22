'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api-utils';
import type { StudentTeacherLink } from '@/types/quiz';

export default function TeacherStudentsPage() {
  const [rows, setRows] = useState<StudentTeacherLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setLoading(true);
        const response = await apiGet('/api/student-teacher-links/?status=active').catch(() => ({ results: [] }));
        const links: StudentTeacherLink[] = Array.isArray(response) ? response : response?.results || [];
        setRows(links);
      } catch (err) {
        console.error(err);
        setError('生徒一覧の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

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

      <div className="bg-white shadow rounded-lg divide-y">
        <div className="grid grid-cols-4 gap-4 px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <span>リンクID</span>
          <span>生徒ID</span>
          <span>ステータス</span>
          <span>連携日時</span>
        </div>
        {rows.map((row) => (
          <div key={row.student_teacher_link_id} className="grid grid-cols-4 gap-4 px-6 py-3 text-sm text-slate-700">
            <span>{row.student_teacher_link_id}</span>
            <span>{row.student}</span>
            <span>{row.status}</span>
            <span>{new Date(row.linked_at).toLocaleString()}</span>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="px-6 py-6 text-sm text-slate-500">リンク済みの生徒はいません。</div>
        )}
      </div>
    </div>
  );
}
