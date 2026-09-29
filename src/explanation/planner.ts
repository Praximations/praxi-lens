import { z } from "zod";
import type { EvidenceLevel, Provenance, SystemModel } from "../system-model/schema.js";
import type { ViewQuery } from "../queries/query.js";
import { generateView } from "../views/generate.js";
import type { ViewSpec } from "../views/spec.js";

const preferencesSchema = z.object({
  detail: z.enum(["brief", "detailed"]).default("brief"),
  maxScenes: z.number().int().min(1).max(40).default(8),
  knownEntityIds: z.array(z.string()).default([]),
}).strict();
export interface Scene {
  id: string; focusIds: string[]; relationshipIds: string[];
  caption: string; provenance: Provenance; motion: "none" | "follow-flow";
}
export interface ExplanationPlan {
  schemaVersion: "0.1";
  model: ViewSpec["model"];
  view: ViewSpec;
  pacing: "user-controlled";
  scenes: Scene[];
  truncated: boolean;
}

/** Evidence-preserving deterministic fallback. Narrative AI integration is not implemented. */
export function planExplanation(model: SystemModel, query: ViewQuery,
  preferences: z.input<typeof preferencesSchema> = {}): ExplanationPlan {
  const options = preferencesSchema.parse(preferences);
  const view = generateView(model, query);
  const prefix = (p: Provenance) => `${p.level.toLowerCase().replaceAll("_", " ")}: `;
  const candidates: Scene[] = view.type === "flow"
    ? view.sequence.map((id, i) => {
      const edge = view.edges.find(e => e.id === id)!;
      const from = view.nodes.find(n => n.id === edge.from)!;
      const to = view.nodes.find(n => n.id === edge.to)!;
      const flowClaim = view.contextClaims[0]!.provenance;
      // The scene cannot sound more certain than any claim it presents.
      const claims = [flowClaim, edge.provenance, from.provenance, to.provenance];
      const levels: EvidenceLevel[] = ["INFERRED", "EXTERNAL", "USER_DEFINED", "DERIVED", "VERIFIED"];
      const provenance: Provenance = {
        level: levels.find(level => claims.some(claim => claim.level === level))!,
        evidenceIds: [...new Set(claims.flatMap(claim => claim.evidenceIds))],
      };
      return { id: `scene:${i}`, focusIds: [edge.from, edge.to], relationshipIds: [id],
        caption: `${prefix(provenance)}${from.label} → ${to.label} (${edge.kind}).`,
        provenance,
        motion: "follow-flow" as const };
    })
    : view.nodes.filter(n => !options.knownEntityIds.includes(n.id)).map((node, i) => ({
      id: `scene:${i}`, focusIds: [node.id], relationshipIds: [],
      caption: `${prefix(node.provenance)}${node.label}${options.detail === "detailed" ? ` (${node.kind})` : ""}.`,
      provenance: node.provenance, motion: "none" as const,
    }));
  return { schemaVersion: "0.1", model: view.model, view, pacing: "user-controlled",
    scenes: candidates.slice(0, options.maxScenes),
    truncated: view.truncated || candidates.length > options.maxScenes };
}
