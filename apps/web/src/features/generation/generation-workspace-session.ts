import { isLibraryGenerationStyle, type LibraryGenerationStyle } from "./library-generation-styles";

export const GENERATION_WORKSPACE_SESSION_KEY = process.env.NEXT_PUBLIC_EASY_ICON_LOCAL_MODE === "true" ? "icongen:local-generation-workspace:v1" : "icongen:generation-workspace:v1";

export type GenerationWorkspaceSession = {
  projectId: string;
  projectName: string;
  mainStyleId: LibraryGenerationStyle;
};

export function parseGenerationWorkspaceSession(raw: string | null): GenerationWorkspaceSession | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const saved = value as Partial<GenerationWorkspaceSession>;
    const mainStyleId = typeof saved.mainStyleId === "string" && isLibraryGenerationStyle(saved.mainStyleId) ? saved.mainStyleId : "linear";
    // Keep the existing storage key and selected project/style, but deliberately
    // discard the retired secondary selection from older two-style sessions.
    return {
      projectId: typeof saved.projectId === "string" ? saved.projectId : "",
      projectName: typeof saved.projectName === "string" ? saved.projectName : "",
      mainStyleId,
    };
  } catch {
    return null;
  }
}
