'use client';

import Link from 'next/link';
import { sections, timelineItems, credentials, faqs } from '@/content/about';
import TableOfContents from '@/components/about/TableOfContents';
import Timeline from '@/components/about/Timeline';
import FAQAccordion from '@/components/about/FAQAccordion';
import SectionCard from '@/components/about/SectionCard';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* 上部固定ナビ */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/" className="text-xl font-bold text-indigo-600 hover:text-indigo-700">
                英単語クイズアプリ
              </Link>
            </div>
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              ログインへ戻る
            </Link>
          </div>
        </div>
      </nav>

      {/* メインコンテンツ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
          {/* 左サイド：目次（PC表示） */}
          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-24">
              <TableOfContents sections={sections} />
            </div>
          </aside>

          {/* 本文エリア */}
          <main className="lg:col-span-9">
            {/* Hero */}
            <div className="mb-16">
              <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
                このアプリについて
              </h1>
              <p className="text-xl text-slate-600 mb-8">
                塾の英単語テストを、短時間のスマホ学習に置き換えるための学習プラットフォーム
              </p>
              <Link
                href="/"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                ログインへ戻る
              </Link>
            </div>

            {/* セクション表示 */}
            {sections.map((section, index) => {
              // 「安心して使うための仕組み」は特別扱い（強調カード）
              if (section.id === 'privacy') {
                return (
                  <div key={section.id} id={section.id} className="mb-16 scroll-mt-24">
                    <div className="bg-gradient-to-br from-indigo-50 to-cyan-50 border-2 border-indigo-200 rounded-2xl p-8 shadow-lg">
                      <div className="flex items-center gap-3 mb-6">
                        <span className="text-3xl">🛡️</span>
                        <h2 className="text-3xl font-bold text-indigo-900">{section.title}</h2>
                      </div>
                      {section.body.map((paragraph, i) => (
                        <p key={i} className="text-slate-700 leading-relaxed mb-3 last:mb-0">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </div>
                );
              }

              // 開発者セクションの場合、タイムライン・資格を挿入
              if (section.id === 'developer') {
                return (
                  <div key={section.id} id={section.id} className="mb-16 scroll-mt-24">
                    <SectionCard title={section.title} body={section.body} />
                    
                    {/* 経歴タイムライン */}
                    <div className="mt-8">
                      <h3 className="text-xl font-semibold text-slate-800 mb-4">経歴</h3>
                      <Timeline items={timelineItems} />
                    </div>

                    {/* 所有資格 */}
                    <div className="mt-8">
                      <h3 className="text-xl font-semibold text-slate-800 mb-4">所有資格・スコア</h3>
                      <div className="grid gap-4 sm:grid-cols-2">
                        {credentials.map((cat, idx) => (
                          <div key={idx} className="bg-white border border-slate-200 rounded-lg p-4">
                            <h4 className="font-semibold text-slate-700 mb-2">{cat.category}</h4>
                            <ul className="space-y-1 text-sm text-slate-600">
                              {cat.items.map((item, i) => (
                                <li key={i}>
                                  • {item.name}
                                  {item.detail && <span className="text-slate-500"> ({item.detail})</span>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              }

              // 通常セクション
              return (
                <div key={section.id} id={section.id} className="mb-16 scroll-mt-24">
                  <SectionCard title={section.title} body={section.body} />
                </div>
              );
            })}

            {/* FAQ */}
            <div id="faq" className="mb-16 scroll-mt-24">
              <h2 className="text-3xl font-bold text-slate-900 mb-6">よくある質問</h2>
              <FAQAccordion faqs={faqs} />
            </div>

            {/* 下部CTA */}
            <div className="text-center py-12 border-t border-slate-200">
              <p className="text-slate-600 mb-6">準備ができたら、ログインしてクイズに挑戦しましょう</p>
              <Link
                href="/"
                className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                ログイン画面へ
              </Link>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
