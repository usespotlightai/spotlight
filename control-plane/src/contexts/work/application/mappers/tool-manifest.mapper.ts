import type { ToolManifestShape } from '@work/application/contracts/run-spec.contract';
import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';

export const toolManifestOf = (declared: DeclaredTool): ToolManifestShape => ({
  name: declared.tool.value,
  description: declared.description,
  inputs: declared.inputs.map((each) => ({
    name: each.name,
    type: each.type,
    ...(each.description ? { description: each.description } : {}),
    required: each.required,
    defaulted: each.defaulted,
    piped: each.piped,
  })),
});
