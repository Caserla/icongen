export const runtimeEnvironments = ["development", "test", "preproduction", "production"] as const;

export type RuntimeEnvironment = (typeof runtimeEnvironments)[number];

export type RuntimeEnvironmentInput = {
  appEnvironment?: string;
  nodeEnvironment?: string;
  resourceEnvironment?: string;
  appUrl?: string;
  imageProvider?: string;
};

export function resolveRuntimeEnvironment(input: Pick<RuntimeEnvironmentInput, "appEnvironment" | "nodeEnvironment">): RuntimeEnvironment {
  if (runtimeEnvironments.includes(input.appEnvironment as RuntimeEnvironment)) {
    return input.appEnvironment as RuntimeEnvironment;
  }
  if (input.nodeEnvironment === "development") return "development";
  if (input.nodeEnvironment === "test") return "test";
  throw new Error("APP_ENV must be one of development, test, preproduction, or production");
}

export function validateRuntimeEnvironment(input: RuntimeEnvironmentInput): RuntimeEnvironment {
  const environment = resolveRuntimeEnvironment(input);

  if (input.resourceEnvironment && input.resourceEnvironment !== environment) {
    throw new Error(`Resource environment ${input.resourceEnvironment} does not match APP_ENV ${environment}`);
  }

  if ((environment === "preproduction" || environment === "production") && input.appUrl) {
    const url = new URL(input.appUrl);
    if (url.protocol !== "https:") throw new Error(`${environment} APP_URL must use HTTPS`);
    if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
      throw new Error(`${environment} APP_URL cannot point to localhost`);
    }
  }

  if (environment === "production" && input.imageProvider === "mock") {
    throw new Error("The mock image provider is not allowed in production");
  }

  return environment;
}

export function isIndexableEnvironment(environment: RuntimeEnvironment) {
  return environment === "production";
}
