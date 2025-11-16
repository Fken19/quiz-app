'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api-utils';
import type { InvitationCode } from '@/types/quiz';

export default function TeacherInvitesPage() {
  const [invites, setInvites] = useState<InvitationCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expiresMinutes, setExpiresMinutes] = useState<number>(60);
  const [issuing, setIssuing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchInvites = async () => {
    try {
      setLoading(true);
      const response = await apiGet('/api/invitation-codes/?page_size=100').catch(() => ({ results: [] }));
      const list: InvitationCode[] = Array.isArray(response) ? response : response?.results || [];
      setInvites(list);
    } catch (err) {
      console.error(err);
      setError('招待コードの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvites();
  }, []);

  const handleIssue = async () => {
    try {
      setIssuing(true);
      setMessage(null);
      await apiPost('/api/invitation-codes/issue/', { expires_in_minutes: expiresMinutes });
      setMessage('招待コードを発行しました。');
      await fetchInvites();
    } catch (err) {
      console.error(err);
      setMessage('招待コードの発行に失敗しました。');
    } finally {
      setIssuing(false);
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
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">招待コード管理</h1>
          <p className="text-slate-600 text-sm">生徒を招待するコードを発行し、状態を確認できます。</p>
        </div>
      </header>

      <div className="bg-white shadow rounded-lg p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <label className="text-sm text-slate-700">有効期限（分）</label>
          <input
            type="number"
            min={5}
            max={1440}
            value={expiresMinutes}
            onChange={(e) => setExpiresMinutes(Number(e.target.value))}
            className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={handleIssue}
            disabled={issuing}
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {issuing ? '発行中...' : '招待コードを発行'}
          </button>
          {message && <span className="text-sm text-slate-600">{message}</span>}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg divide-y">
        <div className="grid grid-cols-4 gap-4 px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <span>コード</span>
          <span>期限</span>
          <span>使用状況</span>
          <span>発行日時</span>
        </div>
        {invites.map((invite) => (
          <div key={invite.invitation_code_id} className="grid grid-cols-4 gap-4 px-6 py-3 text-sm text-slate-700">
            <span className="font-semibold">{invite.invitation_code}</span>
            <span>{invite.expires_at ? new Date(invite.expires_at).toLocaleString() : '期限なし'}</span>
            <span>{invite.used_at ? `使用済: ${new Date(invite.used_at).toLocaleDateString()}` : '未使用'}</span>
            <span>{invite.issued_at ? new Date(invite.issued_at).toLocaleString() : '---'}</span>
          </div>
        ))}
        {invites.length === 0 && (
          <div className="px-6 py-6 text-sm text-slate-500">招待コードが登録されていません。</div>
        )}
      </div>
    </div>
  );
}
