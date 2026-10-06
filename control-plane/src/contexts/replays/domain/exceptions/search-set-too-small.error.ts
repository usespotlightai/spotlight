export class SearchSetTooSmallError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    readonly tasks: number,
    readonly heldOut: number,
  ) {
    super(
      `A search needs at least 2 held-out and 3 searched tasks. Replay set covers ${tasks} tasks, ${heldOut} held out.`,
    );
    this.name = 'SearchSetTooSmallError';
  }
}
