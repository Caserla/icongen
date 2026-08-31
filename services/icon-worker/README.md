# Icon Generation Worker

Provider-neutral UI icon generation core. It processes 1–20 subjects per job and exactly three variants per subject. Local development is started directly by the Web BFF; production execution is configured separately without adding an assumed queue or cloud vendor.

## Runtime flow

1. Receive a generation job ID from the selected server-side executor.
2. Claim the generation job idempotently.
3. Read ordered subjects and their three pre-created variant slots.
4. Generate only incomplete variants and persist selected PNG sizes.
5. Calculate real progress and final `completed / partial / failed` state.
6. Refund one credit for each subject that does not deliver all three variants.

The OpenAI adapter uses `gpt-image-2` with platform-controlled `IMAGE_QUALITY=high` and `IMAGE_SIZE=2048x2048`. Requested delivery sizes are derived from the generated high-resolution master. The v2 processing path is implemented; use the mock provider for local tests and complete a staging end-to-end run before production acceptance.

## Configure a model

The worker selects its image backend at startup rather than hard-coding it in the generation use case:

```env
IMAGE_PROVIDER=openai
IMAGE_MODEL=gpt-image-2
IMAGE_QUALITY=high
IMAGE_SIZE=2048x2048
IMAGE_PROVIDER_BASE_URL=https://your-sub2api-service.example/v1
IMAGE_PROVIDER_API_KEY=your-bamboo-specific-sub2api-key
```

Local provider testing can use `IMAGE_PROVIDER=mock` without an OpenAI API Key.

The Bamboo test and production topology uses an independently deployed Sub2API service as `IMAGE_PROVIDER_BASE_URL`. The endpoint must implement `POST /v1/images/generations` and return `data[0].b64_json`. Use a Bamboo-specific, revocable and quota-limited gateway key; do not reuse a Sub2API administrator credential.

For Sub2API, a listed model alone is insufficient: an enabled upstream account must whitelist `gpt-image-2` and belong to the Bamboo image group (currently `image-2`). If the provider returns `503 No available compatible accounts`, verify that account-to-group mapping before changing the Worker configuration.

Supported interaction-icon jobs and the `minimal-logo` App-icon preset also derive a sanitized `output.svg` locally with VTracer. Apply Supabase migration `0012_svg_output_assets.sql` before deploying this Worker version. Complex illustrative and 3D presets remain PNG-only.

To add another vendor, implement `ImageProvider` in `src/adapters/` and add one case to `createImageProvider` in `src/registries.ts`. The generation core, credit, storage, and frontend flow do not change.

## Replace the icon skill

Select the built-in skill with:

```env
ICON_SKILL=default-ui-icon
```

A custom skill must implement `PromptCompiler`, declare a stable `name` and `version`, and be registered in `promptCompilerRegistry` in `src/registries.ts`. Unknown provider or skill names fail during worker initialization. The selected provider, model, skill name, and skill version are stored on each job and result for auditability.
