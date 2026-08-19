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

## Configure a model

The worker selects its image backend at startup rather than hard-coding it in the generation use case:

```env
IMAGE_PROVIDER=openai
IMAGE_MODEL=gpt-image-2
IMAGE_PROVIDER_API_KEY=your-server-side-key
```

To add another vendor, implement `ImageProvider` in `src/adapters/` and add one case to `createImageProvider` in `src/registries.ts`. The rest of the queue, credit, storage, and frontend flow does not change.

## Replace the icon skill

Select the built-in skill with:

```env
ICON_SKILL=default-icon
```

A custom skill must implement `PromptCompiler`, declare a stable `name` and `version`, and be registered in `promptCompilerRegistry` in `src/registries.ts`. Unknown provider or skill names fail during Lambda initialization. The selected provider, model, skill name, and skill version are stored on each job and result for auditability.
