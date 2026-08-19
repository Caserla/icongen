import type { GenerationStatus } from "@icongen/shared";

export type GenerationJobRecord = {
  id: string;
  userId: string;
  description: string;
  stylePreset?: string;
  status: GenerationStatus;
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

export interface GenerationRepository {
  getJob(jobId: string): Promise<GenerationJobRecord | null>;
  markProcessing(jobId: string): Promise<void>;
  saveResult(input: {
    jobId: string;
    slot: number;
    bucket: string;
    objectPath: string;
    prompt: string;
    providerRequestId?: string;
  }): Promise<void>;
  markCompleted(jobId: string): Promise<void>;
  markFailedAndRefund(jobId: string, errorCode: string, errorMessage: string): Promise<void>;
}

export interface ImageProvider {
  generate(input: { prompt: string }): Promise<GeneratedImage>;
}

export interface AssetStore {
  put(input: { jobId: string; slot: number; bytes: Uint8Array; mimeType: string }): Promise<StoredAsset>;
}

export interface PromptCompiler {
  compile(input: { description: string; stylePreset?: string; slot: 1 | 2 | 3 | 4 }): {
    prompt: string;
    skillVersion: string;
  };
}

export interface AppLogger {
  info(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}
