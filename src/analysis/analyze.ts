import type { AnalysisResult, SourceAdapter } from "../adapters/adapter.js";
import { ExtensionRegistry } from "../extensions/registry.js";
import { parseSystemModel } from "../system-model/validate.js";

export async function analyze<Input>(adapter: SourceAdapter<Input>, input: Input,
  extensions = new ExtensionRegistry()): Promise<AnalysisResult> {
  const model = parseSystemModel(await adapter.ingest(input));
  const unknown = extensions.validate(model);
  return { model, diagnostics: unknown.map(namespace => ({
    code: "unvalidated_extension", message: `Preserved extension without semantic validation: ${namespace}`,
  })) };
}
