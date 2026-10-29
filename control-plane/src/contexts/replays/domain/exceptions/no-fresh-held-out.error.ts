export class NoFreshHeldOutError extends Error {
  readonly kind = 'invalid' as const;

  constructor(
    readonly fresh: number,
    readonly wanted: number,
  ) {
    super(
      `A search needs ${wanted} held-out tasks that no earlier search of the station searched on. Fresh tasks: ${fresh}`,
    );
    this.name = 'NoFreshHeldOutError';
  }
}
