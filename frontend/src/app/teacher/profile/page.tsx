'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { apiGet, apiPost, apiPatch } from '@/lib/api-utils';
import type { TeacherProfile, ApiUser, Teacher } from '@/types/quiz';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import TeacherProfileHeader from '@/components/teacher/TeacherProfileHeader';
import TeacherAccountCard from '@/components/teacher/TeacherAccountCard';

export default function TeacherProfilePage() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [user, setUser] = useState<ApiUser | null>(null);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    display_name: '',
    affiliation: '',
    bio: '',
  });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const currentUser = (await apiGet('/api/users/me/')) as ApiUser;
      setUser(currentUser);
      
      const teacherRecord = (await apiGet('/api/teachers/me/')) as Teacher;
      setTeacher(teacherRecord);
      
      try {
        const teacherProfile = (await apiGet(`/api/teacher-profiles/${teacherRecord.teacher_id}/`)) as TeacherProfile;
        setProfile(teacherProfile);
        setFormData({
          display_name: teacherProfile.display_name || '',
          affiliation: teacherProfile.affiliation || '',
          bio: teacherProfile.bio || '',
        });
        setAvatarPreview(teacherProfile.avatar_url || null);
      } catch (err: any) {
        // Profile doesn't exist yet
        const defaults = {
          display_name: session?.user?.name || '',
          affiliation: '',
          bio: '',
          avatar_url: session?.user?.image || '',
        };
        try {
          const created = (await apiPost('/api/teacher-profiles/', defaults)) as TeacherProfile;
          setProfile(created);
          setFormData({
            display_name: created.display_name || '',
            affiliation: created.affiliation || '',
            bio: created.bio || '',
          });
          setAvatarPreview(created.avatar_url || null);
        } catch (e: any) {
          setProfile(null);
          setFormData({
            display_name: defaults.display_name,
            affiliation: '',
            bio: '',
          });
          if (err?.status && err.status !== 404) {
            throw err;
          }
        }
      }
    } catch (err) {
      console.error('Failed to load profile', err);
      setError('プロフィールの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    form.append('target', 'teacher');
    try {
      const resp = (await apiPost('/api/avatar-upload/', form)) as { avatar_url: string };
      setAvatarPreview(resp.avatar_url);
      setSuccess('アイコンを更新しました');
    } catch (err) {
      console.error(err);
      setError('アイコンの更新に失敗しました');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      if (!user || !teacher) {
        throw new Error('講師情報が読み込まれていません');
      }

      const data = {
        display_name: formData.display_name.trim() || null,
        affiliation: formData.affiliation.trim() || null,
        bio: formData.bio.trim() || null,
        avatar_url: avatarPreview || null,
      };

      let updatedProfile: TeacherProfile;
      
      if (profile) {
        // Update existing profile
        updatedProfile = await apiPatch(`/api/teacher-profiles/${teacher.teacher_id}/`, data) as TeacherProfile;
      } else {
        // Create new profile
        updatedProfile = await apiPost('/api/teacher-profiles/', data) as TeacherProfile;
      }

      setProfile(updatedProfile);
      setEditing(false);
      setSuccess('プロフィールを保存しました');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Failed to save profile', err);
      setError(err?.message || 'プロフィールの保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setError(null);
    if (profile) {
      setFormData({
        display_name: profile.display_name || '',
        affiliation: profile.affiliation || '',
        bio: profile.bio || '',
      });
      setAvatarPreview(profile.avatar_url || null);
    }
  };

  const displayNameValue = formData.display_name || user?.email || '未設定';
  const affiliationValue = formData.affiliation || '';
  const selfIntroValue = formData.bio || profile?.bio || '';
  const formattedUpdatedAt = profile?.updated_at
    ? new Date(profile.updated_at).toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' })
    : '-';
  const formattedCreatedAt = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })
    : '-';
  const roleLabel = '講師（ホワイトリスト登録済み）';

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10">
        <div className="space-y-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Teacher Profile</p>
              <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">講師プロフィール</h1>
              <p className="mt-2 text-sm text-slate-600">公開情報とアカウント情報をここで管理します。</p>
            </div>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700"
              >
                プロフィールを編集
              </button>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <XCircleIcon className="h-5 w-5" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              <CheckCircleIcon className="h-5 w-5" />
              {success}
            </div>
          )}

          <TeacherProfileHeader
            avatarUrl={avatarPreview}
            displayName={displayNameValue}
            affiliation={affiliationValue}
            email={user?.email || '-'}
            updatedAtLabel={formattedUpdatedAt}
            selfIntro={selfIntroValue}
          />

          {editing && (
            <section className="rounded-2xl bg-white px-6 py-6 shadow-md shadow-slate-200 md:px-8">
              <h2 className="text-base font-semibold text-slate-900">プロフィールを編集</h2>
              <form onSubmit={handleSave} className="mt-4 space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">表示名</label>
                    <input
                      type="text"
                      value={formData.display_name}
                      onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                      className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      placeholder="山田 太郎"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">所属（団体名）</label>
                    <input
                      type="text"
                      value={formData.affiliation}
                      onChange={(e) => setFormData({ ...formData, affiliation: e.target.value })}
                      className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      placeholder="○○大学 / ○○高校"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">プロフィール画像</label>
                  <div className="mt-2 flex items-center gap-3">
                    <label className="cursor-pointer rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100">
                      画像を選択 (png/jpeg)
                      <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleAvatarUpload} />
                    </label>
                    {avatarPreview && <span className="text-xs text-slate-500">更新予定</span>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">自己紹介</label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    rows={5}
                    placeholder="あなたの自己紹介を入力してください"
                  />
                </div>

                <div className="flex flex-col gap-3 pt-2 md:flex-row">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex flex-1 items-center justify-center rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? '保存中...' : '保存'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={saving}
                    className="inline-flex flex-1 items-center justify-center rounded-full bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    キャンセル
                  </button>
                </div>
              </form>
            </section>
          )}

          <TeacherAccountCard
            userId={user?.user_id}
            provider={user?.oauth_provider}
            roleLabel={roleLabel}
            createdAt={formattedCreatedAt}
          />
        </div>
      </main>
    </div>
  );
}
