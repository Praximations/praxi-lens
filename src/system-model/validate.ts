import { systemModelSchema, type SystemModel, type Provenance } from "./schema.js";

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
  return model;
}
