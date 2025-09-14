'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import TeacherGuard from './TeacherGuard';
import {
  Bars3Icon,
  XMarkIcon,
  HomeIcon,
  UserGroupIcon,
  AcademicCapIcon,
  DocumentTextIcon,
  ChartBarIcon,
  CogIcon,
} from '@heroicons/react/24/outline';

const navigation = [
  { name: 'ダッシュボード', href: '/admin-dashboard', icon: HomeIcon },
  { name: 'グループ管理', href: '/admin-dashboard/groups', icon: UserGroupIcon },
  { name: '生徒管理', href: '/admin-dashboard/students', icon: AcademicCapIcon },
  { name: 'テスト作成', href: '/admin-dashboard/tests', icon: DocumentTextIcon },
  { name: '成績分析', href: '/admin-dashboard/analytics', icon: ChartBarIcon },
  { name: 'プロフィール', href: '/admin-dashboard/profile', icon: CogIcon },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: session } = useSession();
  const [profile, setProfile] = useState<any | null>(null);
  const pathname = usePathname();

  // 認証ページではレイアウトを表示しない
  if (pathname?.startsWith('/auth')) {
    return <>{children}</>;
  }

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      // localStorage からキャッシュを読み込んで即時表示
      try {
        const cached = localStorage.getItem('profile.cached');
        if (cached) {
          const p = JSON.parse(cached);
          if (mounted) setProfile(p);
        }
      } catch (e) {
        // ignore
      }

      try {
  const { apiGet } = await import('@/lib/api-utils');
  const data = await apiGet('/user/profile/');
        const p = data?.user || data;
        // normalize avatar URL if it contains Docker-internal hostname
        if (p && p.avatar_url) {
          try {
            const parsed = new URL(p.avatar_url);
            if (parsed.hostname === 'backend') {
              parsed.hostname = window.location.hostname || 'localhost';
              parsed.port = '8080';
            }
            parsed.searchParams.set('t', String(Date.now()));
            p.avatar_url = parsed.toString();
          } catch (e) {
            p.avatar_url = p.avatar_url + (p.avatar_url.includes('?') ? '&' : '?') + 't=' + Date.now();
          }
        }
        if (mounted) {
          setProfile(p);
          try { localStorage.setItem('profile.cached', JSON.stringify(p)); } catch(e) {}
        }
      } catch (err) {
        console.debug('admin layout profile fetch failed', err);
      }
    };
    load();

    const onProfileUpdated = (e: any) => {
      try {
        const d = e?.detail;
        if (d) setProfile(d);
      } catch (err) {
        console.debug('admin layout profileUpdated handler error', err);
      }
    };
    window.addEventListener('profileUpdated', onProfileUpdated as EventListener);

    return () => {
      mounted = false;
      window.removeEventListener('profileUpdated', onProfileUpdated as EventListener);
    };
  }, []);

  return (
    <TeacherGuard>
      <div className="h-screen flex overflow-hidden bg-gray-100">
      {/* Mobile sidebar */}
      <div className={`${sidebarOpen ? 'block' : 'hidden'} fixed inset-0 flex z-40 md:hidden`}>
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-75"
          onClick={() => setSidebarOpen(false)}
        ></div>
        <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              type="button"
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setSidebarOpen(false)}
            >
              <XMarkIcon className="h-6 w-6 text-white" />
            </button>
          </div>
          <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
            <div className="flex-shrink-0 flex items-center px-4">
              <h1 className="text-2xl font-bold text-indigo-600">Quiz App 管理</h1>
            </div>
            <nav className="mt-5 px-2 space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href || (item.href === '/admin-dashboard' && pathname === '/admin-dashboard/');
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`${
                      isActive
                        ? 'bg-indigo-100 text-indigo-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    } group flex items-center px-2 py-2 text-base font-medium rounded-md`}
                  >
                    <item.icon
                      className={`${
                        isActive ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500'
                      } mr-4 flex-shrink-0 h-6 w-6`}
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
            {/* モバイルサイドバー下部: プロフィールとログアウト */}
            <div className="absolute bottom-0 w-full p-4 border-t bg-white">
              <Link href="/admin-dashboard/profile" className="flex items-center mb-4 cursor-pointer">
                {(profile?.avatar_url || session?.user?.image) && (
                  <img src={profile?.avatar_url || session?.user?.image} alt="プロフィール" className="w-10 h-10 rounded-full mr-3" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-800">{profile?.display_name || session?.user?.name || session?.user?.email}</p>
                  <p className="text-xs text-indigo-600 font-medium">管理者</p>
                </div>
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: '/admin-top' })}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Static sidebar for desktop */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64">
          <div className="flex-1 flex flex-col min-h-0 border-r border-gray-200 bg-white">
            <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
              <div className="flex items-center flex-shrink-0 px-4">
                <h1 className="text-2xl font-bold text-indigo-600">Quiz App 管理</h1>
              </div>
              <nav className="mt-5 flex-1 px-2 bg-white space-y-1">
                {navigation.map((item) => {
                  const isActive = pathname === item.href || (item.href === '/admin-dashboard' && pathname === '/admin-dashboard/');
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`${
                        isActive
                          ? 'bg-indigo-100 text-indigo-900'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      } group flex items-center px-2 py-2 text-sm font-medium rounded-md`}
                    >
                      <item.icon
                        className={`${
                          isActive ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500'
                        } mr-3 flex-shrink-0 h-6 w-6`}
                      />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
            {/* デスクトップサイドバー下部: プロフィールとログアウト */}
            <div className="p-4 border-t bg-white">
              <Link href="/admin-dashboard/profile" className="flex items-center mb-4 cursor-pointer">
                {(profile?.avatar_url || session?.user?.image) && (
                  <img src={profile?.avatar_url || session?.user?.image} alt="プロフィール" className="w-10 h-10 rounded-full mr-3" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-800">{profile?.display_name || session?.user?.name || session?.user?.email}</p>
                  <p className="text-xs text-indigo-600 font-medium">管理者</p>
                </div>
              </Link>

              <button
                onClick={() => signOut({ callbackUrl: '/admin-top' })}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
              >
                ログアウト
              </button>
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        <div className="md:hidden pl-1 pt-1 sm:pl-3 sm:pt-3">
          <button
            type="button"
            className="-ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
            onClick={() => setSidebarOpen(true)}
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
        </div>

  {/* ヘッダーを削除：管理画面では空白ヘッダーは表示しない */}

        {/* Main content area */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
      </div>
    </TeacherGuard>
  );
}
