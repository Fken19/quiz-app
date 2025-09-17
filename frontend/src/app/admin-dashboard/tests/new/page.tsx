"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import { TeacherGroupsAPI, TeacherTestTemplatesAPI } from '@/lib/api-utils';

export default function NewTestPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [form, setForm] = useState<{ groupId: string; templateId: string | null; title: string; timerSeconds: number | '' }>(
    { groupId: '', templateId: null, title: '', timerSeconds: '' }
  );
  const [error, setError] = useState<string|null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const [grps, tpls] = await Promise.all([
          TeacherGroupsAPI.list().catch(() => []),
          TeacherTestTemplatesAPI.list().catch(() => []),
        ]);
        setGroups(Array.isArray(grps) ? grps : (grps?.results || []));
        const tplArr = Array.isArray(tpls) ? tpls : (tpls?.results || []);
        setTemplates(tplArr);
        const tplFromQS = sp.get('template');
        if (tplFromQS && tplArr.find((t:any)=>t.id===tplFromQS)) {
          setForm((f) => ({ ...f, templateId: tplFromQS }));
        }
      } catch (e:any) {
        setError(e?.message || '読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [sp]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.groupId) {
      setError('グループを選択してください');
      return;
    }
    try {
      const payload: any = { title: form.title || undefined, template_id: form.templateId || undefined };
      if (form.timerSeconds !== '') payload.timer_seconds = Number(form.timerSeconds);
      await TeacherGroupsAPI.assignTest(form.groupId, payload);
      router.push('/admin-dashboard/tests');
    } catch (e:any) {
      setError(e?.message || '配信に失敗しました');
    }
  };

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">テスト配信</h1>
      </div>
      {loading ? (
        <div className="min-h-[200px] flex items-center justify-center"><LoadingSpinner /></div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5 max-w-xl">
          {error && <div className="text-red-600">{error}</div>}

          <div>
            <label className="block text-sm text-gray-700 mb-1">グループ</label>
            <select value={form.groupId} onChange={(e)=>setForm({...form, groupId: e.target.value})} className="w-full border rounded px-3 py-2">
              <option value="">選択してください</option>
              {groups.map((g:any)=>(<option key={g.id} value={g.id}>{g.name}</option>))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">テンプレート（任意）</label>
            <select value={form.templateId || ''} onChange={(e)=>setForm({...form, templateId: e.target.value || null})} className="w-full border rounded px-3 py-2">
              <option value="">未選択（テンプレなし）</option>
              {templates.map((t:any)=>(<option key={t.id} value={t.id}>{t.title}</option>))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">タイトル（任意）</label>
            <input value={form.title} onChange={(e)=>setForm({...form, title: e.target.value})} className="w-full border rounded px-3 py-2" placeholder="Assignment" />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">制限時間（秒・任意）</label>
            <input type="number" value={form.timerSeconds} onChange={(e)=>setForm({...form, timerSeconds: e.target.value === '' ? '' : Number(e.target.value)})} className="w-full border rounded px-3 py-2" placeholder="例: 300" />
          </div>

          <div className="pt-4">
            <button type="submit" className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700">配信する</button>
            <a href="/admin-dashboard/tests" className="ml-3 text-gray-600 hover:text-gray-900">キャンセル</a>
          </div>
        </form>
      )}
    </AdminLayout>
  );
}
