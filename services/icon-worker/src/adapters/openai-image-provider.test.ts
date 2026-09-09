import assert from "node:assert/strict";
import { createServer, type IncomingHttpHeaders } from "node:http";
import test from "node:test";
import sharp from "sharp";
import { ICON_STYLE_PRESET_IDS } from "@icongen/shared";
import { iconSkillPromptCompiler } from "./icon-skill-prompt-compiler";
import {
  buildOpenAIImagePrompt,
  OpenAIImageProvider,
  prepareTransparentEditInput,
  resolveTransparencyStrategy,
} from "./openai-image-provider";

const png = {
  bytes: new Uint8Array([137, 80, 78, 71]),
  mimeType: "image/png" as const,
  filename: "image.png",
};

type CapturedImageRequest = {
  method: string | undefined;
  path: string | undefined;
  headers: IncomingHttpHeaders;
  body: Buffer;
};

async function withImageApiMock(
  run: (provider: OpenAIImageProvider, requests: CapturedImageRequest[]) => Promise<void>,
) {
  const requests: CapturedImageRequest[] = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    requests.push({
      method: request.method, path: request.url, headers: request.headers,
      body: Buffer.concat(chunks),
    });
    response.writeHead(200, { "content-type": "application/json", "x-request-id": "local-route-test" });
    response.end(JSON.stringify({
      created: 0,
      data: [{ b64_json: Buffer.from(png.bytes).toString("base64") }],
    }));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const provider = new OpenAIImageProvider(
      "local-test-key", "gpt-image-2", "high", "2048x2048",
      `http://127.0.0.1:${address.port}/v1`, 5_000, 0,
    );
    await run(provider, requests);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("new generation and retry always send JSON to images/generations, never image edits", async () => {
  await withImageApiMock(async (provider, requests) => {
    for (const background of ["transparent", "opaque", "auto"] as const) {
      for (const retry of [false, true]) {
        const subject = `FOLD coffee kiosk${retry ? "\nRetry: preserve all structural surfaces." : ""}`;
        const result = await provider.generate({
          mode: "generation", prompt: subject, background,
          // Even incidental image inputs must not change the operation.
          sourceImage: png, referenceImage: png,
        });
        const request = requests.at(-1)!;
        assert.equal(request.method, "POST");
        assert.equal(request.path, "/v1/images/generations");
        assert.match(request.headers["content-type"] ?? "", /application\/json/);
        const body = JSON.parse(request.body.toString());
        assert.deepEqual(body, {
          model: "gpt-image-2",
          prompt: buildOpenAIImagePrompt({
            mode: "generation", prompt: subject, background,
            wantsTransparency: background === "transparent",
          }),
          quality: "high", size: "2048x2048", output_format: "png",
          ...(background === "transparent" ? {} : { background }),
        });
        assert.equal(result.providerRequestId, "local-route-test");
        assert.deepEqual([...result.bytes], [...png.bytes]);
      }
    }
    assert.equal(requests.length, 6);
  });
});

test("detail editing still sends the source to images/edits", async () => {
  await withImageApiMock(async (provider, requests) => {
    for (const withReference of [false, true]) {
      await provider.generate({
        mode: "detail-edit", prompt: "Make the roof slightly rounder", background: "opaque",
        sourceImage: { ...png, filename: "source.png" },
        ...(withReference ? { referenceImage: { ...png, filename: "reference.png" } } : {}),
      });
      const request = requests.at(-1)!;
      assert.equal(request.path, "/v1/images/edits");
      assert.match(request.headers["content-type"] ?? "", /multipart\/form-data/);
      const form = await new Response(new Uint8Array(request.body), {
        headers: { "content-type": request.headers["content-type"]! },
      }).formData();
      assert.equal(form.get("model"), "gpt-image-2");
      assert.equal(form.get("quality"), "high");
      assert.equal(form.get("input_fidelity"), "high");
      assert.match(String(form.get("prompt")), /source image is the only editable artwork/i);
      const uploads = [...form.values()].filter((value) => typeof value !== "string");
      assert.deepEqual(uploads.map((file) => file.name), withReference ? ["source.png", "reference.png"] : ["source.png"]);
      assert.deepEqual([...new Uint8Array(await uploads[0].arrayBuffer())], [...png.bytes]);
    }
  });
});

test("detail editing without a source fails before any upstream request", async () => {
  await withImageApiMock(async (provider, requests) => {
    await assert.rejects(
      provider.generate({ mode: "detail-edit", prompt: "Round the roof", referenceImage: png }),
      /Detail editing requires a source image/,
    );
    assert.equal(requests.length, 0);
  });
});

test("generation mode uses compiled style text without claiming an image is attached", () => {
  const prompt = buildOpenAIImagePrompt({
    mode: "generation",
    prompt: "Create a home icon",
    background: "opaque",
    referenceImage: png,
    wantsTransparency: false,
  });
  assert.equal(prompt, "Create a home icon");
  assert.doesNotMatch(prompt, /STYLE REFERENCE IMAGE|attached|editable source/);
});

test("transparent generation with a style reference does not use chroma key", () => {
  assert.equal(resolveTransparencyStrategy({
    mode: "generation",
    sourceImage: undefined,
    wantsTransparency: true,
    transparencyStrategy: undefined,
  }), "native-alpha");
  assert.equal(resolveTransparencyStrategy({
    mode: "generation", wantsTransparency: true, transparencyStrategy: "chroma-key",
  }), "native-alpha");
});

test("transparent generation puts one alpha contract after the subject and preserves artwork", () => {
  const prompt = buildOpenAIImagePrompt({
    mode: "generation", prompt: "FOLD coffee kiosk", wantsTransparency: true,
    background: "transparent", referenceImage: png, transparencyStrategy: "chroma-key",
  });
  assert.equal(prompt.split("TRANSPARENT OUTPUT").length - 1, 1);
  assert.ok(prompt.indexOf("TRANSPARENT OUTPUT") > prompt.indexOf("FOLD coffee kiosk"));
  assert.doesNotMatch(prompt, /STYLE REFERENCE IMAGE|attached|editable source/);
  assert.match(prompt, /solid subject surfaces, dark interiors, and self-shading/);
  assert.match(prompt, /outlines, light effects, edge treatment, and intentional translucent materials/);
  assert.match(prompt, /PNG with a real transparent background/);
  assert.doesNotMatch(prompt, /blank square canvas|checkerboard|alternating squares|repeated cells|colour type|alpha 255/);
  assert.doesNotMatch(prompt, /CHROMA KEY FALLBACK|#00FF00|perfectly uniform pure/);
});

test("all nine foreground styles preserve subject placement without importing a reference backdrop", () => {
  const presets = ICON_STYLE_PRESET_IDS.filter((preset) => preset !== "line-icon");
  assert.equal(presets.length, 9);
  for (const preset of presets) {
    const input: Parameters<typeof iconSkillPromptCompiler.compile>[0] = {
      purpose: "app-icon", name: "FOLD", description: "咖啡亭偏左下，柜台向右上延伸。真实透明背景。",
      background: { enabled: false }, color: { mode: "solid", color: "#61666E" },
      style: { preset, graphicStructure: "filled", subjectSizePercent: 70, linearStrokeWidthPercent: 3.5, subjectOpacityPercent: 100, strokeWeight: "regular", cornerStyle: "balanced", detailLevel: "standard" },
      sizes: [64, 128, 256], slot: 1,
    };
    const compiled = iconSkillPromptCompiler.compile(input);
    assert.ok(compiled.referenceImage, `${preset}: retain the reference for local quality checks`);
    assert.equal(compiled.outputBackground, "transparent");
    const prompt = buildOpenAIImagePrompt({
      mode: "generation", prompt: compiled.prompt, referenceImage: compiled.referenceImage,
      wantsTransparency: true, background: compiled.outputBackground,
    });
    assert.match(prompt, /咖啡亭偏左下.*柜台向右上延伸/);
    assert.doesNotMatch(prompt, /真实透明背景/); // User output rules remain controlled by settings.
    assert.match(prompt, /only the requested object and its essential parts/);
    assert.match(prompt, /no background, surrounding scene, ground plane, or presentation surface/);
    assert.doesNotMatch(prompt, /front-facing|centered in the square canvas|checkerboard|alternating squares|repeated cells|colour type 6|alpha 255|midnight violet-to-indigo background|marks on warm white/);
    if (preset === "isometric-3d") assert.doesNotMatch(prompt, /\bgrid\b/);
    if (preset === "pixel-art") assert.doesNotMatch(prompt, /natural antialiasing/);
    assert.equal(prompt.split("TRANSPARENT OUTPUT").length - 1, 1);
    assert.doesNotMatch(prompt, /STYLE REFERENCE IMAGE|attached image|editable source/);
    const opaque = iconSkillPromptCompiler.compile({
      ...input,
      background: { enabled: true, container: "square", color: { mode: "solid", color: "#A1B2C3" } },
    });
    const opaquePrompt = buildOpenAIImagePrompt({
      mode: "generation", prompt: opaque.prompt, referenceImage: opaque.referenceImage,
      wantsTransparency: false, background: opaque.outputBackground,
    });
    assert.equal(opaque.outputBackground, "opaque");
    assert.match(opaquePrompt, /#A1B2C3/);
    assert.doesNotMatch(opaquePrompt, /TRANSPARENT OUTPUT|only the requested object and its essential parts; no background/);
  }
});

test("transparent detail edits retain the chroma fallback", () => {
  assert.equal(resolveTransparencyStrategy({
    mode: "detail-edit",
    sourceImage: png,
    wantsTransparency: true,
    transparencyStrategy: undefined,
  }), "chroma-key");
});

test("detail-edit mode makes the source authoritative and does not request regeneration", () => {
  const prompt = buildOpenAIImagePrompt({
    mode: "detail-edit",
    prompt: "Make the star slightly rounder",
    background: "opaque",
    sourceImage: png,
    wantsTransparency: false,
  });
  assert.match(prompt, /source image is the only editable artwork/i);
  assert.match(prompt, /do not start from a blank canvas/i);
  assert.doesNotMatch(prompt, /STYLE REFERENCE IMAGE/);
});

test("detail-edit transparency requests native alpha first", () => {
  const prompt = buildOpenAIImagePrompt({
    mode: "detail-edit",
    prompt: "Remove one small highlight",
    background: "transparent",
    sourceImage: png,
    wantsTransparency: true,
    transparencyStrategy: "native-alpha",
  });
  assert.match(prompt, /TRANSPARENT OUTPUT REQUIREMENT/);
  assert.match(prompt, /source image is the only editable artwork/i);
});

test("native-alpha edit input preserves the source alpha channel", async () => {
  const transparent = await sharp({
    create: {
      width: 4,
      height: 4,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).png().toBuffer();
  const prepared = await prepareTransparentEditInput(
    { bytes: transparent, mimeType: "image/png", filename: "source.png" },
    true,
    "native-alpha",
  );
  const pixel = await sharp(prepared).ensureAlpha().raw().toBuffer();
  assert.equal(pixel[3], 0);
});

test("chroma fallback uses the selected key color", async () => {
  const transparent = await sharp({ create: { width: 4, height: 4, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  const prepared = await prepareTransparentEditInput(
    { bytes: transparent, mimeType: "image/png", filename: "source.png" },
    true,
    "chroma-key",
    { red: 255, green: 0, blue: 255 },
  );
  const pixel = await sharp(prepared).raw().toBuffer();
  assert.deepEqual([...pixel.subarray(0, 3)], [255, 0, 255]);
});
