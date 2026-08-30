import type { ColorSetting, CreateGenerationJobInput, GenerationJobStatusV2, IconStyle } from "@icongen/shared";

export type GenerationVariantRecord = { id: string; subjectId: string; slot: 1 | 2 | 3; status: "queued" | "processing" | "completed" | "failed" };
export type GenerationSubjectRecord = { id: string; name: string; description: string; position: number; colorOverride?: ColorSetting; variants: GenerationVariantRecord[] };

export type GenerationJobRecord = {
  id: string;
  userId: string;
  status: GenerationJobStatusV2;
  spec: CreateGenerationJobInput;
  subjects: GenerationSubjectRecord[];
};

export type GeneratedImage = {
  bytes: Uint8Array;
  mimeType: "image/png";
  providerRequestId?: string;
};

export type StoredAsset = {
  bucket: string;
  objectPath: string;
};

export type GenerationAssetRole = "source" | "preview" | "output";
export type GenerationAssetFormat = "png" | "svg";

export interface GenerationRepository {
  getJob(jobId: string): Promise<GenerationJobRecord | null>;
  markProcessing(jobId: string, execution: GenerationExecution): Promise<void>;
  markVariantProcessing(variantId: string): Promise<void>;
  markVariantFailed(input: { variantId: string; errorCode: string; errorMessage: string }): Promise<void>;
  saveAsset(input: {
    jobId: string;
    subjectId: string;
    variantId: string;
    assetRole: GenerationAssetRole;
    format: GenerationAssetFormat;
    size: number;
    width: number;
    height: number;
    hasAlpha: boolean;
    bucket: string;
    objectPath: string;
  }): Promise<void>;
  markVariantCompleted(input: {
    variantId: string;
    prompt: string;
    skillName: string;
    skillVersion: string;
    imageProvider: string;
    imageModel: string;
    providerRequestId?: string;
  }): Promise<void>;
  updateProgress(jobId: string, completedUnits: number, totalUnits: number): Promise<void>;
  markCompleted(jobId: string): Promise<void>;
  markFailedAndRefund(jobId: string, errorCode: string, errorMessage: string): Promise<void>;
}

export interface ImageProvider {
  readonly name: string;
  readonly model: string;
  generate(input: { prompt: string; background?: "transparent" | "opaque" | "auto" }): Promise<GeneratedImage>;
}

export type ProcessedImage = {
  bytes: Uint8Array;
  mimeType: "image/png";
  width: number;
  height: number;
  hasAlpha: boolean;
};

export interface ImageProcessor {
  inspect(input: { bytes: Uint8Array }): Promise<{ width: number; height: number; hasAlpha: boolean }>;
  applyRoundedMask?(input: { bytes: Uint8Array; cornerRadiusPercent: number }): Promise<ProcessedImage>;
  process(input: { bytes: Uint8Array; size: number; profile?: "icon" | "pixel-art" }): Promise<ProcessedImage>;
}

export interface VectorImageProcessor {
  process(input: { bytes: Uint8Array; mode: "binary" | "color" }): Promise<{ bytes: Uint8Array; mimeType: "image/svg+xml"; width: number; height: number }>;
}

export type ImageQualityWarning = { code: "SOURCE_TOO_SMALL" | "SOURCE_NOT_SQUARE" | "APP_ICON_DARK_OUTER_CORNERS" | "FAKE_TRANSPARENCY_CHECKERBOARD" | "NON_UNIFORM_SOLID_BACKGROUND"; message: string };
export type BackgroundQualityContract =
  | { mode: "solid"; color: string; profile: "flat" | "material" | "pixel" | "illustration"; colorTolerance: number; targetTolerance: number; minBorderCoverage: number; minCanvasCoverage: number }
  | { mode: "gradient"; colors: [string, string]; profile: "neon" };

export interface ImageQualityGate {
  inspect(input: { bytes: Uint8Array; purpose?: CreateGenerationJobInput["purpose"]; stylePreset?: IconStyle["preset"]; backgroundContract?: BackgroundQualityContract }): Promise<ImageQualityWarning[]>;
}

export interface AssetStore {
  put(input: { jobId: string; subjectId: string; variantId: string; slot: 1 | 2 | 3; assetRole: GenerationAssetRole; format: GenerationAssetFormat; size: number; bytes: Uint8Array; mimeType: string }): Promise<StoredAsset>;
}

export interface PromptCompiler {
  readonly name: string;
  readonly version: string;
  compile(input: { purpose?: CreateGenerationJobInput["purpose"]; name: string; description: string; color: ColorSetting; background: CreateGenerationJobInput["background"]; style: IconStyle; sizes: number[]; slot: 1 | 2 | 3 }): {
    prompt: string;
    skillVersion: string;
    qualityContract?: BackgroundQualityContract;
    outputBackground?: "transparent" | "opaque";
  };
}

export type GenerationExecution = {
  skillName: string;
  skillVersion: string;
  imageProvider: string;
  imageModel: string;
};

export interface AppLogger {
  info(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}
