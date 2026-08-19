import type { GenerationExecution, GenerationJobRecord, GenerationRepository } from "@icongen/backend-core";
import type { SupabaseClient } from "@supabase/supabase-js";

type JobRow = {
  id: string;
  user_id: string;
  description: string;
  style_preset: string | null;
  status: GenerationJobRecord["status"];
};

export class SupabaseGenerationRepository implements GenerationRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getJob(jobId: string): Promise<GenerationJobRecord | null> {
    const { data, error } = await this.client
      .from("generation_jobs")
      .select("id,user_id,description,style_preset,status")
      .eq("id", jobId)
      .maybeSingle<JobRow>();
    if (error) throw new Error(`Failed to load generation job: ${error.message}`);
    if (!data) return null;
    return {
      id: data.id,
      userId: data.user_id,
      description: data.description,
      stylePreset: data.style_preset ?? undefined,
      status: data.status,
    };
  }

  async markProcessing(jobId: string, execution: GenerationExecution) {
    const { error } = await this.client.rpc("claim_generation_job", {
      p_job_id: jobId,
      p_skill_name: execution.skillName,
      p_skill_version: execution.skillVersion,
      p_image_provider: execution.imageProvider,
      p_image_model: execution.imageModel,
    });
    if (error) throw new Error(`Failed to claim generation job: ${error.message}`);
  }

  async saveResult(input: {
    jobId: string;
    slot: number;
    bucket: string;
    objectPath: string;
    prompt: string;
    skillName: string;
    skillVersion: string;
    imageProvider: string;
    imageModel: string;
    providerRequestId?: string;
  }) {
    const { error } = await this.client.from("generation_results").upsert(
      {
        job_id: input.jobId,
        slot: input.slot,
        storage_bucket: input.bucket,
        storage_path: input.objectPath,
        prompt: input.prompt,
        skill_name: input.skillName,
        skill_version: input.skillVersion,
        image_provider: input.imageProvider,
        image_model: input.imageModel,
        provider_request_id: input.providerRequestId ?? null,
      },
      { onConflict: "job_id,slot" },
    );
    if (error) throw new Error(`Failed to save generation result: ${error.message}`);
  }

  async markCompleted(jobId: string) {
    const { error } = await this.client.rpc("complete_generation_job", { p_job_id: jobId });
    if (error) throw new Error(`Failed to complete generation job: ${error.message}`);
  }

  async markFailedAndRefund(jobId: string, errorCode: string, errorMessage: string) {
    const { error } = await this.client.rpc("fail_generation_job_and_refund", {
      p_job_id: jobId,
      p_error_code: errorCode,
      p_error_message: errorMessage.slice(0, 1000),
    });
    if (error) throw new Error(`Failed to mark generation job failed: ${error.message}`);
  }
}
