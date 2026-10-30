import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export class SandboxDrainPolicy {
  private constructor(
    readonly graceMs: number,
    readonly editorLimitMs: number,
  ) {}

  static of(input: {
    graceMs: number;
    editorLimitMs: number;
  }): SandboxDrainPolicy {
    if (!(input.graceMs > 0) || !(input.editorLimitMs > 0)) {
      throw new InconsistentStateError(
        'sandbox drain policy',
        'needs a grace and an editor limit longer than zero',
      );
    }

    return new SandboxDrainPolicy(input.graceMs, input.editorLimitMs);
  }

  get shortestMs(): number {
    return Math.min(this.graceMs, this.editorLimitMs);
  }
}
