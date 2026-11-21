import { revisedPushDiff } from '@change-review/application/services/revised-push-diff';
import type { PushDiff } from '@change-review/domain/aggregates/push-diff.aggregate';
import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import { PushDiffVersionConflictError } from '@change-review/domain/exceptions/push-diff-version-conflict.error';
import { StackCheckVersionConflictError } from '@change-review/domain/exceptions/stack-check-version-conflict.error';
import type { PushDiffRepository } from '@change-review/domain/repositories/push-diff.repository';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import {
  comesBefore,
  placeOf,
  type ReviewWorkPlace,
  reviewWorkOrder,
} from '@change-review/domain/services/review-work-order';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { PushDiffId } from '@change-review/domain/value-objects/push-diff-id.vo';
import { StackCheckId } from '@change-review/domain/value-objects/stack-check-id.vo';
import type {
  ExpiredReviewWork,
  ReviewWorkCursor,
  ReviewWorkPage,
  ReviewWorkProvisioningPort,
  WaitingReviewWork,
} from '@runs/application/ports/review-work-provisioning.port';
import type { ReviewWork } from '@runs/application/ports/review-work.port';
import type { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import type { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import { ReviewWorkId } from '@shared-kernel/domain/value-objects/review-work-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const ATTEMPTS = 3;

// A cursor is the place of the last item of a page. The place, not an offset, so an item that leaves the queue moves no other item back past the cursor.
const cursorAt = (place: ReviewWorkPlace): ReviewWorkCursor =>
  JSON.stringify([place.rank, place.at, place.tie]);

// The place a cursor names, or null for one that this service did not give, so that the page starts at the head.
const placeAt = (cursor: ReviewWorkCursor): ReviewWorkPlace | null => {
  try {
    const read: unknown = JSON.parse(cursor);

    if (
      Array.isArray(read) &&
      read.length === 3 &&
      typeof read[0] === 'number' &&
      typeof read[1] === 'number' &&
      typeof read[2] === 'string'
    ) {
      return { rank: read[0], at: read[1], tie: read[2] };
    }
  } catch {
    // A cursor that is not JSON names no place.
  }

  return null;
};

const diffWork = (diff: PushDiff): ReviewWork => ({
  kind: 'diff',
  id: ReviewWorkId.of(diff.id.value),
});

const checkWork = (check: StackCheck): ReviewWork => ({
  kind: 'check',
  id: ReviewWorkId.of(check.stackId.value),
  recheck: check.recheck,
});

export class ProvisionReviewWork implements ReviewWorkProvisioningPort {
  constructor(
    private readonly checks: StackCheckRepository,
    private readonly diffs: PushDiffRepository,
  ) {}

  async awaiting(
    workspaceId: WorkspaceId,
    now: Date,
    page: { readonly after: ReviewWorkCursor | null; readonly max: number },
  ): Promise<ReviewWorkPage> {
    const [diffs, checks] = await Promise.all([
      this.diffs.waitingIn(workspaceId),
      this.checks.waitingIn(workspaceId),
    ]);
    const ordered = reviewWorkOrder(
      diffs.filter((each) => each.provisionableAt(now)),
      checks.filter((each) => each.provisionableAt(now)),
    );
    const after = page.after === null ? null : placeAt(page.after);
    const read = (
      after === null
        ? ordered
        : ordered.filter((each) => comesBefore(after, placeOf(each)))
    ).slice(0, page.max);
    const last = read[read.length - 1];

    return {
      waiting: read.map((each): WaitingReviewWork =>
        each.kind === 'diff'
          ? {
              work: diffWork(each.diff),
              runId: null,
              placement: each.diff.placement,
            }
          : {
              work: checkWork(each.check),
              runId: each.check.runId,
              placement: each.check.request.placement,
            },
      ),
      next: last ? cursorAt(placeOf(last)) : null,
    };
  }

  async workspacesAwaiting(now: Date): Promise<readonly WorkspaceId[]> {
    const [diffs, checks] = await Promise.all([
      this.diffs.workspacesWaiting(now),
      this.checks.workspacesWaiting(now),
    ]);
    const unique = new Map(
      [...diffs, ...checks].map((each) => [each.value, each]),
    );

    return [...unique.values()];
  }

  async reserve(
    work: ReviewWork,
    runner: RunnerId,
    pool: PoolId,
    now: Date,
  ): Promise<Date | null> {
    try {
      const reserved =
        work.kind === 'diff'
          ? await revisedPushDiff(
              this.diffs,
              PushDiffId.of(work.id.value),
              (found) =>
                found.provisionableAt(now)
                  ? found.reservedFor(runner, pool, now)
                  : found,
            )
          : await this.revised(work, (found) =>
              found.provisionableAt(now)
                ? found.reservedFor(runner, pool, now)
                : found,
            );

      return reserved?.reservation?.until ?? null;
    } catch (error) {
      if (
        error instanceof StackCheckVersionConflictError ||
        error instanceof PushDiffVersionConflictError
      ) {
        return null;
      }

      throw error;
    }
  }

  async unreserve(work: ReviewWork, runner: RunnerId): Promise<void> {
    if (work.kind === 'diff') {
      await revisedPushDiff(this.diffs, PushDiffId.of(work.id.value), (found) =>
        found.unreservedFor(runner),
      );
    } else {
      await this.revised(work, (found) => found.unreservedFor(runner));
    }
  }

  async failed(
    work: ReviewWork,
    runner: RunnerId,
    failure: ProvisionFailure,
    now: Date,
  ): Promise<void> {
    if (work.kind === 'diff') {
      await revisedPushDiff(this.diffs, PushDiffId.of(work.id.value), (found) =>
        found.provisionFailed(runner, failure, now),
      );
    } else {
      await this.revised(work, (found) =>
        found.provisionFailed(runner, failure, now),
      );
    }
  }

  async expired(now: Date): Promise<readonly ExpiredReviewWork[]> {
    const diffs = (await this.diffs.reserved()).flatMap((each) =>
      each.reservation && each.reservationExpiredAt(now)
        ? [
            {
              work: diffWork(each),
              runner: each.reservation.runner,
              until: each.reservation.until,
            },
          ]
        : [],
    );

    return [
      ...diffs,
      ...(await this.checks.reserved()).flatMap((each) =>
        each.reservation && each.reservationExpiredAt(now)
          ? [
              {
                work: checkWork(each),
                runner: each.reservation.runner,
                until: each.reservation.until,
              },
            ]
          : [],
      ),
    ];
  }

  private async revised(
    work: Extract<ReviewWork, { kind: 'check' }>,
    change: (check: StackCheck) => StackCheck,
  ): Promise<StackCheck | null> {
    const id = StackCheckId.of(ChangeStackId.of(work.id.value), work.recheck);

    for (let attempt = 1; ; attempt++) {
      const found = await this.checks.find(id);
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
