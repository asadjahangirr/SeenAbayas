import "server-only";

import { z } from "zod";
import { readCatalogConfig } from "./catalog/config.mjs";

const environmentSchema = z
  .object({
    NEXT_PUBLIC_SITE_URL: z.url().optional(),
    SITE_INDEXING_ENABLED: z.enum(["true", "false"]).default("false"),
  })
  .superRefine((environment, context) => {
    if (environment.SITE_INDEXING_ENABLED === "true" && !environment.NEXT_PUBLIC_SITE_URL) {
      context.addIssue({
        code: "custom",
        path: ["NEXT_PUBLIC_SITE_URL"],
        message: "A public site URL is required before enabling indexing.",
      });
    }

    if (environment.NEXT_PUBLIC_SITE_URL) {
      const url = new URL(environment.NEXT_PUBLIC_SITE_URL);
      const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);

      if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
        context.addIssue({
          code: "custom",
          path: ["NEXT_PUBLIC_SITE_URL"],
          message: "Use an origin without credentials, a path, a query, or a fragment.",
        });
      }

      if (url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) {
        context.addIssue({
          code: "custom",
          path: ["NEXT_PUBLIC_SITE_URL"],
          message: "Public sites must use HTTPS; HTTP is allowed only for loopback development.",
        });
      }
    }
  });

const result = environmentSchema.safeParse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  SITE_INDEXING_ENABLED: process.env.SITE_INDEXING_ENABLED || undefined,
});

if (!result.success) {
  // Report field names and validation messages without echoing environment values.
  throw new Error(
    `Invalid site configuration: ${result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ")}`,
  );
}

export const environment = {
  siteUrl: result.data.NEXT_PUBLIC_SITE_URL,
  indexingEnabled: result.data.SITE_INDEXING_ENABLED === "true",
  catalog: readCatalogConfig(process.env),
};
