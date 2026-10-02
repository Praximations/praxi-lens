import { z } from "zod";

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export const jsonSchema: z.ZodType<Json> = z.lazy(() => z.union([
  z.null(), z.boolean(), z.number().finite(), z.string(),
  z.array(jsonSchema), z.record(jsonSchema),
]));
export const idSchema = z.string().min(1).max(512);
export const evidenceLevelSchema = z.enum(["VERIFIED", "DERIVED", "INFERRED", "USER_DEFINED", "EXTERNAL"]);
export const provenanceSchema = z.object({
  level: evidenceLevelSchema,
  evidenceIds: z.array(idSchema).min(1),
  confidence: z.number().min(0).max(1).optional(),
}).strict();
export const extensionSchema = z.object({
  version: z.string().min(1),
  data: z.record(jsonSchema),
}).strict();
export const entitySchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  kind: z.string().min(1),
  provider: z.string().min(1).optional(),
  provenance: provenanceSchema,
  extensions: z.record(extensionSchema).default({}),
}).strict();
export const componentSchema = entitySchema.extend({ parentId: idSchema });
export const relationshipSchema = z.object({
  id: idSchema, kind: z.string().min(1), from: idSchema, to: idSchema,
  provenance: provenanceSchema,
  extensions: z.record(extensionSchema).default({}),
}).strict();
export const flowSchema = z.object({
  id: idSchema, name: z.string().min(1),
  // Ordered relationships describe declared/observed behavior, not an inferred call trace.
  relationshipIds: z.array(idSchema).min(1),
  provenance: provenanceSchema,
}).strict();
export const evidenceSchema = z.object({
  id: idSchema, level: evidenceLevelSchema,
  source: z.object({
    adapter: z.string().min(1), uri: z.string().min(1),
    revision: z.string().min(1).optional(), locator: z.string().optional(),
  }).strict(),
  summary: z.string().min(1),
}).strict();
export const semanticGroupSchema = z.object({
  id: idSchema, name: z.string().min(1),
  /** Optional overlay family, such as "role". Groups of one kind can be projected together. */
  kind: z.string().min(1).max(80).optional(),
  /** Plain-language meaning of the group for people unfamiliar with the system. */
  description: z.string().min(1).max(500).optional(),
  /** Presentation hint: lower layers sit closer to the people or systems that use this one. */
  layer: z.number().int().min(0).max(20).optional(),
  memberIds: z.array(idSchema).min(1),
  provenance: provenanceSchema,
}).strict();
export const systemModelSchema = z.object({
  schemaVersion: z.literal("0.1"), revision: z.string().min(1),
  visibility: z.enum(["private", "organization", "unlisted", "public"]).default("private"),
  system: entitySchema,
  components: z.array(componentSchema).default([]),
  relationships: z.array(relationshipSchema).default([]),
  flows: z.array(flowSchema).default([]),
  evidence: z.array(evidenceSchema).min(1),
  semanticGroups: z.array(semanticGroupSchema).default([]),
}).strict();

export type EvidenceLevel = z.infer<typeof evidenceLevelSchema>;
export type Provenance = z.infer<typeof provenanceSchema>;
export type Entity = z.infer<typeof entitySchema>;
export type Component = z.infer<typeof componentSchema>;
export type Relationship = z.infer<typeof relationshipSchema>;
export type Flow = z.infer<typeof flowSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type SemanticGroup = z.infer<typeof semanticGroupSchema>;
export type SystemModel = z.infer<typeof systemModelSchema>;
