import { MOST_INVITED_AT_ONCE } from '@identity/application/commands/invite-to-workspace.command';

export class InviteeCountError extends Error {
  readonly violation = 'invalid' as const;

  constructor(count: number) {
    super(
      `Number of email addresses must be 1 to ${MOST_INVITED_AT_ONCE}. Received: ${count}`,
    );
    this.name = 'InviteeCountError';
  }
}
