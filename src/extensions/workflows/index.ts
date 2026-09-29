import { z } from "zod";
import type { SystemExtension } from "../registry.js";
export const workflowsExtension: SystemExtension = {
  namespace: "praxi.workflows", version: "0.1",
  schema: z.object({
    trigger: z.string().optional(), states: z.array(z.string()).optional(),
    retryLimit: z.number().int().nonnegative().optional(),
  }).strict(),
};
