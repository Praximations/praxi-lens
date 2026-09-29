import { z } from "zod";
import type { SystemExtension } from "../registry.js";
export const databasesExtension: SystemExtension = {
  namespace: "praxi.databases", version: "0.1",
  schema: z.object({
    engine: z.string().optional(), schema: z.string().optional(), table: z.string().optional(),
    columns: z.array(z.object({ name: z.string(), type: z.string(), nullable: z.boolean() }).strict()).optional(),
  }).strict(),
};
