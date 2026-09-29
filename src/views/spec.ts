import { z } from "zod";
import { idSchema, provenanceSchema } from "../system-model/schema.js";
import { viewQuerySchema } from "../queries/query.js";

export const viewSpecSchema = z.object({
  schemaVersion: z.literal("0.1"),
  model: z.object({ id: idSchema, revision: z.string().min(1) }).strict(),
  type: z.enum(["overview", "hierarchy", "dependency", "flow"]),
  query: viewQuerySchema,
  focusId: idSchema.optional(),
  layout: z.enum(["nested", "directed", "sequence"]),
  nodes: z.array(z.object({
    id: idSchema, label: z.string(), kind: z.string(), parentId: idSchema.optional(),
    hiddenChildCount: z.number().int().nonnegative(), provenance: provenanceSchema,
  }).strict()),
  edges: z.array(z.object({
    id: idSchema, from: idSchema, to: idSchema, kind: z.string(), provenance: provenanceSchema,
  }).strict()),
  sequence: z.array(idSchema),
  contextClaims: z.array(z.object({ id: idSchema, label: z.string(), provenance: provenanceSchema }).strict()),
  evidenceIds: z.array(idSchema),
  truncated: z.boolean(),
  interactions: z.array(z.enum(["focus", "expand", "collapse", "inspect-evidence"])),
}).strict();
export type ViewSpec = z.infer<typeof viewSpecSchema>;
