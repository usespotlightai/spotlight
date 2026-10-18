import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import type { ToolRule } from '@work/domain/value-objects/tool-rule.vo';

export interface PersonRule {
  readonly rule: ToolRule;
  readonly personId: UserId;
  readonly personName: string;
}

export type Ruled =
  | { readonly kind: 'allowed' }
  | { readonly kind: 'needs-approval'; readonly needed: ApprovalNeeded }
  | { readonly kind: 'blocked'; readonly by: string };

const approvalReason = (declared: DeclaredTool, person: PersonRule): string =>
  `${person.personName || 'The person'} wants to approve each call made with their ${declared.providedBy ?? 'integration'} connection.`;

export const StricterRule = {
  of(declared: DeclaredTool, person: PersonRule | null): Ruled {
    const team = declared.approval;

    if (person?.rule.blocks) {
      return { kind: 'blocked', by: person.personName };
    }

    if (person?.rule.asksFirst) {
      return {
        kind: 'needs-approval',
        needed: ApprovalNeeded.of(
          declared.tool.value,
          team?.because ?? approvalReason(declared, person),
          person.personId,
        ),
      };
    }

    return team
      ? { kind: 'needs-approval', needed: team }
      : { kind: 'allowed' };
  },
};
