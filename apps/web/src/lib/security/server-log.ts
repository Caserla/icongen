import "server-only";
import { redactServerLogValue } from "./log-redaction";

export const serverLogger = {
  error(event: string, context: Record<string, unknown> = {}) {
    console.error(JSON.stringify({ level: "error", event, ...redactServerLogValue(context) as object }));
  },
  warn(event: string, context: Record<string, unknown> = {}) {
    console.warn(JSON.stringify({ level: "warn", event, ...redactServerLogValue(context) as object }));
  },
};
