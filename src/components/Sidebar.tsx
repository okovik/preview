import type { Theme } from '../types';

type SidebarProps = {
  themes: Theme[];
  selectedId: string;
  onSelect: (id: string) => void;
};

export default function Sidebar({ themes, selectedId, onSelect }: SidebarProps) {
  return (
    <aside className="h-full rounded-2xl border border-white/10 bg-slate-900/65 p-4">
      <h2 className="mb-4 text-lg font-semibold text-slate-100">Themes</h2>
      <ul className="space-y-2">
        {themes.map((theme) => {
          const active = selectedId === theme.id;
          return (
            <li key={theme.id}>
              <button
                type="button"
                onClick={() => onSelect(theme.id)}
                className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                  active
                    ? 'border-violet-400/50 bg-violet-500/15 text-violet-100'
                    : 'border-white/10 bg-slate-800/50 text-slate-200 hover:border-slate-500'
                }`}
              >
                <p className="text-sm font-medium">{theme.title}</p>
                <p className="mt-1 text-xs text-slate-400">{theme.mood}</p>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
