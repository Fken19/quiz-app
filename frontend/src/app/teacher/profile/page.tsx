'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPatch } from '@/lib/api-utils';
import type { TeacherProfile, ApiUser } from '@/types/quiz';
import { UserCircleIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

export default function TeacherProfilePage() {
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    display_name: '',
    affiliation: '',
    bio: '',
    avatar_url: '',
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const currentUser = (await apiGet('/api/users/me/')) as ApiUser;
      setUser(currentUser);
      
      try {
        const teacherProfile = (await apiGet(`/api/teacher-profiles/${currentUser.user_id}/`)) as TeacherProfile;
        setProfile(teacherProfile);
        setFormData({
          display_name: teacherProfile.display_name || '',
          affiliation: teacherProfile.affiliation || '',
          bio: teacherProfile.bio || '',
          avatar_url: teacherProfile.avatar_url || '',
        });
      } catch (err) {
        // Profile doesn't exist yet
        setProfile(null);
      }
    } catch (err) {
      console.error('Failed to load profile', err);
      setError('プロフィールの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      if (!user) {
        throw new Error('ユーザー情報が読み込まれていません');
      }

      const data = {
        teacher: user.user_id,
        display_name: formData.display_name.trim() || null,
        affiliation: formData.affiliation.trim() || null,
        bio: formData.bio.trim() || null,
        avatar_url: formData.avatar_url.trim() || null,
      };

      let updatedProfile: TeacherProfile;
      
      if (profile) {
        // Update existing profile
        updatedProfile = await apiPatch(`/api/teacher-profiles/${user.user_id}/`, data) as TeacherProfile;
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
        avatar_url: profile.avatar_url || '',
      });
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
            {formData.avatar_url && !editing ? (
              <img
                src={formData.avatar_url}
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
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  アバター画像URL
                </label>
                <input
                  type="url"
                  value={formData.avatar_url}
                  onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="https://example.com/avatar.jpg"
                />
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
