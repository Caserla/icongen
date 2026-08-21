# Icon Worker

AWS Lambda worker for asynchronous UI icon generation. It processes 1–20 subjects per job and exactly three variants per subject.

## Runtime flow

1. Parse and validate the v2 SQS message.
2. Claim the generation job idempotently.
3. Read ordered subjects and their three pre-created variant slots.
4. Generate only incomplete variants and persist selected PNG sizes.
5. Calculate real progress and final `completed / partial / failed` state.
6. Refund one credit for each subject that does not deliver all three variants.

The OpenAI adapter uses `gpt-image-2` with platform-controlled `IMAGE_QUALITY=medium`. Background and selected output sizes come from the validated generation specification. The v2 processing path is implemented; use the mock provider for local tests and complete a staging end-to-end run before production acceptance.

## Configure a model

The worker selects its image backend at startup rather than hard-coding it in the generation use case:

```env
IMAGE_PROVIDER=openai
IMAGE_MODEL=gpt-image-2
IMAGE_QUALITY=medium
IMAGE_PROVIDER_API_KEY=your-server-side-key
```

Local provider testing can use `IMAGE_PROVIDER=mock` without an OpenAI API Key.

To add another vendor, implement `ImageProvider` in `src/adapters/` and add one case to `createImageProvider` in `src/registries.ts`. The rest of the queue, credit, storage, and frontend flow does not change.

## Replace the icon skill

Select the built-in skill with:

```env
ICON_SKILL=default-ui-icon
```

A custom skill must implement `PromptCompiler`, declare a stable `name` and `version`, and be registered in `promptCompilerRegistry` in `src/registries.ts`. Unknown provider or skill names fail during Lambda initialization. The selected provider, model, skill name, and skill version are stored on each job and result for auditability.
