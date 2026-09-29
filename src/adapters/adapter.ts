import type { SystemModel } from "../system-model/schema.js";

/** Internal adapter seam; a published third-party adapter SDK is a later phase. */
export interface SourceAdapter<Input> {
  readonly id: string;
  ingest(input: Input): unknown | Promise<unknown>;
}
export interface AnalysisResult {
  model: SystemModel;
  diagnostics: { code: string; message: string }[];
}
