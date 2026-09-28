import type { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import { StackCheckMovedOnError } from '@change-review/domain/exceptions/stack-check-moved-on.error';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import type { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  CheckProvisioningPort,
  LapsedCheck,
  WaitingCheck,
} from '@work/application/ports/check-provisioning.port';

const ATTEMPTS = 3;

export class ProvisionChangeStackChecks implements CheckProvisioningPort {
  constructor(private readonly checks: StackCheckRepository) {}

  async awaiting(
    workspaceId: WorkspaceId,
    now: Date,
    page: { readonly skip: number; readonly most: number },
  ): Promise<readonly WaitingCheck[]> {
    return (await this.checks.awaitingProvision(workspaceId, now, page))
      .filter((each) => each.provisionableAt(now))
      .map((each) => ({
        stackId: each.stackId.value,
        runId: each.runId.value,
        placement: each.request.placement,
      }));
  }

  async reserve(
    stackId: string,
    runner: RunnerId,
    pool: PoolId,
    now: Date,
  ): Promise<Date | null> {
    try {
      const reserved = await this.revised(stackId, (check) =>
        check.provisionableAt(now)
          ? check.reservedFor(runner, pool, now)
          : check,
      );

      return reserved?.reservation?.until ?? null;
    } catch (error) {
      if (error instanceof StackCheckMovedOnError) {
        return null;
      }

      throw error;
    }
  }

  async unreserve(stackId: string, runner: RunnerId): Promise<void> {
    await this.revised(stackId, (check) => check.unreservedFor(runner));
  }

  async failed(
    stackId: string,
    runner: RunnerId,
    failure: ProvisionFailure,
    now: Date,
  ): Promise<void> {
    await this.revised(stackId, (check) =>
      check.provisionFailed(runner, failure, now),
    );
  }

  async lapsed(now: Date): Promise<readonly LapsedCheck[]> {
    return (await this.checks.withLapsedReservations(now)).flatMap((each) =>
      each.reservation && each.reservationLapsedAt(now)
        ? [
            {
              stackId: each.stackId.value,
              runner: each.reservation.runner,
              until: each.reservation.until,
            },
          ]
        : [],
    );
  }

  private async revised(
    stackId: string,
    change: (check: StackCheck) => StackCheck,
  ): Promise<StackCheck | null> {
    for (let attempt = 1; ; attempt++) {
      const found = await this.checks.find(ChangeStackId.of(stackId));
      const changed = found ? change(found) : null;

      if (!changed || changed === found) {
        return null;
      }

      try {
        await this.checks.save(changed);
        return changed;
      } catch (error) {
        if (!(error instanceof StackCheckMovedOnError) || attempt >= ATTEMPTS) {
          throw error;
        }
      }
    }
  }
}
