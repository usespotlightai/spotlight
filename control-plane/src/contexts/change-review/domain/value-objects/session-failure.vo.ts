const SESSION_FAILURES = [
  'no-harness',
  'base-run-elsewhere',
  'run-failed',
  'no-result',
] as const;

export type SessionFailureReason = (typeof SESSION_FAILURES)[number];

/** Why the assist session that drafts a change stack or grades an answer gave nothing back. */
export class SessionFailure {
  private constructor(readonly reason: SessionFailureReason) {}

  static of(reason: SessionFailureReason): SessionFailure {
    return new SessionFailure(reason);
  }

  /**
   * The same order fails the same way again: no harness can run the session, or the run it is based on belongs to
   * another workspace. A failed run, or a run that submitted no usable result, may do better next time.
   */
  get lasting(): boolean {
    return this.reason === 'no-harness' || this.reason === 'base-run-elsewhere';
  }

  equals(other: SessionFailure): boolean {
    return this.reason === other.reason;
  }
}
