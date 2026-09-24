import { shortened } from '@work/application/rendering/approval-asked';
import type { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import type { HarnessPermission } from '@work/domain/value-objects/harness-permission.vo';

export const PermissionAsked = {
  body(permission: HarnessPermission, needed: ApprovalNeeded): string {
    return [
      `I need your approval before ${permission.harness.value} goes on to ${permission.kind}: ${permission.title || 'it did not say what'}.`,
      needed.because,
      ...(permission.input
        ? [
            `It would do it with:\n\`\`\`\n${shortened(permission.input)}\n\`\`\``,
          ]
        : []),
      'Nothing has run yet. Approve it and I will carry on from here; reject it and I will work around it.',
    ].join('\n\n');
  },

  because(profile: string | null): string {
    return profile
      ? `The ${profile} harness profile says to ask a person first.`
      : 'The harness asked before doing it.';
  },
};
