export type SfxPrompt = {
  title: string;
  prompt: string;
  useCase: string;
};

export type Theme = {
  id: string;
  title: string;
  subtitle: string;
  categories: string[];
  mood: string;
  colorPalette: string[];
  visualPrompt: string;
  musicPrompt: string;
  negativeVisualPrompt: string;
  negativeMusicPrompt: string;
  sfxPrompts: SfxPrompt[];
  youtubeTitleIdeas: string[];
  youtubeDescriptionTemplate: string;
  tags: string[];
  productionChecklist: string[];
};
