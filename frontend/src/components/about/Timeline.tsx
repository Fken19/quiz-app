'use client';

import { TimelineItem } from '@/content/about';

interface TimelineProps {
  items: TimelineItem[];
}

const typeColors = {
  '塾': 'bg-blue-100 text-blue-800 border-blue-300',
  '学歴': 'bg-green-100 text-green-800 border-green-300',
  '研究': 'bg-purple-100 text-purple-800 border-purple-300',
  'その他': 'bg-gray-100 text-gray-800 border-gray-300',
};

export default function Timeline({ items }: TimelineProps) {
  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={index} className="flex gap-4">
          <div className="flex-shrink-0 w-24 text-sm font-medium text-slate-600">
            {item.date}
          </div>
          <div className="flex-1 bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`inline-block px-2 py-1 text-xs font-medium rounded border ${
                  typeColors[item.type]
                }`}
              >
                {item.type}
              </span>
            </div>
            <p className="text-sm text-slate-700">{item.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
