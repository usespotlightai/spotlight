export class RunnerAlreadyClaimedError extends Error {
  readonly kind = 'conflict' as const;

  constructor(runnerId: string) {
    super(
      `Runner ${runnerId} has already claimed its one piece of work, or ended.`,
    );
    this.name = 'RunnerAlreadyClaimedError';
  }
}
