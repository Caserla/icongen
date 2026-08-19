# Icon Worker

AWS Lambda worker that consumes one generation job from SQS, compiles four independent prompts through `@icongen/icon-skill`, calls the configured image provider, stores PNG files in private Supabase Storage, and updates the job transactionally.

## Runtime flow

1. Parse and validate the versioned SQS message.
2. Claim the generation job idempotently.
3. Generate and persist slots 1–4.
4. Mark the job complete only after four results exist.
5. Return failed SQS items for retry.
6. On the final attempt, mark the job failed and refund credits once.

The OpenAI adapter follows the official Image API pattern for `gpt-image-2`. Output size and transparent-background behavior remain unset until the image-generation product specification is approved.
