'use client';

import { Section } from '@/content/about';

interface TableOfContentsProps {
  sections: Section[];
}

export default function TableOfContents({ sections }: TableOfContentsProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <nav aria-label="目次" className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">目次</h2>
      <ul className="space-y-2">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              onClick={(e) => handleClick(e, section.id)}
              className="block text-sm text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-md transition-colors"
            >
              {section.title}
            </a>
          </li>
        ))}
        <li>
          <a
            href="#faq"
            onClick={(e) => handleClick(e, 'faq')}
            className="block text-sm text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-md transition-colors"
          >
            よくある質問
          </a>
        </li>
      </ul>
    </nav>
  );
}
