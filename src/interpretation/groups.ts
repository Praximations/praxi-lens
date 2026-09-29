import { z } from "zod";
import { idSchema, type SystemModel } from "../system-model/schema.js";
import { parseSystemModel } from "../system-model/validate.js";

const proposalSchema = z.object({
  revision: z.string().min(1),
  groups: z.array(z.object({
    id: idSchema, name: z.string().min(1), memberIds: z.array(idSchema).min(1),
    evidenceIds: z.array(idSchema).min(1), confidence: z.number().min(0).max(1),
  }).strict()),
}).strict();
export type InterpretationProposal = z.infer<typeof proposalSchema>;

/** AI proposals add an inferred overlay without reparenting observed components. */
export function applyInterpretation(input: SystemModel, value: InterpretationProposal): SystemModel {
  const model = parseSystemModel(input);
  const proposal = proposalSchema.parse(value);
  if (proposal.revision === model.revision) throw new Error("new_revision_required");
  return parseSystemModel({ ...model, revision: proposal.revision,
    semanticGroups: [...model.semanticGroups, ...proposal.groups.map(group => ({
      id: group.id, name: group.name, memberIds: group.memberIds,
      provenance: { level: "INFERRED", evidenceIds: group.evidenceIds, confidence: group.confidence },
    }))],
  });
}
