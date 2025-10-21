'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';

export default function SignOutPage() {
  const router = useRouter();

  useEffect(() => {
    // サインアウトしてから /admin-top にリダイレクト
    signOut({ redirect: false }).then(() => {
      router.push('/admin-top');
    });
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 rounded-full border-t-transparent mx-auto mb-4"></div>
        <p className="text-gray-700">ログアウトしています...</p>
      </div>
    </div>
  );
}
