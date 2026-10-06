export class InviteClosedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(why: string) {
    super(`This invite ${why}.`);
    this.name = 'InviteClosedError';
  }
}
