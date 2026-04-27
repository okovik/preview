import type { Theme } from '../types';

type ExportButtonsProps = {
  theme: Theme;
};

const download = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const serializeThemeTxt = (theme: Theme) => {
  const lines: string[] = [];
  lines.push(`${theme.title}`);
  lines.push(`${theme.subtitle}`);
  lines.push(`Mood: ${theme.mood}`);
  lines.push(`Categories: ${theme.categories.join(', ')}`);
  lines.push('');
  lines.push('Visual Prompt:');
  lines.push(theme.visualPrompt);
  lines.push('');
  lines.push('Music Prompt:');
  lines.push(theme.musicPrompt);
  lines.push('');
  lines.push('Negative Visual Prompt:');
  lines.push(theme.negativeVisualPrompt);
  lines.push('');
  lines.push('Negative Music Prompt:');
  lines.push(theme.negativeMusicPrompt);
  lines.push('');
  lines.push('SFX Prompts:');
  theme.sfxPrompts.forEach((item) => lines.push(`- ${item.title}: ${item.prompt} (${item.useCase})`));
  lines.push('');
  lines.push('YouTube Title Ideas:');
  theme.youtubeTitleIdeas.forEach((title) => lines.push(`- ${title}`));
  lines.push('');
  lines.push('Tags:');
  lines.push(theme.tags.join(', '));
  lines.push('');
  lines.push('Production Checklist:');
  theme.productionChecklist.forEach((item) => lines.push(`- ${item}`));
  return lines.join('\n');
};

export default function ExportButtons({ theme }: ExportButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => download(JSON.stringify(theme, null, 2), `${theme.id}.json`, 'application/json')}
        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-100 hover:border-violet-400/60"
      >
        Export Theme as JSON
      </button>
      <button
        type="button"
        onClick={() => download(serializeThemeTxt(theme), `${theme.id}.txt`, 'text/plain')}
        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-100 hover:border-violet-400/60"
      >
        Export Theme as TXT
      </button>
    </div>
  );
}
