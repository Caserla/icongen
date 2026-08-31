import type {
  CreateGenerationJobInput,
  IconStylePresetId,
} from "@icongen/shared";

export type BackgroundQualityContract =
  | {
      mode: "solid";
      color: string;
      profile: "flat" | "material" | "pixel" | "illustration";
      colorTolerance: number;
      targetTolerance: number;
      minBorderCoverage: number;
      minCanvasCoverage: number;
    }
  | { mode: "gradient"; colors: [string, string]; profile: "neon" };

const SOLID_PALETTES: Partial<
  Record<IconStylePresetId, readonly [string, string, string]>
> = {
  "clay-3d": ["#7C5CE5", "#4BB9A9", "#F29A76"],
  "isometric-3d": ["#3867D6", "#6C5CE7", "#2DAA8A"],
  "pixel-art": ["#243B6B", "#6A3FB5", "#1F6F5B"],
  "low-poly": ["#4568DC", "#6A4C93", "#1B998B"],
  "flat-illustration": ["#F5C95A", "#F28C6B", "#62B6CB"],
  "flat-playful": ["#FFD85A", "#FF8A65", "#A78BFA"],
  "cute-sticker": ["#FFD6E7", "#CDEBFF", "#FFF0B8"],
  "minimal-logo": ["#F4F1EA", "#DDEAFE", "#FBE3D7"],
};

const PROFILE_BY_STYLE: Partial<
  Record<IconStylePresetId, BackgroundQualityContract["profile"]>
> = {
  "clay-3d": "material",
  "isometric-3d": "material",
  "low-poly": "material",
  "cute-sticker": "material",
  "pixel-art": "pixel",
  "flat-illustration": "illustration",
  "flat-playful": "flat",
  "minimal-logo": "flat",
};

const THRESHOLDS = {
  flat: {
    colorTolerance: 28,
    targetTolerance: 96,
    minBorderCoverage: 0.72,
    minCanvasCoverage: 0.28,
  },
  material: {
    colorTolerance: 34,
    targetTolerance: 110,
    minBorderCoverage: 0.66,
    minCanvasCoverage: 0.2,
  },
  pixel: {
    colorTolerance: 24,
    targetTolerance: 88,
    minBorderCoverage: 0.72,
    minCanvasCoverage: 0.24,
  },
  illustration: {
    colorTolerance: 32,
    targetTolerance: 110,
    minBorderCoverage: 0.62,
    minCanvasCoverage: 0.18,
  },
} as const;

const NEON_GRADIENTS = [
  ["#090B2E", "#24104F"],
  ["#071B3A", "#21104A"],
  ["#120A32", "#301054"],
] as const;

export function getBackgroundQualityContract(
  preset: IconStylePresetId,
  slot: 1 | 2 | 3,
): BackgroundQualityContract | undefined {
  if (preset === "neon")
    return {
      mode: "gradient",
      colors: [...NEON_GRADIENTS[slot - 1]],
      profile: "neon",
    };
  const palette = SOLID_PALETTES[preset];
  const profile = PROFILE_BY_STYLE[preset];
  if (!palette || !profile || profile === "neon") return undefined;
  return {
    mode: "solid",
    color: palette[slot - 1],
    profile,
    ...THRESHOLDS[profile],
  };
}

export function getConfiguredBackgroundQualityContract(
  preset: IconStylePresetId,
  background: CreateGenerationJobInput["background"],
  slot: 1 | 2 | 3,
): BackgroundQualityContract | undefined {
  if (!background.enabled) return undefined;
  if (background.autoColor) {
    const fallback = getBackgroundQualityContract(preset, slot);
    if (background.color.mode === "gradient") {
      if (fallback?.mode === "gradient") return fallback;
      const palette = SOLID_PALETTES[preset] ?? [
        "#6750E8",
        "#4BB9A9",
        "#F29A76",
      ];
      return {
        mode: "gradient",
        colors: [palette[slot - 1], palette[slot % palette.length]],
        profile: "neon",
      };
    }
    if (fallback?.mode === "solid") return fallback;
    const color =
      fallback?.mode === "gradient" ? fallback.colors[0] : "#6750E8";
    return { mode: "solid", color, profile: "flat", ...THRESHOLDS.flat };
  }
  if (background.color.mode === "gradient") {
    return {
      mode: "gradient",
      colors: [...background.color.colors],
      profile: "neon",
    };
  }
  const fallback = getBackgroundQualityContract(preset, slot);
  const profile = fallback?.mode === "solid" ? fallback.profile : "flat";
  return {
    mode: "solid",
    color: background.color.color,
    profile,
    ...THRESHOLDS[profile],
  };
}
