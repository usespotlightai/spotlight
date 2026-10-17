export class RecipientPinnedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(runId: string, attempt: number) {
    super(
      `Attempt ${attempt} of run ${runId} already fetched its secrets. They are sealed to another recipient.`,
    );
    this.name = 'RecipientPinnedError';
  }
}
