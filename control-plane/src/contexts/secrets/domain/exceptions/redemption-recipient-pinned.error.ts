export class RedemptionRecipientPinnedError extends Error {
  readonly violation = 'conflict' as const;

  constructor(runId: string, attempt: number) {
    super(
      `Attempt ${attempt} of run ${runId} already redeemed its secrets for another recipient; they are sealed to that recipient alone`,
    );
    this.name = 'RedemptionRecipientPinnedError';
  }
}
