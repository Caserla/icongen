import type { AppLogger } from "@icongen/backend-core";
import { redactLogValue } from "./log-redaction";

export const logger: AppLogger = {
  info(message, context = {}) {
    console.info(JSON.stringify(redactLogValue({ level: "info", message, ...context })));
  },
  error(message, context = {}) {
    console.error(JSON.stringify(redactLogValue({ level: "error", message, ...context })));
  },
};
