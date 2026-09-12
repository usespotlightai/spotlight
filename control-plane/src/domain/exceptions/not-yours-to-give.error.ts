export class NotYoursToGiveError extends Error {
  readonly violation = 'not-allowed' as const;

  constructor(why: string) {
    super(`That role is not yours to give: ${why}`);
    this.name = 'NotYoursToGiveError';
  }
}
