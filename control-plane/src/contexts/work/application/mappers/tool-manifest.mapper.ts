import { APPROVAL_INTENT_INPUT } from '@shared-kernel/domain/value-objects/approval-intent-input';
import type { ToolManifestShape } from '@work/application/contracts/run-spec.contract';
import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';

const told = (declared: DeclaredTool): string =>
  declared.approval
    ? [
        declared.description,
        `Needs a person’s approval before it runs: ${declared.approval.because} Using it asks them and does nothing else, so hand over and wait for their answer.`,
        `Say what you want to do with --${APPROVAL_INTENT_INPUT}; the person reads it first.`,
      ].join(' ')
    : declared.description;

const INTENT = {
  name: APPROVAL_INTENT_INPUT,
  schema: { type: 'string' },
  description:
    'What you want to do and why it needs a person, as one short phrase that completes “Spotlight would like to …”, in the words of the reason above, as in: post the drain summary on ENG-412, publicly under the team’s name',
  required: false,
  defaulted: false,
  piped: false,
};

export const toolManifestOf = (declared: DeclaredTool): ToolManifestShape => ({
  name: declared.tool.called,
  description: told(declared),
  inputs: [
    ...declared.inputs.map((each) => ({
      name: each.name,
      schema: each.schema.written,
      ...(each.description ? { description: each.description } : {}),
      required: each.required,
      defaulted: each.defaulted,
      piped: each.piped,
    })),
    ...(declared.approval ? [INTENT] : []),
  ],
  approval: declared.approval ? { because: declared.approval.because } : null,
  ...(declared.offeredBy ? { integration: declared.offeredBy } : {}),
});
