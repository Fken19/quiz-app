'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { apiGet } from '@/lib/api-utils';
import type { ApiUser, UserProfile } from '@/types/quiz';

const NAV_ITEMS = [
  { name: 'ダッシュボード', href: '/student/dashboard', icon: '🏠' },
  { name: 'クイズ', href: '/student/quiz', icon: '🎯' },
  { name: '結果', href: '/student/results', icon: '📝' },
  { name: 'テスト', href: '/student/tests', icon: '📊' },
  { name: '語彙', href: '/student/vocab', icon: '📚' },
  { name: 'プロフィール', href: '/student/profile', icon: '👤' },
];

interface ProfileState {
  user: ApiUser | null;
  profile: UserProfile | null;
}

export default function StudentNavigation() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileState, setProfileState] = useState<ProfileState>({ user: null, profile: null });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const user = (await apiGet('/api/users/me/')) as ApiUser;
        let profile: UserProfile | null = null;
        try {
          profile = (await apiGet(`/api/user-profiles/${user.user_id}/`)) as UserProfile;
        } catch {
          profile = null;
        }
        setProfileState({ user, profile });
      } catch (err) {
        console.debug('failed to load profile', err);
      }
    };

    fetchProfile();
  }, []);

  const isActive = (href: string) => {
    if (href === '/student/dashboard') {
      return pathname === '/student/dashboard';
    }
    return pathname.startsWith(href);
  };

  const userLabel = profileState.profile?.display_name || profileState.user?.email || 'ゲスト';
  const userId = profileState.user?.user_id ? `ID: ${profileState.user.user_id}` : '';

  const content = (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b">
        <h1 className="text-xl font-bold text-slate-900">英単語クイズ</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              isActive(item.href)
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            onClick={() => setMenuOpen(false)}
          >
            <span>{item.icon}</span>
            {item.name}
          </Link>
        ))}
      </div>
      <div className="border-t px-4 py-6 text-sm text-slate-600 space-y-2">
        <div>
          <p className="font-semibold text-slate-800">{userLabel}</p>
          {userId && <p className="text-xs text-slate-500">{userId}</p>}
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="w-full text-left text-red-600 hover:text-red-700"
        >
          ログアウト
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        className="lg:hidden fixed top-4 left-4 z-50 bg-indigo-600 text-white p-2 rounded-md shadow"
        onClick={() => setMenuOpen((v) => !v)}
      >
        <span className="text-xl">{menuOpen ? '×' : '☰'}</span>
      </button>
      <nav className="hidden lg:block fixed top-0 left-0 h-full w-64 bg-white shadow-lg">
        {content}
      </nav>
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <div className="absolute top-0 left-0 h-full w-64 bg-white shadow-lg">
            {content}
          </div>
        </div>
      )}
    </>
  );
}
