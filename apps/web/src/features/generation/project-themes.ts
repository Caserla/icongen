export type ProjectTheme = { primary: string; secondary: string; tertiary: string; neutral: string };
export const PROJECT_THEME_PRESETS: Array<{ id: string; name: string; theme: ProjectTheme }> = [
  { id: "ui-blue", name: "UI Blue", theme: { primary: "#2563EB", secondary: "#38BDF8", tertiary: "#8B5CF6", neutral: "#64748B" } },
  { id: "product-indigo", name: "Product Indigo", theme: { primary: "#4F46E5", secondary: "#818CF8", tertiary: "#22D3EE", neutral: "#6B7280" } },
  { id: "creative-coral", name: "Creative Coral", theme: { primary: "#F43F5E", secondary: "#FB7185", tertiary: "#F59E0B", neutral: "#78716C" } },
  { id: "fresh-mint", name: "Fresh Mint", theme: { primary: "#059669", secondary: "#34D399", tertiary: "#2DD4BF", neutral: "#64748B" } },
  { id: "fintech-navy", name: "Fintech Navy", theme: { primary: "#1D4ED8", secondary: "#0891B2", tertiary: "#10B981", neutral: "#475569" } },
  { id: "warm-orange", name: "Warm Orange", theme: { primary: "#EA580C", secondary: "#FB923C", tertiary: "#EAB308", neutral: "#78716C" } },
  { id: "modern-violet", name: "Modern Violet", theme: { primary: "#7C3AED", secondary: "#A78BFA", tertiary: "#EC4899", neutral: "#71717A" } },
  { id: "health-teal", name: "Health Teal", theme: { primary: "#0F766E", secondary: "#14B8A6", tertiary: "#84CC16", neutral: "#64748B" } },
  { id: "editorial-red", name: "Editorial Red", theme: { primary: "#DC2626", secondary: "#F97316", tertiary: "#FACC15", neutral: "#57534E" } },
  { id: "premium-graphite", name: "Premium Graphite", theme: { primary: "#27272A", secondary: "#52525B", tertiary: "#C084FC", neutral: "#A1A1AA" } },
];
export const DEFAULT_PROJECT_THEME = PROJECT_THEME_PRESETS[0].theme;
export const projectThemeKeys = ["primary", "secondary", "tertiary", "neutral"] as const;
