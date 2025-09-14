"use client";

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import AdminLayout from '@/components/AdminLayout';
import { apiGet } from '@/lib/api-utils';

export default function AdminProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [organization, setOrganization] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    fetchProfile();
  }, [session, status, router]);

  const fetchProfile = async () => {
    try {
      const profileData = await apiGet('/user/profile/');
      const user = profileData.user || profileData;
      setDisplayName(user.display_name || '');
  setOrganization(user.organization || '');
  setBio(user.bio || user.about || '');
      const avatarUrl = user.avatar_url || (user.avatar && user.avatar.startsWith('http') ? user.avatar : null);
      setAvatarPreview(avatarUrl || null);
    } catch (err) {
      console.error('Failed to fetch admin profile:', err);
      setError('プロフィール情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const initialLetter = ((displayName || (session?.user?.name ?? '')) || '').charAt(0).toUpperCase();

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setAvatarFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const token = (session as any)?.backendAccessToken;
      if (!token) {
        setError('認証トークンが見つかりません');
        return;
      }

      const formData = new FormData();
  formData.append('display_name', displayName);
  formData.append('organization', organization);
  formData.append('bio', bio);
      if (avatarFile) formData.append('avatar', avatarFile);

      const res = await fetch('/api/user/profile/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `HTTP ${res.status}`);
      }

      const response = await res.json();
      setSuccess(response.message || 'プロフィールが更新されました');
      // refresh profile
      fetchProfile();

    } catch (err) {
      console.error('Failed to save admin profile:', err);
      setError(err instanceof Error ? err.message : 'プロフィールの保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-black">プロフィール（管理者）</h1>
          <p className="mt-2 text-black">講師の表示名・団体名・アバターを編集できます。</p>
        </div>

        {error && <div className="text-red-600">{error}</div>}
        {success && <div className="text-green-600">{success}</div>}

        <div className="bg-white rounded-lg shadow p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-black mb-1">表示名</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full p-3 border rounded text-black placeholder-black placeholder-opacity-60" />
            </div>

            <div>
              <label className="block text-sm font-medium text-black mb-1">団体名</label>
              <input value={organization} onChange={(e) => setOrganization(e.target.value)} className="w-full p-3 border rounded text-black placeholder-black placeholder-opacity-60" />
            </div>

            <div>
              <label className="block text-sm font-medium text-black mb-1">アバター</label>
              <div className="flex items-center space-x-4">
                <div className="w-20 h-20 bg-indigo-500 rounded-full overflow-hidden flex items-center justify-center text-white text-2xl">
          {avatarPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
            initialLetter
                  )}
                </div>
                <div>
                  <input id="admin-avatar" type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                  <label htmlFor="admin-avatar" className="cursor-pointer bg-white border px-3 py-2 rounded text-black">画像を選択</label>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-black mb-1">自己紹介</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full p-3 border rounded text-black placeholder-gray-500 placeholder-opacity-80 h-32"
                placeholder="例：○○大学英語科出身、指導歴10年。生徒の理解を重視する指導を行います。簡潔にご記入ください。"
              />
            </div>

            <div>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded">
                {saving ? '保存中...' : '保存する'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AdminLayout>
  );
}
