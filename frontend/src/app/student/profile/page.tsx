'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPatch, apiPost } from '@/lib/api-utils';
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

const getTeacherDisplayName = (link: StudentTeacherLink) =>
  link.teacher_display_name || link.custom_display_name || link.teacher_email || link.teacher;

const getTeacherStatusLabel = (status: StudentTeacherLink['status']) => {
  if (status === 'pending') return '承認待ち';
  if (status === 'active') return '承認済み';
  if (status === 'revoked') return '解除済み';
  return status;
};

interface TeacherInviteProfile {
  teacher_id: string;
  display_name: string;
  affiliation?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  updated_at: string;
}

interface InvitePreviewResult {
  teacher_profile: TeacherInviteProfile;
  existing_link_status?: StudentTeacherLink['status'] | null;
  can_redeem: boolean;
}

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
  const [invitePreview, setInvitePreview] = useState<InvitePreviewResult | null>(null);
  const [previewingInvite, setPreviewingInvite] = useState(false);
  const [redeemingInvite, setRedeemingInvite] = useState(false);

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

  const handlePreviewRedeem = async () => {
    if (!inviteCode.trim()) {
      setLinkMessage('招待コードを入力してください。');
      return;
    }
    try {
      setPreviewingInvite(true);
      setLinkMessage(null);
      const preview = await apiPost<InvitePreviewResult>('/api/invitation-codes/preview/', { invitation_code: inviteCode.trim() });
      setInvitePreview(preview);
    } catch (err) {
      console.error(err);
      setLinkMessage('招待コードの確認に失敗しました。');
    } finally {
      setPreviewingInvite(false);
    }
  };

  const handleConfirmRedeem = async () => {
    if (!inviteCode.trim()) return;
    try {
      setRedeemingInvite(true);
      await apiPost('/api/invitation-codes/redeem/', { invitation_code: inviteCode.trim() });
      setInvitePreview(null);
      setInviteCode('');
      await refreshLinks();
      setLinkMessage('承認待ちとして送信しました。');
    } catch (err) {
      console.error(err);
      setLinkMessage('招待コードの登録に失敗しました。');
    } finally {
      setRedeemingInvite(false);
    }
  };

  const closeInvitePreview = () => {
    setInvitePreview(null);
  };

  const invitePreviewProfile = invitePreview?.teacher_profile;
  let inviteStatusMessage: string | null = null;
  if (invitePreview) {
    if (invitePreview.existing_link_status === 'pending') {
      inviteStatusMessage = 'この講師とは既に承認待ちです。';
    } else if (invitePreview.existing_link_status === 'active') {
      inviteStatusMessage = 'この講師とは既に紐付け済みです。';
    } else if (invitePreview.existing_link_status === 'revoked') {
      inviteStatusMessage = '以前解除した講師です。申請すると再度紐付けされます。';
    }
    if (!invitePreview.can_redeem && !inviteStatusMessage) {
      inviteStatusMessage = 'この招待コードでは現在申請できません。';
    }
  }

  const decodeQrWithBarcodeDetector = async (image: HTMLImageElement) => {
    // BarcodeDetectorは対応ブラウザのみ利用
    // @ts-ignore
    if (typeof window === 'undefined' || !('BarcodeDetector' in window)) {
      throw new Error('BarcodeDetectorに対応していません');
    }
    // @ts-ignore
    const supported = await window.BarcodeDetector.getSupportedFormats();
    if (!supported.includes('qr_code')) {
      throw new Error('QRコードの読み取りに対応していません');
    }
    // @ts-ignore
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('QRコードの解析に失敗しました');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const results = await detector.detect(canvas);
    if (!results.length) throw new Error('QRコードが見つかりませんでした');
    return results[0].rawValue;
  };

  const handleScanFile = async (file: File) => {
    setScanMessage(null);
    setScanning(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const dataUrl = ev.target?.result as string;
          const img = new Image();
          img.onload = async () => {
            try {
              const text = await decodeQrWithBarcodeDetector(img);
              setInviteCode(text);
              setScanMessage('QRからコードを取得しました。内容を確認して登録してください。');
            } catch (e) {
              console.error(e);
              setScanMessage(e instanceof Error ? e.message : 'QRコードの解析に失敗しました。');
            } finally {
              setScanning(false);
            }
          };
          img.onerror = () => {
            setScanMessage('画像の読み込みに失敗しました。');
            setScanning(false);
          };
          img.src = dataUrl;
        } catch (e) {
          console.error(e);
          setScanMessage('QRコードの解析に失敗しました。');
          setScanning(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setScanMessage('QRコードの読み取りに失敗しました。');
      setScanning(false);
    }
  };

  const handleRevoke = async (link: StudentTeacherLink) => {
    if (link.status === 'revoked') return;
    const teacherName = getTeacherDisplayName(link);
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(`${teacherName}との紐付けを解除しますか？`);
      if (!confirmed) return;
    }
    try {
      await apiPost(`/api/student-teacher-links/${link.student_teacher_link_id}/revoke/`, {});
      await refreshLinks();
      setLinkMessage('講師との紐付けを解除しました。');
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
            onClick={handlePreviewRedeem}
            disabled={previewingInvite}
            className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {previewingInvite ? '確認中...' : '確認'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <label
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
          >
            カメラ/画像から読み取る
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleScanFile(file);
                e.target.value = '';
              }}
              disabled={scanning}
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
                <TeacherLinkRow
                  key={link.student_teacher_link_id}
                  link={link}
                  onRevoke={handleRevoke}
                  onViewProfile={() => router.push(`/student/teachers/${link.student_teacher_link_id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {invitePreview && invitePreviewProfile && (
        <div className="fixed inset-0 bg-black/50 z-30 flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">講師プロフィールを確認</h3>
              <button
                type="button"
                onClick={closeInvitePreview}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col items-center text-center gap-3">
              {invitePreviewProfile.avatar_url ? (
                <img
                  src={invitePreviewProfile.avatar_url}
                  alt={`${invitePreviewProfile.display_name}のアイコン`}
                  className="w-20 h-20 rounded-full object-cover border border-slate-200"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-slate-200 flex items-center justify-center text-2xl text-slate-500">
                  👩‍🏫
                </div>
              )}
              <div>
                <p className="text-xl font-bold text-slate-900">{invitePreviewProfile.display_name}</p>
                <p className="text-sm text-slate-600 mt-1">
                  {invitePreviewProfile.affiliation || '所属情報は未設定です'}
                </p>
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700 max-h-40 overflow-y-auto whitespace-pre-wrap">
              {invitePreviewProfile.bio || '自己紹介はまだ登録されていません。'}
            </div>
            <p className="text-xs text-slate-500 text-right">
              最終更新: {new Date(invitePreviewProfile.updated_at).toLocaleString('ja-JP')}
            </p>
            {inviteStatusMessage && (
              <p className="text-sm text-center text-slate-600">{inviteStatusMessage}</p>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={closeInvitePreview}
                className="flex-1 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleConfirmRedeem}
                disabled={!invitePreview.can_redeem || redeemingInvite}
                className="flex-1 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {redeemingInvite ? '申請中...' : 'この講師に申請する'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

type TeacherLinkRowProps = {
  link: StudentTeacherLink;
  onRevoke: (link: StudentTeacherLink) => void;
  onViewProfile: () => void;
};

function TeacherLinkRow({ link, onRevoke, onViewProfile }: TeacherLinkRowProps) {
  const displayName = getTeacherDisplayName(link);
  const isRevoked = link.status === 'revoked';
  const statusLabel = getTeacherStatusLabel(link.status);

  return (
    <div className="py-2 flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={() => {
          if (isRevoked) return;
          onViewProfile();
        }}
        className={`flex-1 rounded-md px-3 py-2 text-left transition ${
          isRevoked
            ? 'bg-slate-100 text-slate-400 cursor-default'
            : 'bg-slate-50 text-slate-900 hover:bg-slate-100'
        }`}
      >
        <p className="text-sm font-semibold">{displayName}</p>
        <p className={`text-xs ${isRevoked ? 'text-slate-400' : 'text-slate-600'}`}>状態: {statusLabel}</p>
      </button>
      <button
        type="button"
        onClick={() => {
          if (isRevoked) return;
          onRevoke(link);
        }}
        className={`text-xs ${isRevoked ? 'text-slate-400 cursor-default' : 'text-red-600 hover:underline'}`}
        disabled={isRevoked}
      >
        {isRevoked ? '解除済み' : '解除'}
      </button>
    </div>
  );
}
