import type { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import type { ToolCall } from '@work/domain/value-objects/tool-call.vo';

const LONG = 400;

export const shortened = (value: string): string =>
  value.length > LONG ? `${value.slice(0, LONG)}…` : value;

export const written = (name: string, value: string): string =>
  value.includes('\n')
    ? `${name}:\n\`\`\`\n${value}\n\`\`\``
    : `${name}: \`${value}\``;

const handed = (call: ToolCall): readonly string[] =>
  call.writtenInputs.length === 0
    ? ['It would be called with nothing.']
    : [
        'It would be called with:',
        ...call.writtenInputs.map((each) =>
          written(each.name, shortened(each.value)),
        ),
      ];

export const ApprovalAsked = {
  body(declared: DeclaredTool, call: ToolCall, needed: ApprovalNeeded): string {
    return [
      `I need your approval before I use \`${declared.tool.value}\`.`,
      needed.because,
      declared.description,
      ...handed(call),
      'Nothing has been sent yet. Approve it and I will carry on; dismiss it and I will work around it.',
    ].join('\n\n');
  },
};
