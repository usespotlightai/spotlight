import type { PatchWriterPort } from '@change-review/application/ports/patch-writer.port';
import { revisedPushDiff } from '@change-review/application/services/revised-push-diff';
import type { PushDiff } from '@change-review/domain/aggregates/push-diff.aggregate';
import type { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import { PushDiffVersionConflictError } from '@change-review/domain/exceptions/push-diff-version-conflict.error';
import { StackCheckVersionConflictError } from '@change-review/domain/exceptions/stack-check-version-conflict.error';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { PushDiffRepository } from '@change-review/domain/repositories/push-diff.repository';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import {
  type ReviewWorkItem,
  reviewWorkOrder,
} from '@change-review/domain/services/review-work-order';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { PushDiffId } from '@change-review/domain/value-objects/push-diff-id.vo';
import { StackCheckId } from '@change-review/domain/value-objects/stack-check-id.vo';
import type {
  ReviewWorkLeaseRenewal,
  ReviewWork,
  ReviewWorkLease,
  ReviewWorkPort,
  ClaimedCheck,
  ClaimedReviewWork,
  ClaimedPushDiff,
} from '@runs/application/ports/review-work.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ReviewWorkId } from '@shared-kernel/domain/value-objects/review-work-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const ATTEMPTS = 3;

export class ClaimReviewWork implements ReviewWorkPort {
  constructor(
    private readonly checks: StackCheckRepository,
    private readonly stacks: ChangeStackRepository,
    private readonly patches: PatchWriterPort,
    private readonly transaction: TransactionPort,
    private readonly diffs: PushDiffRepository,
  ) {}

  async waitingPlacements(
    workspaceId: WorkspaceId,
    now: Date,
  ): Promise<readonly RunnerPlacement[]> {
    const [diffs, checks] = await Promise.all([
      this.diffs.waitingIn(workspaceId),
      this.checks.waitingIn(workspaceId),
    ]);

    return [
      ...diffs
        .filter((each) => each.claimableAt(now))
        .map((each) => each.placement),
      ...checks
        .filter((each) => each.claimableAt(now))
        .map((each) => each.request.placement),
    ];
  }

  claimNext(
    workspaceId: WorkspaceId,
    runner: RunnerId,
    offer: RunnerOffer,
    now: Date,
  ): Promise<ClaimedReviewWork | null> {
    return this.transaction.inTransaction(async () =>
      this.firstClaimed(
        reviewWorkOrder(
          await this.diffs.waitingIn(workspaceId),
          await this.checks.waitingIn(workspaceId),
        ),
        runner,
        offer,
        now,
      ),
    );
  }

  claimReserved(
    runner: RunnerId,
    offer: RunnerOffer,
    now: Date,
  ): Promise<ClaimedReviewWork | null> {
    return this.transaction.inTransaction(async () =>
      this.firstClaimed(
        reviewWorkOrder(
          (await this.diffs.reservedFor(runner)).filter(
            (each) => each.reservation?.isActiveAt(now) === true,
          ),
          (await this.checks.reservedFor(runner)).filter(
            (each) => each.reservation?.isActiveAt(now) === true,
          ),
        ),
        runner,
        offer,
        now,
      ),
    );
  }

  private async firstClaimed(
    candidates: readonly ReviewWorkItem[],
    runner: RunnerId,
    offer: RunnerOffer,
    now: Date,
  ): Promise<ClaimedReviewWork | null> {
    for (const due of candidates) {
      const claimed =
        due.kind === 'diff'
          ? await this.diffClaimed(due.diff, runner, offer, now)
          : await this.checkClaimed(due.check, runner, offer, now);

      if (claimed) {
        return claimed;
      }
    }

    return null;
  }

  private async diffClaimed(
    due: PushDiff,
    runner: RunnerId,
    offer: RunnerOffer,
    now: Date,
  ): Promise<ClaimedPushDiff | null> {
    if (!due.claimableBy(runner, offer, now)) {
      return null;
    }

    try {
      await this.diffs.save(due.claimedFor(runner, offer, now));

      return {
        kind: 'diff',
        diffId: ReviewWorkId.of(due.id.value),
        repository: due.repository.value,
        baseTip: due.push.baseTip.value,
        head: due.push.head.value,
      };
    } catch (error) {
      if (error instanceof PushDiffVersionConflictError) {
        return null;
      }

      throw error;
    }
  }

  private async checkClaimed(
    due: StackCheck,
    runner: RunnerId,
    offer: RunnerOffer,
    now: Date,
  ): Promise<ClaimedCheck | null> {
    if (!due.claimableBy(runner, offer, now)) {
      return null;
    }

    try {
      return await this.claimed(due, runner, offer, now);
    } catch (error) {
      if (error instanceof StackCheckVersionConflictError) {
        return null;
      }

      throw error;
    }
  }

  async unclaim(work: ReviewWork, runner: RunnerId, now: Date): Promise<void> {
    if (work.kind === 'diff') {
      await revisedPushDiff(this.diffs, PushDiffId.of(work.id.value), (diff) =>
        diff.beingDiffedBy(runner, now) ? diff.unclaimedBy(runner, now) : null,
      );
      return;
    }

    for (let attempt = 1; ; attempt++) {
      const existing = await this.checks.find(
        StackCheckId.of(ChangeStackId.of(work.id.value), work.recheck),
      );

      if (!existing?.beingCheckedBy(runner, now)) {
        return;
      }

      try {
        await this.checks.save(existing.unclaimedBy(runner, now));
        return;
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

  async isLeasedBy(
    lease: ReviewWorkLease,
    runner: RunnerId,
    now: Date,
  ): Promise<boolean> {
    if (lease.kind === 'diff') {
      const diff = await this.diffs.find(PushDiffId.of(lease.id.value));

      return diff?.beingDiffedBy(runner, now) ?? false;
    }

    return (await this.checks.ofStack(ChangeStackId.of(lease.id.value))).some(
      (each) => each.beingCheckedBy(runner, now),
    );
  }

  async renewLease(
    work: ReviewWork,
    runner: RunnerId,
    now: Date,
  ): Promise<ReviewWorkLeaseRenewal> {
    if (work.kind === 'diff') {
      return (await revisedPushDiff(
        this.diffs,
        PushDiffId.of(work.id.value),
        (diff) =>
          diff.beingDiffedBy(runner, now) ? diff.renewedFor(runner, now) : null,
      ))
        ? 'renewed'
        : 'stop';
    }

    for (let attempt = 1; ; attempt++) {
      const check = await this.checks.find(
        StackCheckId.of(ChangeStackId.of(work.id.value), work.recheck),
      );

      if (!check?.beingCheckedBy(runner, now) || !check.checkableAt(now)) {
        return 'stop';
      }

      try {
        await this.checks.save(check.renewedFor(runner, now));
        return 'renewed';
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

  private async claimed(
    due: StackCheck,
    runner: RunnerId,
    offer: RunnerOffer,
    now: Date,
  ): Promise<ClaimedCheck | null> {
    const stack = await this.stacks.find(due.stackId);

    if (!stack) {
      return null;
    }

    const claimed = due.claimedFor(runner, offer, now);
    await this.checks.save(claimed);

    return {
      kind: 'check',
      checkId: ReviewWorkId.of(stack.id.value),
      recheck: claimed.recheck,
      repository: stack.repository?.value ?? null,
      base: stack.base?.value ?? null,
      setup: claimed.request.setup,
      command: claimed.request.command,
      steps: stack.checkSteps(claimed.entries).map((step) => ({
        id: step.id,
        patch: this.patches.patchOf(stack.diff, new Set(step.hunks)),
        stopsOnFailure: step.stopsOnFailure,
        runsSetup: step.runsSetup,
      })),
    };
  }
}
