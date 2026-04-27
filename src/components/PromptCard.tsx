type PromptCardProps = {
  title: string;
  toolLabel: 'Image' | 'Suno' | 'SFX' | 'YouTube';
  promptText: string;
};

const toolStyles: Record<PromptCardProps['toolLabel'], string> = {
  Image: 'bg-indigo-500/20 text-indigo-200 border-indigo-400/30',
  Suno: 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/30',
  SFX: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/30',
  YouTube: 'bg-rose-500/20 text-rose-200 border-rose-400/30',
};

export default function PromptCard({ title, toolLabel, promptText }: PromptCardProps) {
  const handleCopy = async () => {
    await navigator.clipboard.writeText(promptText);
  };

  return (
    <article className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-glow">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-100">{title}</h3>
        <span className={`rounded-full border px-2 py-1 text-xs font-medium ${toolStyles[toolLabel]}`}>{toolLabel}</span>
      </div>
      <p className="mb-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-200/90">{promptText}</p>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{promptText.length} chars</span>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 font-medium text-slate-100 transition hover:border-violet-400/60 hover:bg-slate-700"
        >
          Copy
        </button>
      </div>
    </article>
  );
}
