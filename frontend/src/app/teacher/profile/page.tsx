'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api-utils';
import type { TeacherProfile, ApiUser } from '@/types/quiz';

export default function TeacherProfilePage() {
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [user, setUser] = useState<ApiUser | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const currentUser = (await apiGet('/api/users/me/')) as ApiUser;
        setUser(currentUser);
        const teacherProfile = (await apiGet(`/api/teacher-profiles/${currentUser.user_id}/`).catch(() => null)) as TeacherProfile | null;
        setProfile(teacherProfile);
      } catch (err) {
        console.error('failed to load teacher profile', err);
      }
    };

    loadProfile();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">講師プロフィール</h1>
      <p className="text-slate-600">メール: {user?.email ?? '---'}</p>
      <p className="text-slate-600">表示名: {profile?.display_name ?? '未設定'}</p>
      <p className="text-slate-600">所属: {profile?.affiliation ?? '未設定'}</p>
      <p className="text-slate-500 text-sm">プロフィール編集機能は今後追加予定です。</p>
    </div>
  );
}
