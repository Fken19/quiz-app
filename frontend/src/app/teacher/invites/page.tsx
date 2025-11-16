'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api-utils';
import type { InvitationCode } from '@/types/quiz';

export default function TeacherInvitesPage() {
  const [invites, setInvites] = useState<InvitationCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expiresHours, setExpiresHours] = useState<number>(1); // 1時間単位
  const [issuing, setIssuing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [qrFor, setQrFor] = useState<string | null>(null);

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
      await apiPost('/api/invitation-codes/issue/', { expires_in_minutes: expiresHours * 60 });
      setMessage('招待コードを発行しました。');
      await fetchInvites();
    } catch (err) {
      console.error(err);
      setMessage('招待コードの発行に失敗しました。');
    } finally {
      setIssuing(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      setActionMessage(null);
      await apiPost(`/api/invitation-codes/${id}/revoke/`, {});
      setActionMessage('招待コードを失効しました。');
      await fetchInvites();
    } catch (err) {
      console.error(err);
      setActionMessage('失効に失敗しました。');
    }
  };

  const qrUrl = (code: string) =>
    `https://chart.googleapis.com/chart?chs=220x220&cht=qr&chl=${encodeURIComponent(code)}&choe=UTF-8`;

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
          <label className="text-sm text-slate-800 font-semibold">有効期限（時間単位）</label>
          <input
            type="number"
            min={1}
            max={24}
            step={1}
            value={expiresHours}
            onChange={(e) => setExpiresHours(Number(e.target.value))}
            className="w-28 rounded-md border border-slate-500 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-indigo-500"
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

      {actionMessage && <p className="text-sm text-slate-800">{actionMessage}</p>}

      <div className="bg-white shadow rounded-lg divide-y">
        <div className="grid grid-cols-6 gap-4 px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">
          <span>コード</span>
          <span>QR</span>
          <span>期限</span>
          <span>使用状況</span>
          <span>発行日時</span>
          <span>操作</span>
        </div>
        {[...invites]
          .sort((a, b) => new Date(b.issued_at).getTime() - new Date(a.issued_at).getTime())
          .map((invite) => {
          const isExpired = invite.expires_at ? new Date(invite.expires_at) < new Date() : false;
          const isUsed = Boolean(invite.used_at);
          const isRevoked = Boolean(invite.revoked);
          const disabled = isExpired || isUsed || isRevoked;
          const statusText = isRevoked ? '無効(失効)' : isUsed ? '無効(使用済)' : isExpired ? '無効(期限切れ)' : '有効';
          return (
            <div
              key={invite.invitation_code_id}
              className={`grid grid-cols-6 gap-4 px-6 py-3 text-sm ${disabled ? 'text-slate-400' : 'text-slate-900'}`}
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold select-all">{invite.invitation_code}</span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    navigator.clipboard.writeText(invite.invitation_code);
                    setCopiedId(invite.invitation_code_id);
                    setTimeout(() => setCopiedId(null), 1500);
                  }}
                  className="text-indigo-600 text-lg hover:text-indigo-800 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="コードをコピー"
                >
                  📋
                </button>
                {copiedId === invite.invitation_code_id && <span className="text-xs text-slate-500">コピーしました</span>}
                {isRevoked && <span className="text-xs px-2 py-0.5 rounded bg-slate-200">失効</span>}
                {!isRevoked && isUsed && <span className="text-xs px-2 py-0.5 rounded bg-slate-200">使用済</span>}
                {!isRevoked && !isUsed && isExpired && (
                  <span className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-700">期限切れ</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQrFor(qrFor === invite.invitation_code_id ? null : invite.invitation_code_id)}
                  className="text-sm text-indigo-600 hover:text-indigo-800"
                >
                  {qrFor === invite.invitation_code_id ? '閉じる' : 'QR表示'}
                </button>
                {qrFor === invite.invitation_code_id && (
                  <img src={qrUrl(invite.invitation_code)} alt="QR" className="w-16 h-16 border rounded" />
                )}
              </div>
              <span>{invite.expires_at ? new Date(invite.expires_at).toLocaleString() : '期限なし'}</span>
              <span>{statusText}</span>
              <span>{invite.issued_at ? new Date(invite.issued_at).toLocaleString() : '---'}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleRevoke(invite.invitation_code_id)}
                  className="px-3 py-1 text-xs rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  失効
                </button>
              </div>
            </div>
          );
        })}
        {invites.length === 0 && (
          <div className="px-6 py-6 text-sm text-slate-500">招待コードが登録されていません。</div>
        )}
      </div>
    </div>
  );
}
