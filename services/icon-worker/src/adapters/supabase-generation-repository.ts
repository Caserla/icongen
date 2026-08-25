import type { GenerationExecution, GenerationJobRecord, GenerationRepository } from "@icongen/backend-core";
import { parseStoredGenerationJobSpec } from "@icongen/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

type JobRow = { id: string; user_id: string; status: GenerationJobRecord["status"]; generation_spec: unknown };
type SubjectRow = { id: string; name: string; description: string; position: number; color_override: unknown };
type VariantRow = { id: string; subject_id: string; slot: 1 | 2 | 3; status: "queued" | "processing" | "completed" | "failed" };

export class SupabaseGenerationRepository implements GenerationRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getJob(jobId: string): Promise<GenerationJobRecord | null> {
    const jobResult = await this.client.from("generation_jobs").select("id,user_id,status,generation_spec").eq("id", jobId).maybeSingle<JobRow>();
    if (jobResult.error) throw new Error(`Failed to load generation job: ${jobResult.error.message}`);
    if (!jobResult.data) return null;
    const spec = parseStoredGenerationJobSpec(jobResult.data.generation_spec);

    const subjectResult = await this.client.from("generation_subjects").select("id,name,description,position,color_override").eq("job_id", jobId).order("position");
    if (subjectResult.error) throw new Error(`Failed to load generation subjects: ${subjectResult.error.message}`);
    const subjectRows = (subjectResult.data ?? []) as SubjectRow[];
    const subjectIds = subjectRows.map((subject) => subject.id);
    const variantRows: VariantRow[] = [];
    if (subjectIds.length > 0) {
      const variantResult = await this.client.from("generation_variants").select("id,subject_id,slot,status").in("subject_id", subjectIds).order("slot");
      if (variantResult.error) throw new Error(`Failed to load generation variants: ${variantResult.error.message}`);
      variantRows.push(...((variantResult.data ?? []) as VariantRow[]));
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
        colorOverride: subject.color_override ? spec.subjects[subject.position]?.colorOverride : undefined,
        variants: variantRows.filter((variant) => variant.subject_id === subject.id).map((variant) => ({
          id: variant.id, subjectId: variant.subject_id, slot: variant.slot, status: variant.status,
        })),
      })),
    };
  }

  async markProcessing(jobId: string, execution: GenerationExecution) {
    const { error } = await this.client.rpc("claim_generation_job", {
      p_job_id: jobId, p_skill_name: execution.skillName, p_skill_version: execution.skillVersion,
      p_image_provider: execution.imageProvider, p_image_model: execution.imageModel,
    });
    if (error) throw new Error(`Failed to claim generation job: ${error.message}`);
  }

  async markVariantProcessing(variantId: string) {
    const { error } = await this.client.from("generation_variants").update({ status: "processing", started_at: new Date().toISOString() }).eq("id", variantId).in("status", ["queued", "processing"]);
    if (error) throw new Error(`Failed to claim generation variant: ${error.message}`);
  }

  async saveAsset(input: { variantId: string; assetRole: "source" | "preview" | "output"; size: number; width: number; height: number; hasAlpha: boolean; bucket: string; objectPath: string }) {
    const { error } = await this.client.from("generation_assets").upsert({
      variant_id: input.variantId, asset_role: input.assetRole, size: input.size, width: input.width, height: input.height,
      has_alpha: input.hasAlpha, storage_bucket: input.bucket, storage_path: input.objectPath,
    }, { onConflict: "variant_id,asset_role,size" });
    if (error) throw new Error(`Failed to save generation asset: ${error.message}`);
  }

  async markVariantCompleted(input: { variantId: string; prompt: string; skillName: string; skillVersion: string; imageProvider: string; imageModel: string; providerRequestId?: string }) {
    const { error } = await this.client.from("generation_variants").update({
      status: "completed", completed_at: new Date().toISOString(), prompt: input.prompt,
      skill_name: input.skillName, skill_version: input.skillVersion, image_provider: input.imageProvider,
      image_model: input.imageModel, provider_request_id: input.providerRequestId ?? null,
      error_code: null, error_message: null,
    }).eq("id", input.variantId);
    if (error) throw new Error(`Failed to complete generation variant: ${error.message}`);
  }

  async updateProgress(jobId: string, completedUnits: number, totalUnits: number) {
    const progress = totalUnits === 0 ? 0 : Math.round((completedUnits / totalUnits) * 80) + 10;
    const { error } = await this.client.from("generation_jobs").update({ progress_percent: Math.min(progress, 90), progress_phase: "generating" }).eq("id", jobId);
    if (error) throw new Error(`Failed to update generation progress: ${error.message}`);
  }

  async markCompleted(jobId: string) {
    const { error } = await this.client.rpc("complete_generation_job_v2", { p_job_id: jobId });
    if (error) throw new Error(`Failed to complete generation job: ${error.message}`);
  }

  async markFailedAndRefund(jobId: string, errorCode: string, errorMessage: string) {
    const { error } = await this.client.rpc("finalize_generation_job_v2_failure", { p_job_id: jobId, p_error_code: errorCode, p_error_message: errorMessage.slice(0, 1000) });
    if (error) throw new Error(`Failed to mark generation job failed: ${error.message}`);

    // Keep local and not-yet-migrated environments consistent: any delivered
    // variant makes this a partial result, never a wholly failed job.
    const subjects = await this.client.from("generation_subjects").select("id").eq("job_id", jobId);
    if (subjects.error) throw new Error(`Failed to inspect finalized generation subjects: ${subjects.error.message}`);
    const subjectIds = (subjects.data ?? []).map((subject) => subject.id);
    if (subjectIds.length === 0) return;
    const completed = await this.client.from("generation_variants").select("id", { count: "exact", head: true }).in("subject_id", subjectIds).eq("status", "completed");
    if (completed.error) throw new Error(`Failed to inspect finalized generation variants: ${completed.error.message}`);
    if ((completed.count ?? 0) > 0) {
      const partial = await this.client.from("generation_jobs").update({ status: "partial" }).eq("id", jobId).eq("status", "failed");
      if (partial.error) throw new Error(`Failed to mark generation job partial: ${partial.error.message}`);
    }
  }
}
