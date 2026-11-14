import type { Runner } from '@runners/domain/aggregates/runner.aggregate';
import type { HostId } from '@runners/domain/value-objects/host-id.vo';
import type { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';

const enteredBy = (runners: readonly Runner[], sandbox: SandboxId): boolean =>
  runners.some((each) => each.enters?.equals(sandbox) ?? false);

export class HostSlotHolders {
  private constructor(
    private readonly host: HostId,
    readonly runners: readonly Runner[],
    readonly idleSandboxes: readonly SandboxId[],
  ) {}

  static on(
    host: HostId,
    alive: readonly Runner[],
    idleOnHost: readonly SandboxId[],
    now: Date,
  ): HostSlotHolders {
    const runners = alive.filter(
      (each) =>
        (each.hostId?.equals(host) ?? false) &&
        !each.isOpenClaimAt(now) &&
        !each.waitsInOneOf(idleOnHost),
    );

    return new HostSlotHolders(
      host,
      runners,
      idleOnHost.filter((idle) => !enteredBy(runners, idle)),
    );
  }

  get taken(): number {
    return this.runners.length + this.idleSandboxes.length;
  }

  freeIn(capacity: number): number {
    return Math.max(0, capacity - this.taken);
  }

  hides(runner: Runner): boolean {
    return (
      (runner.hostId?.equals(this.host) ?? false) &&
      !this.runners.some((each) => each.id.equals(runner.id))
    );
  }
}
