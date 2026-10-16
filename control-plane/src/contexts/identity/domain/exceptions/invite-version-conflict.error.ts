export class InviteVersionConflictError extends Error {
  readonly violation = 'conflict' as const;

  constructor(inviteId: string) {
    super(
      `Invite ${inviteId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'InviteVersionConflictError';
  }
}
