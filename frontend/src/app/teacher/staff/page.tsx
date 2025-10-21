'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiGet, ApiError } from '@/lib/api-utils';
import type { ApiUser, Teacher, TeacherProfile, TeacherWhitelistEntry } from '@/types/quiz';

interface TeacherRow {
  teacher: Teacher;
  profile?: TeacherProfile | null;
}

export default function TeacherStaffPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [whitelist, setWhitelist] = useState<TeacherWhitelistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 講師ポータルにアクセスできている時点でホワイトリスト登録済み
  const isStaff = true;

  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        setLoading(true);
        setError(null);

        const user = (await apiGet('/api/users/me/')) as ApiUser;
        setCurrentUser(user);

        const teacherResponse = await apiGet('/api/teachers/?page_size=100');
        const teacherList: Teacher[] = Array.isArray(teacherResponse)
          ? teacherResponse
          : teacherResponse?.results || [];

        let profiles: TeacherProfile[] = [];
        if (teacherList.length > 0) {
          const profileResponse = await apiGet('/api/teacher-profiles/?page_size=100').catch(() => ({ results: [] }));
          profiles = Array.isArray(profileResponse) ? profileResponse : profileResponse?.results || [];
        }
        const profileMap = new Map(profiles.map((profile) => [profile.teacher, profile]));

        // ホワイトリスト情報を取得
        const whitelistResponse = await apiGet('/api/teacher-whitelists/?page_size=100').catch(() => ({ results: [] }));
        const whitelistList: TeacherWhitelistEntry[] = Array.isArray(whitelistResponse)
          ? whitelistResponse
          : whitelistResponse?.results || [];
        setWhitelist(whitelistList);

        setTeachers(
          teacherList.map((teacher) => ({
            teacher,
            profile: profileMap.get(teacher.teacher_id) || null,
          })),
        );
      } catch (err) {
        console.error('Staff page fetch error:', err);
        
        // ApiErrorの場合、403エラーはホワイトリスト未登録
        if (err instanceof ApiError && err.status === 403) {
          console.warn('Access denied (403) - redirecting to access-denied page');
          router.replace('/teacher/access-denied');
          return;
        }
        
        setError('講師情報の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchTeachers();
  }, [router]);

  const activeWhitelist = useMemo(
    () => whitelist.filter((entry) => !entry.revoked_at),
    [whitelist],
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-10 px-4">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-10 space-y-8 px-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">講師一覧 / ホワイトリスト</h1>
          <p className="text-slate-600">
            登録済みの講師アカウントとホワイトリストを確認できます。
          </p>
        </div>
        <Link href="/teacher/dashboard" className="text-indigo-600 font-semibold">← ダッシュボードへ戻る</Link>
      </div>

      <section className="bg-white shadow rounded-lg overflow-hidden">
        <header className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-slate-900">講師アカウント一覧</h2>
          <p className="text-sm text-slate-500">合計 {teachers.length} 名</p>
        </header>
        <div className="divide-y">
          <div className="grid grid-cols-4 gap-4 px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <span>ID</span>
            <span>メール</span>
            <span>表示名 / 所属</span>
            <span>最終ログイン</span>
          </div>
          {teachers.map(({ teacher, profile }) => (
            <div key={teacher.teacher_id} className="grid grid-cols-4 gap-4 px-6 py-3 text-sm text-slate-700">
              <span className="truncate">{teacher.teacher_id}</span>
              <span>{teacher.email}</span>
              <span>
                <span className="font-semibold">{profile?.display_name || '---'}</span>
                <span className="block text-xs text-slate-500">{profile?.affiliation || '所属未登録'}</span>
              </span>
              <span>{teacher.last_login ? new Date(teacher.last_login).toLocaleString() : '---'}</span>
            </div>
          ))}
          {teachers.length === 0 && (
            <div className="px-6 py-6 text-sm text-slate-500">講師アカウントが登録されていません。</div>
          )}
        </div>
      </section>

      <section className="bg-white shadow rounded-lg overflow-hidden">
          <header className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-slate-900">講師ホワイトリスト</h2>
            <p className="text-sm text-slate-500">アクティブ {activeWhitelist.length} / 総数 {whitelist.length}</p>
          </header>
          <div className="divide-y">
            <div className="grid grid-cols-5 gap-4 px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <span>ID</span>
              <span>メール</span>
              <span>公開権限</span>
              <span>登録者</span>
              <span>状態</span>
            </div>
            {whitelist.map((entry) => (
              <div key={entry.teachers_whitelist_id} className="grid grid-cols-5 gap-4 px-6 py-3 text-sm text-slate-700">
                <span className="truncate">{entry.teachers_whitelist_id}</span>
                <span>{entry.email}</span>
                <span>{entry.can_publish_vocab ? '可' : '不可'}</span>
                <span>{entry.created_by || '---'}</span>
                <span>{entry.revoked_at ? `取り消し: ${new Date(entry.revoked_at).toLocaleDateString()}` : '有効'}</span>
              </div>
            ))}
            {whitelist.length === 0 && (
              <div className="px-6 py-6 text-sm text-slate-500">ホワイトリストが登録されていません。</div>
            )}
          </div>
        </section>
    </div>
  );
}
