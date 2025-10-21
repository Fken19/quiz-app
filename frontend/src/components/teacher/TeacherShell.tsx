'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import TeacherNavigation from './TeacherNavigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import { apiGet } from '@/lib/api-utils';
import type { ApiUser } from '@/types/quiz';

interface TeacherShellProps {
  children: React.ReactNode;
}

export default function TeacherShell({ children }: TeacherShellProps) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const PUBLIC_PATHS = new Set(['/teacher', '/teacher/top', '/teacher/login', '/teacher/access-denied']);
  const isPublicPath = pathname ? PUBLIC_PATHS.has(pathname) : false;

  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(!isPublicPath);

  useEffect(() => {
    if (isPublicPath) {
      setLoading(false);
      return;
    }

    const ensureAccess = async () => {
      try {
        const user = (await apiGet('/api/users/me/')) as ApiUser;
        setCurrentUser(user);
        
        // 講師権限のホワイトリストチェック
        // バックエンドで厳密にチェックされるが、フロントエンドでも事前確認
        try {
          // 講師APIエンドポイントにアクセスしてホワイトリスト登録を確認
          await apiGet('/api/teachers/');
        } catch (teacherErr: any) {
          // ApiErrorのstatusプロパティをチェック
          if (teacherErr?.status === 403) {
            // ホワイトリスト未登録
            console.warn(
              `Whitelist check failed for ${user.email}: not registered`,
              teacherErr
            );
            router.replace('/teacher/access-denied');
            return;
          }
          // その他のエラーは無視（講師APIエンドポイントの問題かもしれない）
          console.error('Teacher API check error:', teacherErr);
        }
      } catch (err: any) {
        console.error('failed to load current user', err);
        
        // ApiErrorのstatusプロパティをチェック
        if (err?.status === 403) {
          router.replace('/teacher/access-denied');
        } else if (err?.status === 401) {
          // 認証エラーはログインへ
          router.replace('/auth/signin?callbackUrl=/teacher/dashboard');
        } else {
          // その他のエラーもログインへ
          router.replace('/auth/signin?callbackUrl=/teacher/dashboard');
        }
      } finally {
        setLoading(false);
      }
    };

    if (status === 'authenticated') {
      ensureAccess();
    }
    if (status === 'unauthenticated') {
      router.replace('/auth/signin?callbackUrl=/teacher/dashboard');
    }
  }, [status, router, isPublicPath]);

  if (isPublicPath) {
    return <>{children}</>;
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <TeacherNavigation />
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
