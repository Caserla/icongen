import type { AppLogger } from "@icongen/backend-core";

export const logger: AppLogger = {
  info(message, context = {}) {
    console.info(JSON.stringify({ level: "info", message, ...context }));
  },
  error(message, context = {}) {
    console.error(JSON.stringify({ level: "error", message, ...context }));
  },
};
