export class ReplaySetFullError extends Error {
  readonly violation = 'conflict' as const;

  constructor(most: number) {
    super(`A replay set holds at most ${most} runs`);
    this.name = 'ReplaySetFullError';
  }
}
