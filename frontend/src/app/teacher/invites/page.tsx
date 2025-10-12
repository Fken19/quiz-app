'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api-utils';
import type { InvitationCode } from '@/types/quiz';

export default function TeacherInvitesPage() {
  const [invites, setInvites] = useState<InvitationCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

    fetchInvites();
  }, []);

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
      <header>
        <h1 className="text-2xl font-bold text-slate-900">招待コード管理</h1>
        <p className="text-slate-600">発行済みの招待コードと有効期限を表示しています。</p>
      </header>

      <div className="bg-white shadow rounded-lg divide-y">
        <div className="grid grid-cols-5 gap-4 px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <span>ID</span>
          <span>コード</span>
          <span>発行者</span>
          <span>期限</span>
          <span>使用状況</span>
        </div>
        {invites.map((invite) => (
          <div key={invite.invitation_code_id} className="grid grid-cols-5 gap-4 px-6 py-3 text-sm text-slate-700">
            <span className="truncate">{invite.invitation_code_id}</span>
            <span>{invite.invitation_code}</span>
            <span>{invite.issued_by}</span>
            <span>{invite.expires_at ? new Date(invite.expires_at).toLocaleString() : '期限なし'}</span>
            <span>{invite.used_at ? `使用済: ${new Date(invite.used_at).toLocaleDateString()}` : '未使用'}</span>
          </div>
        ))}
        {invites.length === 0 && (
          <div className="px-6 py-6 text-sm text-slate-500">招待コードが登録されていません。</div>
        )}
      </div>
    </div>
  );
}
