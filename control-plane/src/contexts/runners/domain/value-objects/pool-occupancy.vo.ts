import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';

export class PoolOccupancy {
  private constructor(
    readonly runners: number,
    private readonly idle: readonly SandboxId[],
  ) {}

  static of(input: {
    runners: number;
    idleSandboxes: readonly SandboxId[];
  }): PoolOccupancy {
    if (!Number.isInteger(input.runners) || input.runners < 0) {
      throw new InconsistentStateError(
        'runner pool',
        `counts ${input.runners} alive runners`,
      );
    }

    return new PoolOccupancy(input.runners, [...input.idleSandboxes]);
  }

  get idleSandboxes(): number {
    return this.idle.length;
  }

  get taken(): number {
    return this.runners + this.idle.length;
  }

  entering(sandbox: SandboxId): PoolOccupancy {
    return new PoolOccupancy(
      this.runners,
      this.idle.filter((each) => !each.equals(sandbox)),
    );
  }
}
