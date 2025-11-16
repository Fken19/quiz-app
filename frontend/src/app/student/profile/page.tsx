'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPatch, apiPost } from '@/lib/api-utils';
import { BrowserQRCodeReader } from '@zxing/browser';
import type { ApiUser, UserProfile, StudentTeacherLink } from '@/types/quiz';

interface ProfileSummary {
  user: ApiUser | null;
  profile: UserProfile | null;
  teacherLinks: StudentTeacherLink[];
}

const initialSummary: ProfileSummary = {
  user: null,
  profile: null,
  teacherLinks: [],
};

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [summary, setSummary] = useState<ProfileSummary>(initialSummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    displayName: '',
    grade: '',
    selfIntro: '',
  });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [linkMessage, setLinkMessage] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);

        const user = (await apiGet('/api/users/me/')) as ApiUser;
        let profile: UserProfile | null = null;
        try {
          profile = (await apiGet(`/api/user-profiles/${user.user_id}/`)) as UserProfile;
        } catch {
          profile = null;
        }

        const linksResponse = await apiGet('/api/student-teacher-links/');
        const links: StudentTeacherLink[] = Array.isArray(linksResponse)
          ? linksResponse
          : linksResponse?.results || [];

        // プロフィールが無い場合は Google 情報で自動作成
        if (!profile) {
          const defaultPayload = {
            display_name: session?.user?.name || user.email,
            avatar_url: session?.user?.image || '',
            grade: null,
            self_intro: null,
          };
          profile = (await apiPost('/api/user-profiles/', defaultPayload)) as UserProfile;
        }

        setSummary({ user, profile, teacherLinks: links });
        setFormState({
          displayName: profile?.display_name || session?.user?.name || user.email,
          grade: profile?.grade || '',
          selfIntro: profile?.self_intro || '',
        });
        setAvatarPreview(profile?.avatar_url || session?.user?.image || null);
      } catch (err) {
        console.error(err);
        setError('プロフィール情報の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [session, status, router]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  const handleChange = (field: keyof typeof formState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormState((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const refreshLinks = async () => {
    const linksResponse = await apiGet('/api/student-teacher-links/');
    const links: StudentTeacherLink[] = Array.isArray(linksResponse)
      ? linksResponse
      : linksResponse?.results || [];
    setSummary((prev) => ({ ...prev, teacherLinks: links }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!summary.user) return;
    try {
      setSaving(true);
      const payload = {
        display_name: formState.displayName.trim() || summary.user.email,
        grade: formState.grade.trim() || null,
        self_intro: formState.selfIntro.trim() || null,
      };

      let updated: UserProfile;
      if (summary.profile) {
        updated = (await apiPatch(`/api/user-profiles/${summary.user.user_id}/`, payload)) as UserProfile;
      } else {
        updated = (await apiPost('/api/user-profiles/', payload)) as UserProfile;
      }

      setSummary((prev) => ({ ...prev, profile: updated }));
      setFormState({
        displayName: updated.display_name,
        grade: updated.grade || '',
        selfIntro: updated.self_intro || '',
      });
      setAvatarPreview(updated.avatar_url || null);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('プロフィールの更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    form.append('target', 'student');
    try {
      const resp = (await apiPost('/api/avatar-upload/', form)) as { avatar_url: string };
      setAvatarPreview(resp.avatar_url);
      if (summary.profile) {
        setSummary((prev) =>
          prev.profile ? { ...prev, profile: { ...prev.profile, avatar_url: resp.avatar_url } } : prev,
        );
      }
      setLinkMessage('アイコンを更新しました。');
    } catch (err) {
      console.error(err);
      setLinkMessage('アイコンの更新に失敗しました。');
    }
  };

  const handleRedeem = async () => {
    if (!inviteCode.trim()) {
      setLinkMessage('招待コードを入力してください。');
      return;
    }
    try {
      setLinkMessage(null);
      await apiPost('/api/invitation-codes/redeem/', { invitation_code: inviteCode.trim() });
      setInviteCode('');
      await refreshLinks();
      setLinkMessage('承認待ちとして送信しました。');
    } catch (err) {
      console.error(err);
      setLinkMessage('招待コードの登録に失敗しました。');
    }
  };

  const handleScanFile = async (file: File) => {
    setScanMessage(null);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const dataUrl = ev.target?.result as string;
          const codeReader = new BrowserQRCodeReader();
          const result = await codeReader.decodeFromImage(undefined as any, dataUrl);
          if (result?.getText()) {
            setInviteCode(result.getText());
            setScanMessage('QRからコードを取得しました。内容を確認して登録してください。');
          } else {
            setScanMessage('QRコードが読み取れませんでした。');
          }
        } catch (e) {
          console.error(e);
          setScanMessage('QRコードの解析に失敗しました。');
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setScanMessage('QRコードの読み取りに失敗しました。');
    }
  };

  const hiddenFileInputId = 'qr-file-input';

  const handleRevoke = async (linkId: string) => {
    try {
      await apiPost(`/api/student-teacher-links/${linkId}/revoke/`, {});
      await refreshLinks();
    } catch (err) {
      console.error(err);
      setLinkMessage('リンク解除に失敗しました。');
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 space-y-8 px-4">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">プロフィール</h1>
        <p className="mt-2 text-slate-600">ログイン中のアカウント情報を表示します。</p>
      </header>

      <section className="bg-white shadow rounded-lg p-6 space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">ユーザー情報</h2>
        <p className="text-slate-800 font-semibold text-base">{summary.user?.email ?? '---'}</p>
      </section>

      <section className="bg-white shadow rounded-lg p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">表示名 / プロフィール</h2>
          <p className="text-slate-600 mt-1">表示名や自己紹介を編集できます。</p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              {avatarPreview ? (
                <img src={avatarPreview} alt="avatar" className="w-16 h-16 rounded-full object-cover border" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-slate-200" />
              )}
            </div>
            <label className="px-3 py-2 rounded-md border border-slate-300 text-sm font-semibold text-slate-800 bg-slate-50 hover:bg-slate-100 cursor-pointer">
              アイコンを選択
              <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleAvatarChange} />
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">表示名</label>
            <input
              type="text"
              value={formState.displayName}
              onChange={handleChange('displayName')}
              className="mt-1 w-full rounded-md border border-slate-500 px-3 py-2 text-base text-slate-900 focus:border-indigo-500 focus:ring-indigo-500 placeholder:text-slate-400"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">学年・クラス</label>
            <input
              type="text"
              value={formState.grade}
              onChange={handleChange('grade')}
              className="mt-1 w-full rounded-md border border-slate-500 px-3 py-2 text-base text-slate-900 focus:border-indigo-500 focus:ring-indigo-500 placeholder:text-slate-400"
              placeholder="例: 中学1年A組"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">自己紹介</label>
            <textarea
              value={formState.selfIntro}
              onChange={handleChange('selfIntro')}
              className="mt-1 w-full rounded-md border border-slate-500 px-3 py-2 text-base text-slate-900 focus:border-indigo-500 focus:ring-indigo-500 placeholder:text-slate-400"
              rows={4}
              placeholder="簡単な自己紹介を入力してください"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? '保存中...' : '更新する'}
            </button>
            {summary.profile && (
              <span className="text-xs text-slate-500">最終更新: {new Date(summary.profile.updated_at).toLocaleString()}</span>
            )}
          </div>
        </form>
      </section>

      <section className="bg-white shadow rounded-lg p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">講師との紐付け</h2>
          <p className="text-slate-600 text-sm">招待コードを入力して講師に承認してもらってください。</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            className="flex-1 rounded-md border border-slate-400 px-3 py-2 text-base text-slate-900 focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="招待コードを入力"
          />
          <button
            type="button"
            onClick={handleRedeem}
            className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            登録
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <label
            htmlFor={hiddenFileInputId}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
          >
            カメラ/画像から読み取る
            <input
              id={hiddenFileInputId}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleScanFile(file);
              }}
            />
          </label>
          <label
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
          >
            画像から読み取る
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleScanFile(file);
              }}
            />
          </label>
        </div>
        {linkMessage && <p className="text-sm text-slate-600">{linkMessage}</p>}
        {scanMessage && <p className="text-sm text-slate-600">{scanMessage}</p>}

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">紐付け状況</h3>
          {summary.teacherLinks.length === 0 ? (
            <p className="text-sm text-slate-500">まだ講師との紐付けがありません。</p>
          ) : (
            <div className="divide-y">
              {summary.teacherLinks.map((link) => (
                <TeacherLinkRow key={link.student_teacher_link_id} link={link} onRevoke={handleRevoke} />
              ))}
            </div>
          )}
        </div>
      </section>

    </div>
  );
}

function TeacherLinkRow({ link, onRevoke }: { link: StudentTeacherLink; onRevoke: (id: string) => void }) {
  const displayName = link.teacher_display_name || link.custom_display_name || link.teacher_email || link.teacher;

  return (
    <div className="py-2 flex items-center justify-between">
      <div>
        <p className="text-sm font-semibold text-slate-900">{displayName}</p>
        {link.teacher_email && <p className="text-xs text-slate-600">{link.teacher_email}</p>}
        <p className="text-xs text-slate-600">状態: {link.status}</p>
      </div>
      <button
        type="button"
        onClick={() => onRevoke(link.student_teacher_link_id)}
        className="text-xs text-red-600 hover:underline"
      >
        解除
      </button>
    </div>
  );
}
