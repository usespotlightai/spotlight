export class MarkWornElsewhereError extends Error {
  readonly violation = 'conflict' as const;

  constructor(mark: string) {
    super(`Mark ${mark} was just claimed by another task.`);
    this.name = 'MarkWornElsewhereError';
  }
}
