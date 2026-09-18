export class MarkWornElsewhereError extends Error {
  readonly violation = 'conflict' as const;

  constructor(mark: string) {
    super(
      `Another task took ${mark} while this one was being written, so it cannot claim it`,
    );
    this.name = 'MarkWornElsewhereError';
  }
}
