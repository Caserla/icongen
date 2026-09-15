import type {
  GenerationExecution,
  GenerationJobRecord,
  GenerationRepository,
} from "@icongen/backend-core";
import { publicErrorMessage } from "./public-error-message";
import { IncompleteGenerationJobSnapshotError } from "@icongen/backend-core";
import { parseStoredGenerationJobSpec } from "@icongen/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasActiveWorkerLease, type WorkerLeaseRow } from "../worker-runtime";

type JobRow = {
  id: string;
  user_id: string;
  status: GenerationJobRecord["status"];
  generation_spec: unknown;
};
type SubjectRow = {
  id: string;
  name: string;
  description: string;
  position: number;
  color_override: unknown;
};
type VariantRow = {
  id: string;
  subject_id: string;
  slot: 1 | 2 | 3;
  status: "queued" | "processing" | "completed" | "failed";
};
type FailedVariantRow = {
  id: string;
  error_code: string | null;
  error_message: string | null;
};

export class SupabaseGenerationRepository implements GenerationRepository {
  private readonly variantJobIds = new Map<string, string>();

  constructor(
    private readonly client: SupabaseClient,
    private readonly workerId?: string,
  ) {}

  private async assertActiveLease(jobId: string) {
    if (!this.workerId) return;
    const lease = await this.client
      .from("generation_jobs")
      .select("worker_lease_owner,worker_lease_expires_at")
      .eq("id", jobId)
      .maybeSingle<WorkerLeaseRow>();
    if (lease.error) throw new Error(`Failed to verify worker lease: ${lease.error.message}`);
    if (!hasActiveWorkerLease(lease.data, this.workerId)) {
      throw new Error(`WORKER_LEASE_LOST:${jobId}`);
    }
  }

  async getJob(jobId: string): Promise<GenerationJobRecord | null> {
    const jobResult = await this.client
      .from("generation_jobs")
      .select("id,user_id,status,generation_spec")
      .eq("id", jobId)
      .maybeSingle<JobRow>();
    if (jobResult.error)
      throw new Error(
        `Failed to load generation job: ${jobResult.error.message}`,
      );
    if (!jobResult.data) return null;
    const spec = parseStoredGenerationJobSpec(jobResult.data.generation_spec);

    const subjectResult = await this.client
      .from("generation_subjects")
      .select("id,name,description,position,color_override")
      .eq("job_id", jobId)
      .order("position");
    if (subjectResult.error)
      throw new Error(
        `Failed to load generation subjects: ${subjectResult.error.message}`,
      );
    const subjectRows = (subjectResult.data ?? []) as SubjectRow[];
    const subjectIds = subjectRows.map((subject) => subject.id);
    const variantRows: VariantRow[] = [];
    if (subjectIds.length > 0) {
      const variantResult = await this.client
        .from("generation_variants")
        .select("id,subject_id,slot,status")
        .in("subject_id", subjectIds)
        .order("slot");
      if (variantResult.error)
        throw new Error(
          `Failed to load generation variants: ${variantResult.error.message}`,
        );
      variantRows.push(...((variantResult.data ?? []) as VariantRow[]));
      for (const variant of variantRows) this.variantJobIds.set(variant.id, jobId);
    }

    return {
      id: jobResult.data.id,
      userId: jobResult.data.user_id,
      status: jobResult.data.status,
      spec,
      subjects: subjectRows.map((subject) => ({
        id: subject.id,
        name: subject.name,
        description: subject.description,
        position: subject.position,
        colorOverride: subject.color_override
          ? spec.subjects[subject.position]?.colorOverride
          : undefined,
        backgroundOverride: spec.subjects[subject.position]?.backgroundOverride,
        illustrationComposition:
          spec.subjects[subject.position]?.illustrationComposition,
        variants: variantRows
          .filter((variant) => variant.subject_id === subject.id)
          .map((variant) => ({
            id: variant.id,
            subjectId: variant.subject_id,
            slot: variant.slot,
            status: variant.status,
          })),
      })),
    };
  }

  async markProcessing(jobId: string, execution: GenerationExecution) {
    await this.assertActiveLease(jobId);
    const { error } = await this.client.rpc("claim_generation_job", {
      p_job_id: jobId,
      p_skill_name: execution.skillName,
      p_skill_version: execution.skillVersion,
      p_image_provider: execution.imageProvider,
      p_image_model: execution.imageModel,
    });
    if (error)
      throw new Error(`Failed to claim generation job: ${error.message}`);
  }

  async markVariantProcessing(variantId: string) {
    const jobId = await this.jobIdForVariant(variantId);
    await this.assertActiveLease(jobId);
    const { error } = await this.client
      .from("generation_variants")
      .update({ status: "processing", started_at: new Date().toISOString() })
      .eq("id", variantId)
      .in("status", ["queued", "processing"]);
    if (error)
      throw new Error(`Failed to claim generation variant: ${error.message}`);
  }

  async markVariantFailed(input: {
    variantId: string;
    errorCode: string;
    errorMessage: string;
  }) {
    const jobId = await this.jobIdForVariant(input.variantId);
    await this.assertActiveLease(jobId);
    const { error } = await this.client
      .from("generation_variants")
      .update({
        status: "failed",
        error_code: input.errorCode,
        error_message: publicErrorMessage("generation"),
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.variantId)
      .in("status", ["queued", "processing"]);
    if (error)
      throw new Error(
        `Failed to mark generation variant failed: ${error.message}`,
      );
  }

  async saveAsset(input: {
    jobId: string;
    variantId: string;
    assetRole: "source" | "preview" | "output";
    format: "png" | "svg";
    size: number;
    width: number;
    height: number;
    hasAlpha: boolean;
    bucket: string;
    objectPath: string;
  }) {
    await this.assertActiveLease(input.jobId);
    const { error } = await this.client.from("generation_assets").upsert(
      {
        variant_id: input.variantId,
        asset_role: input.assetRole,
        size: input.size,
        width: input.width,
        height: input.height,
        format: input.format,
        mime_type: input.format === "svg" ? "image/svg+xml" : "image/png",
        has_alpha: input.hasAlpha,
        storage_bucket: input.bucket,
        storage_path: input.objectPath,
      },
      { onConflict: "variant_id,asset_role,size,format" },
    );
    if (error)
      throw new Error(`Failed to save generation asset: ${error.message}`);
  }

  async markVariantCompleted(input: {
    variantId: string;
    skillName: string;
    skillVersion: string;
    imageProvider: string;
    imageModel: string;
    providerRequestId?: string;
  }) {
    const jobId = await this.jobIdForVariant(input.variantId);
    await this.assertActiveLease(jobId);
    const { error } = await this.client
      .from("generation_variants")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        skill_name: input.skillName,
        skill_version: input.skillVersion,
        image_provider: input.imageProvider,
        image_model: input.imageModel,
        provider_request_id: input.providerRequestId ?? null,
        error_code: null,
        error_message: null,
      })
      .eq("id", input.variantId);
    if (error)
      throw new Error(
        `Failed to complete generation variant: ${error.message}`,
      );
  }

  async updateProgress(
    jobId: string,
    completedUnits: number,
    totalUnits: number,
  ) {
    await this.assertActiveLease(jobId);
    const progress =
      totalUnits === 0
        ? 0
        : Math.round((completedUnits / totalUnits) * 80) + 10;
    const { error } = await this.client
      .from("generation_jobs")
      .update({
        progress_percent: Math.min(progress, 90),
        progress_phase: "generating",
      })
      .eq("id", jobId);
    if (error)
      throw new Error(`Failed to update generation progress: ${error.message}`);
  }

  async markCompleted(jobId: string) {
    await this.assertActiveLease(jobId);
    const { error } = await this.client.rpc("complete_generation_job_v2", {
      p_job_id: jobId,
    });
    if (error) {
      if (error.message.includes("job contains incomplete subjects"))
        throw new IncompleteGenerationJobSnapshotError(error.message, {
          cause: error,
        });
      throw new Error(`Failed to complete generation job: ${error.message}`);
    }
  }

  async markFailedAndRefund(
    jobId: string,
    errorCode: string,
    _errorMessage: string,
  ) {
    await this.assertActiveLease(jobId);
    const subjects = await this.client
      .from("generation_subjects")
      .select("id")
      .eq("job_id", jobId);
    if (subjects.error)
      throw new Error(
        `Failed to inspect generation subjects before finalization: ${subjects.error.message}`,
      );
    const subjectIds = (subjects.data ?? []).map((subject) => subject.id);
    let failedVariants: FailedVariantRow[] = [];
    if (subjectIds.length > 0) {
      const failed = await this.client
        .from("generation_variants")
        .select("id,error_code,error_message")
        .in("subject_id", subjectIds)
        .eq("status", "failed");
      if (failed.error)
        throw new Error(
          `Failed to preserve generation variant diagnostics: ${failed.error.message}`,
        );
      failedVariants = (failed.data ?? []) as FailedVariantRow[];
    }

    const { error } = await this.client.rpc(
      "finalize_generation_job_v2_failure",
      {
        p_job_id: jobId,
        p_error_code: errorCode,
        p_error_message: publicErrorMessage("generation"),
      },
    );
    if (error)
      throw new Error(`Failed to mark generation job failed: ${error.message}`);

    // Older database functions overwrite every failed variant with the task-level
    // error. Restore the precise per-variant quality/provider diagnostic so local
    // environments remain useful before migration 0013 is deployed.
    for (const variant of failedVariants) {
      const restored = await this.client
        .from("generation_variants")
        .update({
          error_code: variant.error_code,
          error_message: variant.error_message,
        })
        .eq("id", variant.id)
        .eq("status", "failed");
      if (restored.error)
        throw new Error(
          `Failed to restore generation variant diagnostic: ${restored.error.message}`,
        );
    }

    // Keep local and not-yet-migrated environments consistent: any delivered
    // variant makes this a partial result, never a wholly failed job.
    if (subjectIds.length === 0) return;
    const completed = await this.client
      .from("generation_variants")
      .select("id", { count: "exact", head: true })
      .in("subject_id", subjectIds)
      .eq("status", "completed");
    if (completed.error)
      throw new Error(
        `Failed to inspect finalized generation variants: ${completed.error.message}`,
      );
    if ((completed.count ?? 0) > 0) {
      const partial = await this.client
        .from("generation_jobs")
        .update({ status: "partial" })
        .eq("id", jobId)
        .eq("status", "failed");
      if (partial.error)
        throw new Error(
          `Failed to mark generation job partial: ${partial.error.message}`,
        );
    }
  }

  private async jobIdForVariant(variantId: string) {
    const jobId = this.variantJobIds.get(variantId);
    if (!jobId) throw new Error(`Generation variant ${variantId} has no owning job`);
    return jobId;
  }
}
