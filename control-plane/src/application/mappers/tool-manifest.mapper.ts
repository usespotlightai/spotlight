import type { ToolManifestShape } from '@application/contracts/run-spec.contract';
import type { DeclaredTool } from '@domain/entities/declared-tool.entity';

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
