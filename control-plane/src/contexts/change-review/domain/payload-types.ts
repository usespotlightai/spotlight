import { ChangeStackChecked } from '@change-review/domain/events/change-stack-checked.event';
import { ChangeStackCompleted } from '@change-review/domain/events/change-stack-completed.event';
import { ChangeStackFailed } from '@change-review/domain/events/change-stack-failed.event';
import { ChangeStackGenerationStarted } from '@change-review/domain/events/change-stack-generation-started.event';
import { ChangeStackReady } from '@change-review/domain/events/change-stack-ready.event';
import { ChangeStackRedrafted } from '@change-review/domain/events/change-stack-redrafted.event';
import { ChangeStackRedraftingEnded } from '@change-review/domain/events/change-stack-redrafting-ended.event';
import { CheckReservationDropped } from '@change-review/domain/events/check-reservation-dropped.event';
import { DecisionDisputed } from '@change-review/domain/events/decision-disputed.event';
import { DecisionGenerationFailed } from '@change-review/domain/events/decision-generation-failed.event';
import { DecisionsDiscarded } from '@change-review/domain/events/decisions-discarded.event';
import { DecisionsMerged } from '@change-review/domain/events/decisions-merged.event';
import { DecisionsRecorded } from '@change-review/domain/events/decisions-recorded.event';
import { DecisionsRequested } from '@change-review/domain/events/decisions-requested.event';
import { LayersFailedCheck } from '@change-review/domain/events/layers-failed-check.event';
import { LeasedCheckDeleted } from '@change-review/domain/events/leased-check-deleted.event';
import { ReplayStackCompleted } from '@change-review/domain/events/replay-stack-completed.event';
import { ReviewCommentDeleted } from '@change-review/domain/events/review-comment-deleted.event';
import { ReviewCommentEdited } from '@change-review/domain/events/review-comment-edited.event';
import { ReviewCommentNotPosted } from '@change-review/domain/events/review-comment-not-posted.event';
import { ReviewCommentPosted } from '@change-review/domain/events/review-comment-posted.event';
import { ReviewCommentReplied } from '@change-review/domain/events/review-comment-replied.event';
import { ReviewPosted } from '@change-review/domain/events/review-posted.event';
import { ReviewSubmitted } from '@change-review/domain/events/review-submitted.event';
import { AuthorName } from '@change-review/domain/value-objects/author-name.vo';
import { BaseCommit } from '@change-review/domain/value-objects/base-commit.vo';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckClaim } from '@change-review/domain/value-objects/check-claim.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { DecisionDisputeId } from '@change-review/domain/value-objects/decision-dispute-id.vo';
import { DecisionEvidence } from '@change-review/domain/value-objects/decision-evidence.vo';
import { DecisionGeneration } from '@change-review/domain/value-objects/decision-generation.vo';
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
  ChangeStackGenerationStarted,
  ChangeStackFailed,
  ChangeStackRedrafted,
  ChangeStackRedraftingEnded,
  ChangeStackCompleted,
  ChangeStackReady,
  CheckReservationDropped,
  LeasedCheckDeleted,
  LayersFailedCheck,
  ReviewCommentNotPosted,
  ReviewCommentPosted,
  ReviewCommentDeleted,
  ReviewCommentReplied,
  ReviewCommentEdited,
  ReviewPosted,
  ReviewSubmitted,
  DecisionId,
  DecisionGeneration,
  DecisionEvidence,
  DecisionMerge,
  FilePath,
  DecisionSetId,
  DecisionStatus,
  DecisionGenerationFailed,
  DecisionsRequested,
  DecisionsDiscarded,
  DecisionsRecorded,
  DecisionsMerged,
  DecisionDisputeId,
  DecisionDisputed,
] as const;
