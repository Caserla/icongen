export const ICON_SKILL_NAME = "default-icon";
export const ICON_SKILL_VERSION = "0.1.0";

const directions = [
  "Reduce the concept to one memorable central symbol with minimal supporting detail.",
  "Use a bold geometric metaphor and a strong silhouette that remains clear at small sizes.",
  "Explore a friendly, expressive interpretation while keeping the composition disciplined.",
  "Create a refined premium direction with restrained depth and polished material treatment.",
] as const;

export type CompileIconPromptInput = {
  description: string;
  stylePreset?: string;
  slot: 1 | 2 | 3 | 4;
};

export type CompiledIconPrompt = {
  prompt: string;
  skillVersion: string;
  direction: string;
};

export function compileIconPrompt(input: CompileIconPromptInput): CompiledIconPrompt {
  const direction = directions[input.slot - 1];
  const style = input.stylePreset ? `Preferred style: ${input.stylePreset}.` : "Choose a style that best serves the product brief.";

  return {
    skillVersion: ICON_SKILL_VERSION,
    direction,
    prompt: [
      "Create one original app icon concept for a real software product.",
      `Product brief: ${input.description}`,
      style,
      `Visual direction: ${direction}`,
      "Compose a single centered icon, not a grid, mockup, presentation board, phone screen, or collection.",
      "Use a clear silhouette, controlled detail, balanced negative space, and strong recognition at small sizes.",
      "Do not include readable text, letters, watermarks, existing brand marks, or copyrighted characters.",
      "Return a finished square app icon image suitable for product evaluation.",
    ].join("\n"),
  };
}
