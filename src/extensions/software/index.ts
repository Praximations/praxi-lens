import { z } from "zod";
import type { SystemExtension } from "../registry.js";
export const softwareExtension: SystemExtension = {
  namespace: "praxi.software", version: "0.1",
  schema: z.object({
    language: z.string().optional(), path: z.string().optional(),
    packageName: z.string().optional(), exports: z.array(z.string()).optional(),
    /** Package ecosystem of an outside reference, such as npm, pypi, go or cargo. */
    ecosystem: z.string().optional(),
    /** Lines in a file whose source was read. */
    lines: z.number().int().nonnegative().optional(),
    /** Owner-published description and topics, and the README's opening paragraph. */
    description: z.string().max(500).optional(), topics: z.array(z.string()).optional(), summary: z.string().max(500).optional(),
  }).strict(),
};
