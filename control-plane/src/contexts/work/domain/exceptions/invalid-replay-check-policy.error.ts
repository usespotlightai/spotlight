export type ReplayCheckField =
  | 'maxRegressions'
  | 'ceiling'
  | 'currency'
  | 'minGain';

export class InvalidReplayCheckPolicyError extends Error {
  readonly kind = 'invalid' as const;

  constructor(
    readonly field: ReplayCheckField,
    reason: string,
  ) {
    super(`Replay check ${field} ${reason}.`);
    this.name = 'InvalidReplayCheckPolicyError';
  }
}
