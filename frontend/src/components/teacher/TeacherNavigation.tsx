'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { name: 'ダッシュボード', href: '/teacher/dashboard' },
  { name: '生徒一覧', href: '/teacher/students' },
  { name: 'グループ管理', href: '/teacher/groups' },
  { name: 'テスト', href: '/teacher/tests' },
  { name: '講師一覧', href: '/teacher/staff' },
  { name: '語彙', href: '/teacher/vocab' },
  { name: '招待コード', href: '/teacher/invites' },
  { name: 'プロフィール', href: '/teacher/profile' },
];

export default function TeacherNavigation() {
  const pathname = usePathname();

  return (
    <nav className="h-full w-64 bg-slate-900 text-white shadow-lg">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-lg font-semibold">講師ポータル</h1>
      </div>
      <div className="px-4 py-6 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-4 py-2 text-sm font-medium transition ${
                active ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              {item.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
