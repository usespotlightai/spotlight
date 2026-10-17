import { ChangeStackChecked } from '@change-review/domain/events/change-stack-checked.event';
import { ChangeStackCompleted } from '@change-review/domain/events/change-stack-completed.event';
import { ChangeStackDraftingBegan } from '@change-review/domain/events/change-stack-drafting-began.event';
import { ChangeStackFailed } from '@change-review/domain/events/change-stack-failed.event';
import { ChangeStackReady } from '@change-review/domain/events/change-stack-ready.event';
import { ChangeStackReordered } from '@change-review/domain/events/change-stack-reordered.event';
import { ChangeStackReorderingEnded } from '@change-review/domain/events/change-stack-reordering-ended.event';
import { CheckReservationDropped } from '@change-review/domain/events/check-reservation-dropped.event';
import { DecisionDisputed } from '@change-review/domain/events/decision-disputed.event';
import { DecisionDraftingFailed } from '@change-review/domain/events/decision-drafting-failed.event';
import { DecisionsDiscarded } from '@change-review/domain/events/decisions-discarded.event';
import { DecisionsMerged } from '@change-review/domain/events/decisions-merged.event';
import { DecisionsRecorded } from '@change-review/domain/events/decisions-recorded.event';
import { DecisionsRequested } from '@change-review/domain/events/decisions-requested.event';
import { LayersFailedCheck } from '@change-review/domain/events/layers-failed-check.event';
import { LeasedCheckDeleted } from '@change-review/domain/events/leased-check-deleted.event';
import { ReplayStackCompleted } from '@change-review/domain/events/replay-stack-completed.event';
import { ReviewCommentNotPosted } from '@change-review/domain/events/review-comment-not-posted.event';
import { ReviewCommentPlaced } from '@change-review/domain/events/review-comment-placed.event';
import { ReviewCommentRemoved } from '@change-review/domain/events/review-comment-removed.event';
import { ReviewCommentReplied } from '@change-review/domain/events/review-comment-replied.event';
import { ReviewCommentRewritten } from '@change-review/domain/events/review-comment-rewritten.event';
import { ReviewPosted } from '@change-review/domain/events/review-posted.event';
import { ReviewSubmitted } from '@change-review/domain/events/review-submitted.event';
import { AuthorName } from '@change-review/domain/value-objects/author-name.vo';
import { BaseCommit } from '@change-review/domain/value-objects/base-commit.vo';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckClaim } from '@change-review/domain/value-objects/check-claim.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { DecisionDisputeId } from '@change-review/domain/value-objects/decision-dispute-id.vo';
import { DecisionDraft } from '@change-review/domain/value-objects/decision-draft.vo';
import { DecisionGrounds } from '@change-review/domain/value-objects/decision-grounds.vo';
import { DecisionId } from '@change-review/domain/value-objects/decision-id.vo';
import { DecisionMerge } from '@change-review/domain/value-objects/decision-merge.vo';
import { DecisionSetId } from '@change-review/domain/value-objects/decision-set-id.vo';
import { DecisionStatus } from '@change-review/domain/value-objects/decision-status.vo';
import { Diff } from '@change-review/domain/value-objects/diff.vo';
import { FilePath } from '@change-review/domain/value-objects/file-path.vo';
import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import { ReviewAnchor } from '@change-review/domain/value-objects/review-anchor.vo';
import { ReviewAuthor } from '@change-review/domain/value-objects/review-author.vo';
import { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import { ReviewId } from '@change-review/domain/value-objects/review-id.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { StackProgress } from '@change-review/domain/value-objects/stack-progress.vo';

export const CHANGE_REVIEW_PAYLOAD_TYPES = [
  AuthorName,
  BaseCommit,
  ChangeStackId,
  CheckClaim,
  Diff,
  RepositoryName,
  ReviewAnchor,
  ReviewCommentId,
  ReviewId,
  ReviewAuthor,
  CheckRequest,
  StackFacts,
  StackProgress,
  ChangeStackChecked,
  ReplayStackCompleted,
  ChangeStackDraftingBegan,
  ChangeStackFailed,
  ChangeStackReordered,
  ChangeStackReorderingEnded,
  ChangeStackCompleted,
  ChangeStackReady,
  CheckReservationDropped,
  LeasedCheckDeleted,
  LayersFailedCheck,
  ReviewCommentNotPosted,
  ReviewCommentPlaced,
  ReviewCommentRemoved,
  ReviewCommentReplied,
  ReviewCommentRewritten,
  ReviewPosted,
  ReviewSubmitted,
  DecisionId,
  DecisionDraft,
  DecisionGrounds,
  DecisionMerge,
  FilePath,
  DecisionSetId,
  DecisionStatus,
  DecisionDraftingFailed,
  DecisionsRequested,
  DecisionsDiscarded,
  DecisionsRecorded,
  DecisionsMerged,
  DecisionDisputeId,
  DecisionDisputed,
] as const;
