import type { Theme } from '../types';
import Checklist from './Checklist';
import DescriptionRenderer from './DescriptionRenderer';
import ExportButtons from './ExportButtons';
import PromptCard from './PromptCard';

type ThemeViewProps = {
  theme: Theme;
  checklist: Record<string, boolean>;
  onToggleChecklist: (item: string) => void;
  videoTitle: string;
  duration: string;
  language: 'EN' | 'RU';
  onVideoTitleChange: (value: string) => void;
  onDurationChange: (value: string) => void;
  onLanguageChange: (value: 'EN' | 'RU') => void;
};

export default function ThemeView({
  theme,
  checklist,
  onToggleChecklist,
  videoTitle,
  duration,
  language,
  onVideoTitleChange,
  onDurationChange,
  onLanguageChange,
}: ThemeViewProps) {
  const copyAllThemePrompts = async () => {
    const allPrompts = [
      `Visual Prompt:\n${theme.visualPrompt}`,
      `Music Prompt:\n${theme.musicPrompt}`,
      `Negative Visual Prompt:\n${theme.negativeVisualPrompt}`,
      `Negative Music Prompt:\n${theme.negativeMusicPrompt}`,
      ...theme.sfxPrompts.map((item) => `SFX - ${item.title}:\n${item.prompt}`),
      `YouTube Description Template:\n${theme.youtubeDescriptionTemplate}`,
    ].join('\n\n');

    await navigator.clipboard.writeText(allPrompts);
  };

  return (
    <main className="space-y-4">
      <header className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-50">{theme.title}</h1>
            <p className="mt-1 text-sm text-slate-300">{theme.subtitle}</p>
            <p className="mt-2 text-xs text-slate-400">Mood: {theme.mood}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyAllThemePrompts}
              className="rounded-lg border border-violet-500/50 bg-violet-500/20 px-3 py-2 text-xs font-medium text-violet-100"
            >
              Copy All Theme Prompts
            </button>
            <ExportButtons theme={theme} />
          </div>
        </div>
      </header>

      <section className="grid gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4 md:grid-cols-3">
        <label className="text-sm text-slate-300">
          Video title
          <input
            value={videoTitle}
            onChange={(event) => onVideoTitleChange(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          />
        </label>
        <label className="text-sm text-slate-300">
          Duration
          <input
            value={duration}
            onChange={(event) => onDurationChange(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          />
        </label>
        <label className="text-sm text-slate-300">
          Language
          <select
            value={language}
            onChange={(event) => onLanguageChange(event.target.value as 'EN' | 'RU')}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          >
            <option value="EN">EN</option>
            <option value="RU">RU</option>
          </select>
        </label>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <PromptCard title="Visual Prompt" toolLabel="Image" promptText={theme.visualPrompt} />
        <PromptCard title="Music Prompt" toolLabel="Suno" promptText={theme.musicPrompt} />
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-200">SFX Prompts</h3>
        <div className="grid gap-3 lg:grid-cols-3">
          {theme.sfxPrompts.map((item) => (
            <PromptCard
              key={item.title}
              title={`${item.title} (${item.useCase})`}
              toolLabel="SFX"
              promptText={item.prompt}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <PromptCard title="Negative Visual Prompt" toolLabel="Image" promptText={theme.negativeVisualPrompt} />
        <PromptCard title="Negative Music Prompt" toolLabel="Suno" promptText={theme.negativeMusicPrompt} />
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-200">YouTube Title Ideas</h3>
        <div className="grid gap-3 lg:grid-cols-2">
          {theme.youtubeTitleIdeas.map((idea) => (
            <PromptCard key={idea} title="Title Idea" toolLabel="YouTube" promptText={idea} />
          ))}
        </div>
      </section>

      <DescriptionRenderer template={theme.youtubeDescriptionTemplate} videoTitle={videoTitle} duration={duration} language={language} />

      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-200">Tags</h3>
        <div className="flex flex-wrap gap-2">
          {theme.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-200">
              #{tag}
            </span>
          ))}
        </div>
      </section>

      <Checklist items={theme.productionChecklist} checkedMap={checklist} onToggle={onToggleChecklist} />
    </main>
  );
}
