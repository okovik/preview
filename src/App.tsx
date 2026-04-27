import { useEffect, useMemo, useState } from 'react';
import FilterBar from './components/FilterBar';
import Sidebar from './components/Sidebar';
import ThemeView from './components/ThemeView';
import { allCategories, themes } from './data/themes';

const checklistStorageKey = (themeId: string) => `ambient-forge-checklist-${themeId}`;
const fieldStorageKey = (themeId: string) => `ambient-forge-fields-${themeId}`;

type ThemeFields = {
  videoTitle: string;
  duration: string;
  language: 'EN' | 'RU';
};

const defaultFields: ThemeFields = {
  videoTitle: '',
  duration: '1 hour',
  language: 'EN',
};

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedThemeId, setSelectedThemeId] = useState(themes[0].id);
  const [checklistState, setChecklistState] = useState<Record<string, boolean>>({});
  const [fields, setFields] = useState<ThemeFields>(defaultFields);

  const filteredThemes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return themes.filter((theme) => {
      const byCategory = activeCategory === 'All' || theme.categories.includes(activeCategory);
      const haystack = [
        theme.title,
        theme.subtitle,
        theme.mood,
        ...theme.categories,
        theme.visualPrompt,
        theme.musicPrompt,
        theme.negativeVisualPrompt,
        theme.negativeMusicPrompt,
        ...theme.sfxPrompts.map((item) => item.prompt),
      ]
        .join(' ')
        .toLowerCase();
      const bySearch = query.length === 0 || haystack.includes(query);
      return byCategory && bySearch;
    });
  }, [activeCategory, searchQuery]);

  useEffect(() => {
    if (!filteredThemes.some((theme) => theme.id === selectedThemeId) && filteredThemes.length > 0) {
      setSelectedThemeId(filteredThemes[0].id);
    }
  }, [filteredThemes, selectedThemeId]);

  const selectedTheme = useMemo(
    () => filteredThemes.find((theme) => theme.id === selectedThemeId) ?? filteredThemes[0],
    [filteredThemes, selectedThemeId],
  );

  useEffect(() => {
    if (!selectedTheme) {
      return;
    }
    const checklistRaw = localStorage.getItem(checklistStorageKey(selectedTheme.id));
    setChecklistState(checklistRaw ? (JSON.parse(checklistRaw) as Record<string, boolean>) : {});

    const fieldsRaw = localStorage.getItem(fieldStorageKey(selectedTheme.id));
    setFields(fieldsRaw ? (JSON.parse(fieldsRaw) as ThemeFields) : defaultFields);
  }, [selectedTheme?.id]);

  const handleChecklistToggle = (item: string) => {
    if (!selectedTheme) return;
    setChecklistState((previous) => {
      const next = { ...previous, [item]: !previous[item] };
      localStorage.setItem(checklistStorageKey(selectedTheme.id), JSON.stringify(next));
      return next;
    });
  };

  const updateFields = (next: ThemeFields) => {
    if (!selectedTheme) return;
    setFields(next);
    localStorage.setItem(fieldStorageKey(selectedTheme.id), JSON.stringify(next));
  };

  if (!selectedTheme) {
    return <div className="p-6 text-slate-100">No themes match this search/filter combination.</div>;
  }

  return (
    <div className="min-h-screen bg-abyss bg-forge-gradient px-4 py-4 text-slate-100 md:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[280px_1fr]">
        <Sidebar themes={filteredThemes} selectedId={selectedTheme.id} onSelect={setSelectedThemeId} />
        <div className="space-y-4">
          <FilterBar
            search={searchQuery}
            onSearchChange={setSearchQuery}
            categories={allCategories}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />
          <ThemeView
            theme={selectedTheme}
            checklist={checklistState}
            onToggleChecklist={handleChecklistToggle}
            videoTitle={fields.videoTitle}
            duration={fields.duration}
            language={fields.language}
            onVideoTitleChange={(value) => updateFields({ ...fields, videoTitle: value })}
            onDurationChange={(value) => updateFields({ ...fields, duration: value })}
            onLanguageChange={(value) => updateFields({ ...fields, language: value })}
          />
        </div>
      </div>
    </div>
  );
}
