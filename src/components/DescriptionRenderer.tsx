type DescriptionRendererProps = {
  template: string;
  videoTitle: string;
  duration: string;
  language: 'EN' | 'RU';
};

const replaceTokens = (template: string, fields: { videoTitle: string; duration: string; language: 'EN' | 'RU' }) =>
  template
    .replaceAll('{videoTitle}', fields.videoTitle || 'Untitled Ambient Session')
    .replaceAll('{duration}', fields.duration || '1 hour')
    .replaceAll('{language}', fields.language);

export default function DescriptionRenderer({ template, videoTitle, duration, language }: DescriptionRendererProps) {
  const result = replaceTokens(template, { videoTitle, duration, language });

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-200">YouTube Description</h3>
      <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-200/90">{result}</p>
      <button
        type="button"
        onClick={() => navigator.clipboard.writeText(result)}
        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-100 hover:border-violet-400/60"
      >
        Copy Description
      </button>
    </section>
  );
}
