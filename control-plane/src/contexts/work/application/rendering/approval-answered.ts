import { shortened, written } from '@work/application/rendering/approval-asked';
import type { ApprovalDecision } from '@work/domain/value-objects/approval.vo';
import type { ToolCall } from '@work/domain/value-objects/tool-call.vo';

const decided = (decision: ApprovalDecision | null): string =>
  decision === 'granted'
    ? 'Approved.'
    : decision === 'refused'
      ? 'Rejected.'
      : '';

export const ApprovalAnswered = {
  words(
    said: string,
    decision: ApprovalDecision | null,
    changed: ToolCall | null,
  ): string {
    const words = said.trim() ? said : decided(decision);

    return changed
      ? [
          words,
          'I changed what it runs with. Call it again as you asked and it runs with these instead:',
          ...changed.given.map((each) =>
            written(each.name, shortened(each.value)),
          ),
        ].join('\n\n')
      : words;
  },
};
