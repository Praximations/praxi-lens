import { semanticGroupSchema, systemModelSchema, type SemanticGroup, type SystemModel, type Provenance } from "./schema.js";

type Shape = { components: number; relationships: number; groups: number };
const validated = new WeakMap<object, { model: SystemModel } & Shape>();
const shape = (m: SystemModel): Shape => ({ components: m.components?.length, relationships: m.relationships?.length, groups: m.semanticGroups?.length });
function remember(input: object, model: SystemModel) { validated.set(input, { model, ...shape(input as SystemModel) }); }

/**
 * Validates an input once per object identity. Models returned by parseSystemModel are already
 * validated. Treat validated models as immutable: clone before editing. A cheap shape check
 * re-validates after obvious additions or removals.
 */
export function validModel(input: SystemModel): SystemModel {
  if (input && typeof input === "object") {
    const hit = validated.get(input);
    const now = shape(input);
    if (hit && hit.components === now.components && hit.relationships === now.relationships && hit.groups === now.groups) return hit.model;
  }
  const model = parseSystemModel(input);
  if (input && typeof input === "object") remember(input, model);
  return model;
}

/** Validate both the wire shape and graph integrity at every ingestion boundary. */
export function parseSystemModel(input: unknown): SystemModel {
  const model = systemModelSchema.parse(input);
  const allIds = new Set<string>();
  for (const item of [model.system, ...model.components, ...model.relationships,
    ...model.flows, ...model.evidence, ...model.semanticGroups]) {
    if (allIds.has(item.id)) throw new Error(`duplicate_id:${item.id}`);
    allIds.add(item.id);
  }
  const entities = new Set([model.system.id, ...model.components.map(c => c.id)]);
  const evidence = new Map(model.evidence.map(e => [e.id, e]));
  const requireEntity = (id: string) => {
    if (!entities.has(id)) throw new Error(`unknown_entity:${id}`);
  };
  const checkProvenance = (claim: Provenance) => {
    for (const id of claim.evidenceIds) {
      const source = evidence.get(id);
      if (!source) throw new Error(`unknown_evidence:${id}`);
      if (claim.level === "VERIFIED" && source.level !== "VERIFIED")
        throw new Error(`unsupported_verified_claim:${id}`);
      if (claim.level === "DERIVED" && !["VERIFIED", "DERIVED"].includes(source.level))
        throw new Error(`unsupported_derived_claim:${id}`);
    }
  };
  for (const item of [model.system, ...model.components, ...model.relationships,
    ...model.flows, ...model.semanticGroups]) checkProvenance(item.provenance);
  const parents = new Map(model.components.map(c => [c.id, c.parentId]));
  for (const component of model.components) {
    requireEntity(component.parentId);
    const visited = new Set<string>();
    let current: string | undefined = component.id;
    while (current !== undefined) {
      if (visited.has(current)) throw new Error(`hierarchy_cycle:${current}`);
      visited.add(current);
      current = parents.get(current);
    }
  }
  for (const relationship of model.relationships) {
    requireEntity(relationship.from); requireEntity(relationship.to);
  }
  const relationships = new Map(model.relationships.map(r => [r.id, r]));
  for (const flow of model.flows) {
    let previousTo: string | undefined;
    for (const id of flow.relationshipIds) {
      const relationship = relationships.get(id);
      if (!relationship) throw new Error(`unknown_relationship:${id}`);
      if (previousTo !== undefined && relationship.from !== previousTo)
        throw new Error(`disconnected_flow:${flow.id}`);
      previousTo = relationship.to;
    }
  }
  for (const group of model.semanticGroups) for (const id of group.memberIds) requireEntity(id);
  remember(model, model);
  return model;
}

/**
 * Replaces a validated model's overlay groups, checking only what changed: group shape, unique IDs,
 * member entities and evidence support. Observed facts are reused as-is.
 */
export function withSemanticGroups(input: SystemModel, groups: SemanticGroup[]): SystemModel {
  const base = validModel(input);
  const parsed = groups.map(g => semanticGroupSchema.parse(g));
  const ids = new Set([base.system.id, ...base.components.map(c => c.id), ...base.relationships.map(r => r.id),
    ...base.flows.map(f => f.id), ...base.evidence.map(e => e.id)]);
  const entities = new Set([base.system.id, ...base.components.map(c => c.id)]);
  const evidence = new Map(base.evidence.map(e => [e.id, e.level]));
  const seen = new Set<string>();
  for (const group of parsed) {
    if (ids.has(group.id) || seen.has(group.id)) throw new Error(`duplicate_id:${group.id}`);
    seen.add(group.id);
    for (const id of group.memberIds) if (!entities.has(id)) throw new Error(`unknown_entity:${id}`);
    for (const id of group.provenance.evidenceIds) {
      const level = evidence.get(id);
      if (!level) throw new Error(`unknown_evidence:${id}`);
      if (group.provenance.level === "VERIFIED" && level !== "VERIFIED") throw new Error(`unsupported_verified_claim:${id}`);
      if (group.provenance.level === "DERIVED" && !["VERIFIED", "DERIVED"].includes(level)) throw new Error(`unsupported_derived_claim:${id}`);
    }
  }
  const model: SystemModel = { ...base, semanticGroups: parsed };
  remember(model, model);
  return model;
}
