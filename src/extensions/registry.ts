import type { z } from "zod";
import type { SystemModel } from "../system-model/schema.js";

export interface SystemExtension { namespace: string; version: string; schema: z.ZodTypeAny }

/** Unknown namespaces survive round trips; their semantics are explicitly unvalidated. */
export class ExtensionRegistry {
  private readonly entries = new Map<string, SystemExtension>();
  register(extension: SystemExtension): this {
    const key = `${extension.namespace}@${extension.version}`;
    if (this.entries.has(key)) throw new Error(`duplicate_extension:${key}`);
    this.entries.set(key, extension);
    return this;
  }
  validate(model: SystemModel): string[] {
    const unknown = new Set<string>();
    for (const item of [model.system, ...model.components, ...model.relationships]) {
      for (const [namespace, extension] of Object.entries(item.extensions)) {
        const key = `${namespace}@${extension.version}`;
        const definition = this.entries.get(key);
        if (definition) definition.schema.parse(extension.data);
        else unknown.add(key);
      }
    }
    return [...unknown].sort();
  }
}
