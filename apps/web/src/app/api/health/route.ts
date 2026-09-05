import { requireRuntimeEnvironment } from "@/lib/env";

export function GET() {
  return Response.json({ status: "ok", service: "icongen-web", environment: requireRuntimeEnvironment() });
}
