"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import { TeacherTestTemplatesAPI, TeacherGroupsAPI } from '@/lib/api-utils';

export default function TestsIndexPage() {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [error, setError] = useState<string|null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const [tpls, grps] = await Promise.all([
          TeacherTestTemplatesAPI.list().catch(() => []),
          TeacherGroupsAPI.list().catch(() => []),
        ]);
        setTemplates(Array.isArray(tpls) ? tpls : (tpls?.results || []));
        setGroups(Array.isArray(grps) ? grps : (grps?.results || []));
      } catch (e: any) {
        setError(e?.message || '読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">テスト管理</h1>
        <div className="space-x-2">
          <Link href="/admin-dashboard/tests/new" className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700">新規作成</Link>
        </div>
      </div>

      {loading ? (
        <div className="min-h-[200px] flex items-center justify-center"><LoadingSpinner /></div>
      ) : error ? (
        <div className="text-red-600">{error}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded shadow p-4">
            <h2 className="font-semibold mb-2">テンプレート</h2>
            <ul className="divide-y">
              {templates.map((t) => (
                <li key={t.id} className="py-2 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{t.title}</div>
                    <div className="text-xs text-gray-500">問題数: {t.items?.length ?? 0}</div>
                  </div>
                  <Link href={`/admin-dashboard/tests/new?template=${t.id}`} className="text-indigo-600 text-sm">このテンプレートで配信</Link>
                </li>
              ))}
              {templates.length === 0 && <li className="py-4 text-gray-500">テンプレートはまだありません</li>}
            </ul>
          </div>

          <div className="bg-white rounded shadow p-4">
            <h2 className="font-semibold mb-2">グループ</h2>
            <ul className="divide-y">
              {groups.map((g) => (
                <li key={g.id} className="py-2 flex items-center justify-between">
                  <div className="font-medium">{g.name}</div>
                  <Link href={`/admin-dashboard/groups/${g.id}`} className="text-indigo-600 text-sm">管理</Link>
                </li>
              ))}
              {groups.length === 0 && <li className="py-4 text-gray-500">グループはまだありません</li>}
            </ul>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
