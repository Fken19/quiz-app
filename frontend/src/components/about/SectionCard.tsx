interface SectionCardProps {
  title: string;
  body: string[];
}

export default function SectionCard({ title, body }: SectionCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 shadow-sm">
      <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6">{title}</h2>
      <div className="space-y-4">
        {body.map((paragraph, index) => (
          <p key={index} className="text-slate-700 leading-relaxed">
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  );
}
