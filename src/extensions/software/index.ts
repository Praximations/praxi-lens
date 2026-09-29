import { z } from "zod";
import type { SystemExtension } from "../registry.js";
export const softwareExtension: SystemExtension = {
  namespace: "praxi.software", version: "0.1",
  schema: z.object({
    language: z.string().optional(), path: z.string().optional(),
    packageName: z.string().optional(), exports: z.array(z.string()).optional(),
  }).strict(),
};
