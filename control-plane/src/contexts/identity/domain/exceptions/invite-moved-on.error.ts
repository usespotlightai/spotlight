export class InviteMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(inviteId: string) {
    super(
      `This invite has been changed since it was read, and cannot be written over (${inviteId})`,
    );
    this.name = 'InviteMovedOnError';
  }
}
