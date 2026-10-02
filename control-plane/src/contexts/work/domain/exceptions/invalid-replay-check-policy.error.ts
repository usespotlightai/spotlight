export type ReplayCheckField = 'mostRegressions' | 'ceiling' | 'currency';

export class InvalidReplayCheckPolicyError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    readonly field: ReplayCheckField,
    reason: string,
  ) {
    super(reason);
    this.name = 'InvalidReplayCheckPolicyError';
  }
}
