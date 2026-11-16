import type { ReviewWorkId } from '@shared-kernel/domain/value-objects/review-work-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const REVIEW_WORK = Symbol('REVIEW_WORK');

interface ClaimedCheckStep {
  readonly id: string;
  readonly patch: string;
  readonly stopsOnFailure: boolean;
  readonly runsSetup: boolean;
}

export interface ClaimedCheck {
  readonly kind: 'check';
  readonly checkId: ReviewWorkId;
  readonly recheck: boolean;
  readonly repository: string | null;
  readonly base: string | null;
  readonly setup: string | null;
  readonly command: string;
  readonly steps: readonly ClaimedCheckStep[];
}

export interface ClaimedPushDiff {
  readonly kind: 'diff';
  readonly diffId: ReviewWorkId;
  readonly repository: string;
  readonly baseTip: string;
  readonly head: string;
}

export type ClaimedReviewWork = ClaimedCheck | ClaimedPushDiff;

export type ReviewWork =
  | {
      readonly kind: 'check';
      readonly id: ReviewWorkId;
      readonly recheck: boolean;
    }
  | { readonly kind: 'diff'; readonly id: ReviewWorkId };

export interface ReviewWorkLease {
  readonly kind: ReviewWork['kind'];
  readonly id: ReviewWorkId;
}

export const claimedWork = (claimed: ClaimedReviewWork): ReviewWork =>
  claimed.kind === 'check'
    ? { kind: 'check', id: claimed.checkId, recheck: claimed.recheck }
    : { kind: 'diff', id: claimed.diffId };

export type ReviewWorkLeaseRenewal = 'renewed' | 'stop';

export interface ReviewWorkPort {
  claimNext(
    workspaceId: WorkspaceId,
    runner: RunnerId,
    offer: RunnerOffer,
    now: Date,
  ): Promise<ClaimedReviewWork | null>;

  claimReserved(
    runner: RunnerId,
    offer: RunnerOffer,
    now: Date,
  ): Promise<ClaimedReviewWork | null>;

  unclaim(work: ReviewWork, runner: RunnerId, now: Date): Promise<void>;

  renewLease(
    work: ReviewWork,
    runner: RunnerId,
    now: Date,
  ): Promise<ReviewWorkLeaseRenewal>;

  isLeasedBy(
    lease: ReviewWorkLease,
    runner: RunnerId,
    now: Date,
  ): Promise<boolean>;

  waitingPlacements(
    workspaceId: WorkspaceId,
    now: Date,
  ): Promise<readonly RunnerPlacement[]>;
}
