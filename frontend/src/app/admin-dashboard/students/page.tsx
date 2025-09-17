'use client';

import { useState, useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import AdminLayout from '@/components/AdminLayout';
import InviteCodeManagement from '@/components/InviteCodeManagement';
import LoadingSpinner from '@/components/LoadingSpinner';
import { apiGet, apiPost, apiDelete } from '@/lib/api-utils';
import { normalizeAvatarUrl } from '@/lib/avatar';

interface TeacherStudentLink {
  id: string;
  teacher: {
    id: string;
    email: string;
    display_name: string;
  };
  student: {
    id: string;
    email: string;
    display_name: string;
  avatar_url?: string | null;
  avatar?: string | null;
    quiz_count: number;
    total_score: number;
    average_score: number;
  };
  status: 'pending' | 'active' | 'revoked';
  linked_at: string;
  revoked_at?: string;
}

export default function StudentsPage() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<'students' | 'invites'>('students');
  const [students, setStudents] = useState<TeacherStudentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'active'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (status === "unauthenticated") {
      signIn("google");
      return;
    }
    if (status === "authenticated") {
      fetchStudents();
    }
  }, [status]);

  const fetchStudents = async () => {
    try {
      const data = await apiGet('/teacher/students/');
      // 生徒のアバターURLを正規化
      const normalized = Array.isArray(data)
        ? data.map((link: any) => ({
            ...link,
            student: {
              ...link.student,
              avatar_url: normalizeAvatarUrl(link.student?.avatar_url || link.student?.avatar),
            },
          }))
        : data;
      setStudents(normalized);
    } catch (error) {
      console.error('生徒データ取得エラー:', error);
      // エラーメッセージのみ提示（フォールバックはしない）
      try {
        // @ts-ignore
        const msg = error?.message || String(error);
        alert(`生徒データ取得エラー: ${msg}`);
      } catch (_) {}
    } finally {
      setLoading(false);
    }
  };

  const revokeStudentLink = async (linkId: string) => {
    if (!confirm('この生徒との紐付けを解除しますか？解除後は成績が閲覧できなくなります。')) {
      return;
    }

    try {
      await apiDelete(`/teacher/students/${linkId}/revoke/`);
      setStudents(prev => prev.map(link => 
        link.id === linkId 
          ? { ...link, status: 'revoked' as const, revoked_at: new Date().toISOString() }
          : link
      ));
      alert('生徒との紐付けを解除しました');
    } catch (error) {
      console.error('紐付け解除エラー:', error);
      alert('紐付け解除に失敗しました');
    }
  };

  const filteredStudents = students.filter(link => {
    const matchesSearch = link.student.display_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter === 'all') {
      matchesStatus = link.status !== 'revoked';
    } else {
      matchesStatus = link.status === statusFilter;
    }
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      active: 'bg-green-100 text-green-800',
      revoked: 'bg-gray-100 text-gray-800'
    };
    
    const labels = {
      pending: '承認待ち',
      active: '有効',
      revoked: '解除済み'
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${badges[status as keyof typeof badges] || badges.active}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  if (status === "loading" || loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="large" />
        </div>
      </AdminLayout>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-black">生徒管理</h1>
          <p className="mt-2 text-black">生徒の招待・紐付け状況の確認・成績管理</p>
        </div>

        {/* 統計カード */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-medium">✓</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-black truncate">
                      有効な生徒
                    </dt>
                    <dd className="text-lg font-medium text-black">
                      {students.filter(s => s.status === 'active').length}名
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-medium">⏳</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-black truncate">
                      承認待ち
                    </dt>
                    <dd className="text-lg font-medium text-black">
                      {students.filter(s => s.status === 'pending').length}名
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-medium">📈</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-black truncate">
                      平均スコア
                    </dt>
                    <dd className="text-lg font-medium text-black">
                      {students.filter(s => s.status === 'active').length > 0 
                        ? (students.filter(s => s.status === 'active').reduce((sum, s) => sum + s.student.average_score, 0) / students.filter(s => s.status === 'active').length).toFixed(1)
                        : 0
                      }%
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-medium">🎯</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-black truncate">
                      総クイズ回数
                    </dt>
                    <dd className="text-lg font-medium text-black">
                      {students.filter(s => s.status === 'active').reduce((sum, s) => sum + s.student.quiz_count, 0)}回
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* タブナビゲーション */}
      <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('students')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'students'
                  ? 'border-blue-500 text-blue-600'
          : 'border-transparent text-black hover:text-black hover:border-gray-300'
              }`}
            >
              生徒一覧
        <span className="ml-2 py-0.5 px-2 text-xs bg-gray-100 text-black rounded-full">
                {students.filter(s => s.status === 'active').length}
              </span>
            </button>
            
            <button
              onClick={() => setActiveTab('invites')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'invites'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              招待コード管理
            </button>
          </nav>
        </div>

        {/* タブコンテンツ */}
        {activeTab === 'students' ? (
          <div className="space-y-6">
            {/* 検索・フィルター */}
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="search" className="block text-sm font-medium text-black mb-2">検索</label>
                  <input
                    type="text"
                    id="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="生徒名で検索"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-black mb-2">ステータス</label>
                  <div className="flex space-x-2">
                    {[
                      { key: 'all', label: '全て' },
                      { key: 'active', label: '有効' },
                      { key: 'pending', label: '承認待ち' }
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => setStatusFilter(key as any)}
                        className={`px-3 py-1 text-sm rounded-full ${
                          statusFilter === key
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 生徒リスト */}
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">
                  紐付けされた生徒 ({filteredStudents.length}名)
                </h3>
                <p className="mt-1 text-sm text-gray-900">
                          招待コードで紐付けされた生徒の一覧と成績情報
                        </p>
              </div>

              {filteredStudents.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-black text-6xl mb-4">👥</div>
                  <h3 className="text-lg font-medium text-black mb-2">{searchTerm ? '検索結果がありません' : '紐付けされた生徒はいません'}</h3>
                  <p className="text-black mb-4">{searchTerm ? '検索条件に一致する生徒がありません。' : '招待コードを発行して生徒を招待してください。'}</p>
                  {!searchTerm && (
                    <button
                      onClick={() => setActiveTab('invites')}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                    >
                      招待コードを発行
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                              <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">生徒情報</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">状態</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">学習実績</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">紐付け日時</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">アクション</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {filteredStudents.map((link) => (
                                <tr key={link.id} className="hover:bg-gray-50">
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                      {link.student.avatar_url ? (
                                        <img src={link.student.avatar_url} alt="avatar" className="w-10 h-10 rounded-full object-cover border" />
                                      ) : (
                                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-semibold">
                                          {link.student.display_name?.[0]?.toUpperCase() || 'S'}
                                        </div>
                                      )}
                                      <div>
                                        <div className="text-sm font-medium text-black">{link.student.display_name || '未設定'}</div>
                                        {/* プライバシー保護のためメールは表示しない */}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(link.status)}</td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-black">クイズ: {link.student.quiz_count}回</div>
                                    <div className="text-sm text-black">平均: {Math.round(link.student.average_score)}%</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-black">{new Date(link.linked_at).toLocaleDateString('ja-JP')}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                                    {link.status === 'active' && (
                                      <>
                                        <a href={`/admin-dashboard/students/${link.student.id}`} className="text-blue-600 hover:text-blue-900">成績詳細</a>
                                        <button onClick={() => revokeStudentLink(link.id)} className="text-red-600 hover:text-red-900">紐付け解除</button>
                                      </>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <InviteCodeManagement />
        )}
      </div>
    </AdminLayout>
  );
}