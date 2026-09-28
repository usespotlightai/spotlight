import type { PatchWriterPort } from '@change-review/application/ports/patch-writer.port';
import type { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import { StackCheckMovedOnError } from '@change-review/domain/exceptions/stack-check-moved-on.error';
import { UnknownChangeStackError } from '@change-review/domain/exceptions/unknown-change-stack.error';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  CheckLeaseRenewal,
  CheckWorkPort,
  ClaimedCheck,
} from '@work/application/ports/check-work.port';

const ATTEMPTS = 3;

export class ClaimChangeStackCheck implements CheckWorkPort {
  constructor(
    private readonly checks: StackCheckRepository,
    private readonly stacks: ChangeStackRepository,
    private readonly patches: PatchWriterPort,
    private readonly transaction: TransactionPort,
  ) {}

  async waitingPlacements(
    workspaceId: WorkspaceId,
    now: Date,
  ): Promise<readonly RunnerPlacement[]> {
    return (await this.checks.waitingIn(workspaceId, now)).map(
      (each) => each.request.placement,
    );
  }

  claimNext(
    workspaceId: WorkspaceId,
    runner: RunnerId,
    terms: RunnerTerms,
    now: Date,
  ): Promise<ClaimedCheck | null> {
    return this.transaction.run(async () => {
      const due = await this.checks.dueForCheck(
        { workspaceId, runner, terms },
        now,
      );

      return due?.claimableBy(runner, terms, now)
        ? this.claimed(due, runner, terms, now)
        : null;
    });
  }

  claimReserved(
    runner: RunnerId,
    terms: RunnerTerms,
    now: Date,
  ): Promise<ClaimedCheck | null> {
    return this.transaction.run(async () => {
      const due = await this.checks.reservedTo(runner, now);

      return due?.claimableBy(runner, terms, now)
        ? this.claimed(due, runner, terms, now)
        : null;
    });
  }

  async unclaim(stackId: string, runner: RunnerId, now: Date): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      const held = await this.checks.find(ChangeStackId.of(stackId));

      if (!held?.beingCheckedBy(runner, now)) {
        return;
      }

      try {
        await this.checks.save(held.unclaimedBy(runner, now));
        return;
      } catch (error) {
        if (!(error instanceof StackCheckMovedOnError) || attempt >= ATTEMPTS) {
          throw error;
        }
      }
    }
  }

  async renewLease(
    runId: RunId,
    stackId: string,
    runner: RunnerId,
    now: Date,
  ): Promise<CheckLeaseRenewal> {
    for (let attempt = 1; ; attempt++) {
      const check = await this.checks.find(ChangeStackId.of(stackId));

      if (!check?.beingCheckedBy(runner, now) || !check.checkableAt(now)) {
        return 'stop';
      }
      if (!check.runId.equals(runId)) {
        throw new UnknownChangeStackError(
          `run ${runId.value} drafted no change stack ${stackId}`,
        );
      }

      try {
        await this.checks.save(check.renewedFor(runner, now));
        return 'renewed';
      } catch (error) {
        if (!(error instanceof StackCheckMovedOnError) || attempt >= ATTEMPTS) {
          throw error;
        }
      }
    }
  }

  private async claimed(
    due: StackCheck,
    runner: RunnerId,
    terms: RunnerTerms,
    now: Date,
  ): Promise<ClaimedCheck | null> {
    const stack = await this.stacks.find(due.stackId);

    if (!stack) {
      await this.checks.remove(due.forgotten(now));
      return null;
    }

    const claimed = due.claimedFor(runner, terms, now);
    await this.checks.save(claimed);

    return {
      stackId: stack.id.value,
      runId: stack.runId.value,
      repository: stack.repository?.value ?? null,
      base: stack.base?.value ?? null,
      setup: claimed.request.setup,
      command: claimed.request.command,
      steps: stack.checkSteps(claimed.entries).map((step) => ({
        id: step.id,
        patch: this.patches.patchOf(stack.diff, new Set(step.hunks)),
        stopsOnFailure: step.isWholeChange,
        runsSetup: step.installsAnew,
      })),
    };
  }
}
