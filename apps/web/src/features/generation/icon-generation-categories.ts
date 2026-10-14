import { LIBRARY_GENERATION_LABELS, LIBRARY_GENERATION_STYLES, libraryStylePreview } from "./library-generation-styles";

export type IconGenerationCategory = {
  id: string;
  icon: string;
  label: { en: string; zh: string };
  children: Array<{ id: string; label: { en: string; zh: string } }>;
};

// Preserve the category/child shape for existing callers, but present six
// direct choices rather than the former 46-style subcategory hierarchy.
export const ICON_GENERATION_CATEGORIES: IconGenerationCategory[] = LIBRARY_GENERATION_STYLES.map(id => ({
  id,
  icon: libraryStylePreview(id),
  label: LIBRARY_GENERATION_LABELS[id],
  children: [{ id, label: LIBRARY_GENERATION_LABELS[id] }],
}));
