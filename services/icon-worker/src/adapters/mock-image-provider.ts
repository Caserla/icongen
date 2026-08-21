import type { ImageProvider } from "@icongen/backend-core";

// Valid 1×1 transparent PNG. The mock keeps local flows deterministic and never calls a paid API.
const TRANSPARENT_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Av7tAAAAAElFTkSuQmCC";

export class MockImageProvider implements ImageProvider {
  readonly name = "mock";
  readonly model = "mock-transparent-png-v1";

  async generate() {
    return {
      bytes: Buffer.from(TRANSPARENT_PNG, "base64"),
      mimeType: "image/png" as const,
      providerRequestId: `mock-${crypto.randomUUID()}`,
    };
  }
}
