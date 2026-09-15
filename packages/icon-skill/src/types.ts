import type { ColorSetting, CreateGenerationJobInput, IconStyle } from "@icongen/shared";

export type CompileIconPromptInput = {
  purpose?: CreateGenerationJobInput["purpose"];
  illustrationSubset?: CreateGenerationJobInput["illustrationSubset"];
  illustrationComposition?: CreateGenerationJobInput["subjects"][number]["illustrationComposition"];
  name: string;
  description: string;
  color: ColorSetting;
  background: CreateGenerationJobInput["background"];
  style: IconStyle;
  sizes: number[];
  slot: 1 | 2 | 3;
  iconSetConsistency?: {
    enabled: boolean;
    subjectCount: number;
    targetOccupancyPercent: number;
    targetStrokeWidthPercent: number;
  };
};
