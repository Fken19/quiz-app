'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiGet } from '@/lib/api-utils';

interface TeacherPublicProfile {
  teacher_id: string;
  display_name: string;
  affiliation?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  updated_at: string;
}

export default function StudentTeacherProfilePage() {
  const params = useParams<{ linkId: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<TeacherPublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const linkId = params?.linkId;
    if (!linkId) return;
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiGet<TeacherPublicProfile>(`/api/student-teacher-links/${linkId}/teacher-profile/`);
        setProfile(data);
      } catch (err) {
        console.error(err);
        setError('講師プロフィールを取得できませんでした。');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [params?.linkId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-xl mx-auto py-10 px-4 text-center space-y-4">
        <p className="text-slate-600">{error || '講師が見つかりませんでした。'}</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-indigo-600 font-semibold hover:underline"
        >
          ← プロフィールに戻る
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center gap-2 text-sm text-indigo-700 font-semibold">
        <Link href="/student/profile" className="hover:underline">
          ← プロフィールに戻る
        </Link>
      </div>

      <section className="bg-white shadow rounded-3xl p-6 text-center space-y-4">
        <div className="flex flex-col items-center gap-4">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={`${profile.display_name}のアイコン`}
              className="w-24 h-24 rounded-full object-cover border border-slate-200"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center text-3xl text-slate-500">
              👩‍🏫
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{profile.display_name}</h1>
            {profile.affiliation ? (
              <p className="text-sm text-slate-600 mt-1">{profile.affiliation}</p>
            ) : (
              <p className="text-sm text-slate-400 mt-1">所属情報は未設定です</p>
            )}
          </div>
        </div>
      </section>

      <section className="bg-white shadow rounded-2xl p-5 space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">自己紹介</h2>
        <p className="text-slate-700 whitespace-pre-wrap">
          {profile.bio || 'この講師は自己紹介をまだ設定していません。'}
        </p>
        <p className="text-xs text-slate-500 text-right">
          最終更新: {new Date(profile.updated_at).toLocaleString('ja-JP')}
        </p>
      </section>
    </div>
  );
}
