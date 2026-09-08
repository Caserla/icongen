import type { MetadataRoute } from "next";
import { isIndexableEnvironment } from "@icongen/shared";
import { requireRuntimeEnvironment } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const indexable = isIndexableEnvironment(requireRuntimeEnvironment());
  return {
    rules: {
      userAgent: "*",
      allow: indexable ? "/" : undefined,
      disallow: indexable ? undefined : "/",
    },
  };
}
