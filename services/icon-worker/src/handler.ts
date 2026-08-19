import type { SQSBatchResponse, SQSEvent } from "aws-lambda";
import { processGenerationJob } from "@icongen/backend-core";
import { generationQueueMessageSchema } from "@icongen/shared";
import { loadConfig } from "./config";
import { createDependencies } from "./dependencies";

const config = loadConfig();
const dependencies = createDependencies(config);

export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const batchItemFailures: SQSBatchResponse["batchItemFailures"] = [];

  for (const record of event.Records) {
    try {
      const message = generationQueueMessageSchema.parse(JSON.parse(record.body));
      await processGenerationJob(message.jobId, dependencies);
    } catch (error) {
      const attempts = Number(record.attributes.ApproximateReceiveCount ?? "1");
      const message = error instanceof Error ? error.message : "Unknown generation error";
      dependencies.logger.error("Generation job attempt failed", {
        messageId: record.messageId,
        attempts,
        error: message,
      });

      if (attempts >= config.GENERATION_MAX_ATTEMPTS) {
        const parsed = generationQueueMessageSchema.safeParse(safeJson(record.body));
        if (parsed.success) {
          await dependencies.repository.markFailedAndRefund(parsed.data.jobId, "GENERATION_FAILED", message);
        }
      } else {
        batchItemFailures.push({ itemIdentifier: record.messageId });
      }
    }
  }

  return { batchItemFailures };
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
