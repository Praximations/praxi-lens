import type { SourceAdapter } from "../adapter.js";

/** Explicit manifests preserve declared provenance; parsing does not verify their truth. */
export const manifestAdapter: SourceAdapter<unknown> = {
  id: "praxi.manifest",
  ingest(input) { return typeof input === "string" ? JSON.parse(input) : input; },
};
