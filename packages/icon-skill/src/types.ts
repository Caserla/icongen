import type { ColorSetting, CreateGenerationJobInput, IconStyle } from "@icongen/shared";

export type CompileIconPromptInput = {
  purpose?: CreateGenerationJobInput["purpose"];
  name: string;
  description: string;
  color: ColorSetting;
  background: CreateGenerationJobInput["background"];
  style: IconStyle;
  sizes: number[];
  slot: 1 | 2 | 3;
};
