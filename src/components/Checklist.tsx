type ChecklistProps = {
  items: string[];
  checkedMap: Record<string, boolean>;
  onToggle: (item: string) => void;
};

export default function Checklist({ items, checkedMap, onToggle }: ChecklistProps) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-200">Production Checklist</h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item}>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-800 bg-slate-950/50 p-2 text-sm text-slate-200">
              <input type="checkbox" checked={Boolean(checkedMap[item])} onChange={() => onToggle(item)} className="mt-1" />
              <span>{item}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
