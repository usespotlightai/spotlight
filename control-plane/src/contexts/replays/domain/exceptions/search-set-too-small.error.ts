export class SearchSetTooSmallError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    readonly tasks: number,
    readonly heldOut: number,
  ) {
    super(
      `A search holds out at least 2 tasks and searches at least 3, but its replay set covers ${tasks} tasks, of which it would hold out ${heldOut}; add runs of other tasks first`,
    );
    this.name = 'SearchSetTooSmallError';
  }
}
