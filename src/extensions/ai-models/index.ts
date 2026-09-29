import { z } from "zod";
import type { SystemExtension } from "../registry.js";
export const aiModelsExtension: SystemExtension = {
  namespace: "praxi.ai-models", version: "0.1",
  // Architecture/measurements only; no claim of access to private reasoning.
  schema: z.object({
    architecture: z.string().optional(), modalities: z.array(z.string()).optional(),
    tensorShape: z.array(z.union([z.number().int().nonnegative(), z.string()])).optional(),
    parameterCount: z.number().int().nonnegative().optional(),
  }).strict(),
};
