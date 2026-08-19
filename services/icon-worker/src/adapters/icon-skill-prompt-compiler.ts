import type { PromptCompiler } from "@icongen/backend-core";
import { compileIconPrompt, ICON_SKILL_NAME, ICON_SKILL_VERSION } from "@icongen/icon-skill";

export const iconSkillPromptCompiler: PromptCompiler = {
  name: ICON_SKILL_NAME,
  version: ICON_SKILL_VERSION,
  compile: compileIconPrompt,
};
