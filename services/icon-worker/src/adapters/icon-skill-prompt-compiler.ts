import type { PromptCompiler } from "@icongen/backend-core";
import { compileIconPrompt } from "@icongen/icon-skill";

export const iconSkillPromptCompiler: PromptCompiler = {
  compile: compileIconPrompt,
};
