import { z } from "zod";
import type { EvidenceLevel, Provenance, SystemModel } from "../system-model/schema.js";
import type { ViewQuery } from "../queries/query.js";
import { generateView, weakestProvenance } from "../views/generate.js";
import { describeSystem } from "./describe.js";
import { listPhrase, lowerName } from "./vocabulary.js";
import { groupResolver } from "../queries/groups.js";
import { indexModel } from "../system-model/model-index.js";
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

/**
 * A guided tour of a whole system for someone new to it: what it is, each major part and what it
 * relies on, then where to start. Role scenes carry the overlay's INFERRED provenance.
 */
export function planTour(input: SystemModel, options: { maxScenes?: number } = {}): ExplanationPlan {
  const maxScenes = Math.max(2, Math.min(40, options.maxScenes ?? 12));
  const summary = describeSystem(input);
  const view = generateView(input, { kind: "groups", groupKind: "role", limit: 40 });
  const scenes: Scene[] = [{ id: "scene:intro", focusIds: view.nodes.map(n => n.id), relationshipIds: [],
    caption: [summary.headline, summary.description ? `Its owners describe it as: “${summary.description}”` : summary.summary ? `Its README begins: “${summary.summary}”` : ""].filter(Boolean).join(" "),
    provenance: summary.provenance, motion: "none" }];
  // Small roles stay on the map but are skipped here so the story covers what matters most.
  const ordered = [...summary.roles].filter(r => r.groupId === "role:packages" || (r.supporting ? r.share >= 0.05 : r.share >= 0.02 || r.files >= 10))
    .sort((a, b) => Number(a.supporting) - Number(b.supporting) || (a.layer ?? 9) - (b.layer ?? 9) || b.files - a.files);
  for (const role of ordered) {
    const edges = view.edges.filter(e => e.from === role.groupId || e.to === role.groupId);
    const where = role.groupId === "role:packages" ? `${role.files} outside packages are referenced.`
      : `About ${role.files.toLocaleString("en-US")} ${role.files === 1 ? "file" : "files"}, mostly in ${listPhrase(role.places.map(p => p.label), 2)}.`;
    const dependsOn = role.uses.filter(u => u.id !== role.groupId).slice(0, 3).map(u => lowerName(u.label));
    scenes.push({ id: `scene:${role.groupId}`, focusIds: [role.groupId], relationshipIds: edges.map(e => e.id),
      caption: `${role.name}: ${role.description ?? ""} ${where}${dependsOn.length ? ` ${role.name.endsWith("s") ? "They rely" : "It relies"} on ${listPhrase(dependsOn)}.` : ""}`.replace(/\s+/g, " ").trim(),
      provenance: role.provenance, motion: "none" });
  }
  if (summary.entryPoints.length) {
    const roles = groupResolver(indexModel(input), "role");
    scenes.push({ id: "scene:start", focusIds: [...new Set(summary.entryPoints.flatMap(e => roles.resolve(e.id)))], relationshipIds: [],
      caption: `Where to start reading: ${listPhrase(summary.entryPoints.map(e => e.label))}. Open any part to see what it relies on and the evidence behind every connection.`,
      provenance: weakestProvenance(summary.entryPoints.map(e => indexModel(input).entity.get(e.id)!.provenance)), motion: "none" });
  }
  const kept = scenes.length > maxScenes ? [...scenes.slice(0, maxScenes - 1), scenes.at(-1)!] : scenes;
  return { schemaVersion: "0.1", model: view.model, view, pacing: "user-controlled", scenes: kept, truncated: scenes.length > kept.length };
}
