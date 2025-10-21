'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { 
  HomeIcon, 
  UserGroupIcon, 
  FolderIcon, 
  ClipboardDocumentListIcon,
  AcademicCapIcon,
  BookOpenIcon,
  TicketIcon,
  ShieldCheckIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';

const NAV_ITEMS = [
  { name: 'ダッシュボード', href: '/teacher/dashboard', icon: HomeIcon },
  { name: '生徒一覧', href: '/teacher/students', icon: UserGroupIcon },
  { name: 'グループ管理', href: '/teacher/groups', icon: FolderIcon },
  { name: 'テスト', href: '/teacher/tests', icon: ClipboardDocumentListIcon },
  { name: '講師一覧', href: '/teacher/staff', icon: AcademicCapIcon },
  { name: '語彙管理', href: '/teacher/vocab', icon: BookOpenIcon },
  { name: '招待コード', href: '/teacher/invites', icon: TicketIcon },
  { name: 'ホワイトリスト', href: '/teacher/whitelist', icon: ShieldCheckIcon },
];

export default function TeacherNavigation() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <nav className="h-full w-64 bg-gradient-to-b from-slate-900 to-slate-800 text-white shadow-2xl flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          講師ポータル
        </h1>
        {session?.user?.email && (
          <p className="text-xs text-slate-400 mt-2 truncate">{session.user.email}</p>
        )}
      </div>

      {/* Main Navigation */}
      <div className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                active 
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/50' 
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>

      {/* Footer - Profile & Logout */}
      <div className="border-t border-slate-700 p-3 space-y-1">
        <Link
          href="/teacher/profile"
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
            pathname === '/teacher/profile'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/50'
              : 'text-slate-300 hover:bg-slate-700 hover:text-white'
          }`}
        >
          <UserCircleIcon className="h-5 w-5" />
          <span>プロフィール</span>
        </Link>
        <Link
          href="/auth/signout"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-300 hover:bg-red-900/30 hover:text-red-200 transition-all duration-200"
        >
          <ArrowRightOnRectangleIcon className="h-5 w-5" />
          <span>ログアウト</span>
        </Link>
      </div>
    </nav>
  );
}
