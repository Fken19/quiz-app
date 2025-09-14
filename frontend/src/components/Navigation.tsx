'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { apiGet } from '@/lib/api-utils';

export default function Navigation() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [profile, setProfile] = useState<any | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadProfile = async () => {
      // まず localStorage にキャッシュされたプロフィールを優先表示
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
        const data = await apiGet('/user/profile/');
        const p = data?.user || data;
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
        // フェッチ失敗は黙って session を使う
        console.debug('プロフィール取得失敗:', err);
      }
    };

    loadProfile();
  const onProfileUpdated = (e: any) => {
      try {
        const d = e?.detail;
        if (d) setProfile(d);
      } catch (err) {
        console.debug('profileUpdated handler error', err);
      }
    };

  window.addEventListener('profileUpdated', onProfileUpdated as EventListener);

    return () => {
      mounted = false;
      window.removeEventListener('profileUpdated', onProfileUpdated as EventListener);
    };
  }, []);

  if (status === 'loading') {
    return null; // ローディング中はナビゲーションを表示しない
  }

  if (!session) {
    return null; // ログインしていない場合はナビゲーションを表示しない
  }

  // 管理者画面配下では学習者用ナビゲーションを表示しない
  if (pathname?.startsWith('/admin-dashboard')) {
    return null;
  }

  const navigation = [
    { name: 'ダッシュボード', href: '/dashboard', icon: '🏠' },
    { name: 'クイズ開始', href: '/quiz/start', icon: '📝' },
    { name: 'マイ履歴', href: '/history', icon: '📊' },
    { name: 'プロフィール', href: '/profile', icon: '👤' },
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard' || pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="bg-blue-600 text-white p-2 rounded-md shadow-lg"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {isMenuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Desktop sidebar */}
      <nav className="hidden lg:block fixed left-0 top-0 h-full w-64 bg-white shadow-lg border-r">
        <div className="p-6">
          <h1 className="text-xl font-bold text-gray-800">英単語クイズ</h1>
        </div>
        
        <div className="px-4">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center px-4 py-3 mb-2 rounded-lg transition-colors ${
                isActive(item.href)
                  ? 'bg-blue-100 text-blue-700 border-l-4 border-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className="mr-3 text-lg">{item.icon}</span>
              {item.name}
            </Link>
          ))}
        </div>

        <div className="absolute bottom-0 w-full p-4 border-t">
          <div className="flex items-center mb-4">
            {(profile?.avatar_url || session.user?.image) && (
              <img
                src={profile?.avatar_url || session.user?.image}
                alt="プロフィール"
                className="w-10 h-10 rounded-full mr-3"
              />
            )}
            <div>
              <p className="text-sm font-medium text-gray-800">
                {profile?.display_name || session.user?.name || session.user?.email}
              </p>
              <p className="text-xs text-gray-500">学習者</p>
            </div>
          </div>
          
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
          >
            ログアウト
          </button>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      {isMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="fixed inset-0 bg-black opacity-50"
            onClick={() => setIsMenuOpen(false)}
          />
          <div className="fixed left-0 top-0 h-full w-64 bg-white shadow-lg">
            <div className="p-6 pt-16">
              <h1 className="text-xl font-bold text-gray-800">英単語クイズ</h1>
            </div>
            
            <div className="px-4">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center px-4 py-3 mb-2 rounded-lg transition-colors ${
                    isActive(item.href)
                      ? 'bg-blue-100 text-blue-700 border-l-4 border-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="mr-3 text-lg">{item.icon}</span>
                  {item.name}
                </Link>
              ))}
            </div>

            <div className="absolute bottom-0 w-full p-4 border-t">
              <div className="flex items-center mb-4">
                {(profile?.avatar_url || session.user?.image) && (
                  <img
                    src={profile?.avatar_url || session.user.image}
                    alt="プロフィール"
                    className="w-10 h-10 rounded-full mr-3"
                  />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {profile?.display_name || session.user?.name || session.user?.email}
                  </p>
                  <p className="text-xs text-gray-500">学習者</p>
                </div>
              </div>
              
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
