import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export class SandboxDrainPolicy {
  private constructor(
    readonly graceMs: number,
    readonly editorLimitMs: number,
    readonly warmAgeMs: number,
  ) {}

  static of(input: {
    graceMs: number;
    editorLimitMs: number;
    warmAgeMs: number;
  }): SandboxDrainPolicy {
    if (
      !(input.graceMs > 0) ||
      !(input.editorLimitMs > 0) ||
      !(input.warmAgeMs > 0)
    ) {
      throw new InconsistentStateError(
        'sandbox drain policy',
        'needs a grace, an editor limit and a warm age longer than zero',
      );
    }

    return new SandboxDrainPolicy(
      input.graceMs,
      input.editorLimitMs,
      input.warmAgeMs,
    );
  }

  get shortestMs(): number {
    return Math.min(this.graceMs, this.editorLimitMs, this.warmAgeMs);
  }
}
