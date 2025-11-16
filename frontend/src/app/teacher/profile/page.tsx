'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { apiGet, apiPost, apiPatch } from '@/lib/api-utils';
import type { TeacherProfile, ApiUser, Teacher } from '@/types/quiz';
import { UserCircleIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-10 w-10 border-4 border-indigo-500 rounded-full border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">講師プロフィール</h1>
          <p className="text-slate-600 mt-2">あなたの情報を管理します</p>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-lg"
          >
            編集
          </button>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <XCircleIcon className="h-5 w-5" />
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircleIcon className="h-5 w-5" />
          {success}
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-500 to-blue-500 h-32"></div>
        <div className="px-8 pb-8">
          {/* Avatar */}
          <div className="flex items-end -mt-16 mb-6">
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="Avatar"
                className="w-32 h-32 rounded-full border-4 border-white shadow-lg object-cover bg-white"
              />
            ) : (
              <div className="w-32 h-32 rounded-full border-4 border-white shadow-lg bg-slate-200 flex items-center justify-center">
                <UserCircleIcon className="w-20 h-20 text-slate-400" />
              </div>
            )}
            <div className="ml-6 pb-2">
              <h2 className="text-2xl font-bold text-slate-900">
                {formData.display_name || user?.email || '未設定'}
              </h2>
              {formData.affiliation && (
                <p className="text-slate-600 mt-1">{formData.affiliation}</p>
              )}
            </div>
          </div>

          {editing ? (
            /* Edit Form */
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    表示名
                  </label>
                  <input
                    type="text"
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="山田 太郎"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    所属（団体名）
                  </label>
                  <input
                    type="text"
                    value={formData.affiliation}
                    onChange={(e) => setFormData({ ...formData, affiliation: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="○○大学 / ○○高校"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">プロフィール画像</label>
                <div className="flex items-center gap-3">
                  <label className="px-4 py-2 border border-slate-300 rounded-md bg-slate-50 text-sm font-semibold text-slate-800 cursor-pointer hover:bg-slate-100">
                    画像を選択 (png/jpeg)
                    <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleAvatarUpload} />
                  </label>
                  {avatarPreview && <span className="text-xs text-slate-500">更新予定</span>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  自己紹介
                </label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  rows={5}
                  placeholder="あなたの自己紹介を入力してください"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={saving}
                  className="flex-1 bg-slate-200 text-slate-700 px-4 py-2.5 rounded-lg hover:bg-slate-300 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  キャンセル
                </button>
              </div>
            </form>
          ) : (
            /* View Mode */
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-slate-500 mb-1">メールアドレス</h3>
                  <p className="text-slate-900">{user?.email || '-'}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-slate-500 mb-1">表示名</h3>
                  <p className="text-slate-900">{formData.display_name || '未設定'}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-slate-500 mb-1">所属</h3>
                  <p className="text-slate-900">{formData.affiliation || '未設定'}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-slate-500 mb-1">更新日</h3>
                  <p className="text-slate-900">
                    {profile?.updated_at 
                      ? new Date(profile.updated_at).toLocaleString('ja-JP')
                      : '-'
                    }
                  </p>
                </div>
              </div>

              {formData.bio && (
                <div>
                  <h3 className="text-sm font-medium text-slate-500 mb-1">自己紹介</h3>
                  <p className="text-slate-900 whitespace-pre-wrap">{formData.bio}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Account Info */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">アカウント情報</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">ユーザーID</span>
            <span className="text-slate-900 font-mono">{user?.user_id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">認証プロバイダー</span>
            <span className="text-slate-900">{user?.oauth_provider || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">権限</span>
            <span className="px-2 py-1 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
              講師（ホワイトリスト登録済み）
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">登録日</span>
            <span className="text-slate-900">
              {user?.created_at 
                ? new Date(user.created_at).toLocaleDateString('ja-JP')
                : '-'
              }
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
