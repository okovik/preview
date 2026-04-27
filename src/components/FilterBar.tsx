type FilterBarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  categories: string[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
};

export default function FilterBar({
  search,
  onSearchChange,
  categories,
  activeCategory,
  onCategoryChange,
}: FilterBarProps) {
  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/65 p-4">
      <input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search title, category, mood, prompt text..."
        className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm text-slate-100 outline-none ring-violet-400/50 placeholder:text-slate-500 focus:ring-2"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onCategoryChange('All')}
          className={`rounded-full border px-3 py-1 text-xs ${
            activeCategory === 'All'
              ? 'border-violet-400/60 bg-violet-500/20 text-violet-100'
              : 'border-slate-700 bg-slate-800 text-slate-300'
          }`}
        >
          All
        </button>
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => onCategoryChange(category)}
            className={`rounded-full border px-3 py-1 text-xs ${
              activeCategory === category
                ? 'border-violet-400/60 bg-violet-500/20 text-violet-100'
                : 'border-slate-700 bg-slate-800 text-slate-300'
            }`}
          >
            {category}
          </button>
        ))}
      </div>
    </div>
  );
}
