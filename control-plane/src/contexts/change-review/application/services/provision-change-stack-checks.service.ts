import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import { StackCheckVersionConflictError } from '@change-review/domain/exceptions/stack-check-version-conflict.error';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type {
  CheckProvisioningPort,
  ExpiredCheck,
  WaitingCheck,
} from '@runs/application/ports/check-provisioning.port';
import { CheckWorkId } from '@shared-kernel/domain/value-objects/check-work-id.vo';
import type { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import type { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const ATTEMPTS = 3;

export class ProvisionChangeStackChecks implements CheckProvisioningPort {
  constructor(private readonly checks: StackCheckRepository) {}

  async awaiting(
    workspaceId: WorkspaceId,
    now: Date,
    page: { readonly skip: number; readonly max: number },
  ): Promise<readonly WaitingCheck[]> {
    return (await this.checks.waitingIn(workspaceId))
      .filter((each) => each.provisionableAt(now))
      .slice(page.skip, page.skip + page.max)
      .map((each) => ({
        checkId: CheckWorkId.of(each.stackId.value),
        runId: each.runId,
        placement: each.request.placement,
      }));
  }

  async reserve(
    check: CheckWorkId,
    runner: RunnerId,
    pool: PoolId,
    now: Date,
  ): Promise<Date | null> {
    try {
      const reserved = await this.revised(check, (found) =>
        found.provisionableAt(now)
          ? found.reservedFor(runner, pool, now)
          : found,
      );

      return reserved?.reservation?.until ?? null;
    } catch (error) {
      if (error instanceof StackCheckVersionConflictError) {
        return null;
      }

      throw error;
    }
  }

  async unreserve(check: CheckWorkId, runner: RunnerId): Promise<void> {
    await this.revised(check, (found) => found.unreservedFor(runner));
  }

  async failed(
    check: CheckWorkId,
    runner: RunnerId,
    failure: ProvisionFailure,
    now: Date,
  ): Promise<void> {
    await this.revised(check, (found) =>
      found.provisionFailed(runner, failure, now),
    );
  }

  async expired(now: Date): Promise<readonly ExpiredCheck[]> {
    return (await this.checks.reserved()).flatMap((each) =>
      each.reservation && each.reservationExpiredAt(now)
        ? [
            {
              checkId: CheckWorkId.of(each.stackId.value),
              runner: each.reservation.runner,
              until: each.reservation.until,
            },
          ]
        : [],
    );
  }

  private async revised(
    check: CheckWorkId,
    change: (check: StackCheck) => StackCheck,
  ): Promise<StackCheck | null> {
    for (let attempt = 1; ; attempt++) {
      const found = StackCheck.latestOf(
        await this.checks.ofStack(ChangeStackId.of(check.value)),
      );
      const changed = found ? change(found) : null;

      if (!changed || changed === found) {
        return null;
      }

      try {
        await this.checks.save(changed);
        return changed;
      } catch (error) {
        if (
          !(error instanceof StackCheckVersionConflictError) ||
          attempt >= ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }
}
