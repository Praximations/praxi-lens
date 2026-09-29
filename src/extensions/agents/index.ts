import { z } from "zod";
import type { SystemExtension } from "../registry.js";
export const agentsExtension: SystemExtension = {
  namespace: "praxi.agents", version: "0.1",
  schema: z.object({
    role: z.string().optional(), tools: z.array(z.string()).optional(),
    states: z.array(z.string()).optional(),
  }).strict(),
};
