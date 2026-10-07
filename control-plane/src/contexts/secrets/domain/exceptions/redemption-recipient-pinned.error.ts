export class RedemptionRecipientPinnedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(runId: string, attempt: number) {
    super(
      `Attempt ${attempt} of run ${runId} already redeemed its secrets. They are sealed to another recipient.`,
    );
    this.name = 'RedemptionRecipientPinnedError';
  }
}
