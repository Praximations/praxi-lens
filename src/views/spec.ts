import { z } from "zod";
import { idSchema, provenanceSchema } from "../system-model/schema.js";
import { viewQuerySchema } from "../queries/query.js";

export const viewSpecSchema = z.object({
  schemaVersion: z.literal("0.1"),
  model: z.object({ id: idSchema, revision: z.string().min(1) }).strict(),
  type: z.enum(["overview", "hierarchy", "dependency", "flow", "architecture"]),
  query: viewQuerySchema,
  focusId: idSchema.optional(),
  layout: z.enum(["nested", "directed", "sequence", "layered"]),
  nodes: z.array(z.object({
    id: idSchema, label: z.string(), kind: z.string(), parentId: idSchema.optional(),
    hiddenChildCount: z.number().int().nonnegative(), provenance: provenanceSchema,
    /** Display-only location, such as the containing folder path. */
    context: z.string().optional(),
    /** Leaf components represented by this node. */
    size: z.number().int().nonnegative().optional(),
    /** Present on bundles and group nodes: the exact underlying entities. */
    memberIds: z.array(idSchema).min(1).optional(),
    /** Dominant inferred overlay group (for example a role) among the represented leaves. */
    role: z.object({ groupId: idSchema, name: z.string(), share: z.number().min(0).max(1) }).strict().optional(),
    description: z.string().optional(),
    layer: z.number().int().min(0).max(20).optional(),
  }).strict()),
  edges: z.array(z.object({
    id: idSchema, from: idSchema, to: idSchema, kind: z.string(), provenance: provenanceSchema,
    /** Present on overview projections: exact supporting model relationships. */
    relationshipIds: z.array(idSchema).min(1).optional(),
    /** Present when parallel connections of different kinds were combined. */
    kindCounts: z.record(z.number().int().positive()).optional(),
  }).strict()),
  sequence: z.array(idSchema),
  contextClaims: z.array(z.object({ id: idSchema, label: z.string(), provenance: provenanceSchema }).strict()),
  evidenceIds: z.array(idSchema),
  truncated: z.boolean(),
  interactions: z.array(z.enum(["focus", "expand", "collapse", "inspect-evidence"])),
}).strict();
export type ViewSpec = z.infer<typeof viewSpecSchema>;
