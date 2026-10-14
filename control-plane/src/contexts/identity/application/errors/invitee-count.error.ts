import { MOST_INVITED_AT_ONCE } from '@identity/application/commands/invite-to-workspace.command';

export class InviteeCountError extends Error {
  readonly violation = 'invalid' as const;

  constructor(count: number) {
    super(
      `Please give between 1 and ${MOST_INVITED_AT_ONCE} email addresses. Received: ${count}`,
    );
    this.name = 'InviteeCountError';
  }
}
