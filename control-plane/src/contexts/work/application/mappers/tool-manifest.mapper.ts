import type { ToolManifestShape } from '@work/application/contracts/run-spec.contract';
import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';

const told = (declared: DeclaredTool): string =>
  declared.approval
    ? [
        declared.description,
        `Needs a person’s approval before it runs: ${declared.approval.because} Using it asks them and does nothing else, so hand over and wait for their answer.`,
      ].join(' ')
    : declared.description;

export const toolManifestOf = (declared: DeclaredTool): ToolManifestShape => ({
  name: declared.tool.called,
  description: told(declared),
  inputs: declared.inputs.map((each) => ({
    name: each.name,
    type: each.type,
    ...(each.description ? { description: each.description } : {}),
    required: each.required,
    defaulted: each.defaulted,
    piped: each.piped,
  })),
});
