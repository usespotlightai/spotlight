import { ChangeStackBecameReady } from '@change-review/domain/events/change-stack-became-ready.event';
import { ChangeStackCompleted } from '@change-review/domain/events/change-stack-completed.event';
import { ChangeStackRedrafted } from '@change-review/domain/events/change-stack-redrafted.event';
import { ChangeStackRedraftingEnded } from '@change-review/domain/events/change-stack-redrafting-ended.event';
import { DecisionDisputed } from '@change-review/domain/events/decision-disputed.event';
import { DecisionsRecorded } from '@change-review/domain/events/decisions-recorded.event';
import { IncludedCommentPosted } from '@change-review/domain/events/included-comment-posted.event';
import { IncludedCommentReturned } from '@change-review/domain/events/included-comment-returned.event';
import { LeasedStackCheckDeleted } from '@change-review/domain/events/leased-stack-check-deleted.event';
import { ReviewCommentDeleted } from '@change-review/domain/events/review-comment-deleted.event';
import { ReviewCommentEdited } from '@change-review/domain/events/review-comment-edited.event';
import { ReviewCommentReplied } from '@change-review/domain/events/review-comment-replied.event';
import { ReviewPosted } from '@change-review/domain/events/review-posted.event';
import { ReviewSubmitted } from '@change-review/domain/events/review-submitted.event';
import { StackCheckLayersFailed } from '@change-review/domain/events/stack-check-layers-failed.event';
import { StackCheckReservationDropped } from '@change-review/domain/events/stack-check-reservation-dropped.event';
import { StackChecked } from '@change-review/domain/events/stack-checked.event';
import { TrialStackSettled } from '@change-review/domain/events/trial-stack-settled.event';
import { AuthorName } from '@change-review/domain/value-objects/author-name.vo';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckClaim } from '@change-review/domain/value-objects/check-claim.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { CommitSha } from '@change-review/domain/value-objects/commit-sha.vo';
import { DecisionDisputeId } from '@change-review/domain/value-objects/decision-dispute-id.vo';
import { DecisionEvidence } from '@change-review/domain/value-objects/decision-evidence.vo';
import { DecisionGeneration } from '@change-review/domain/value-objects/decision-generation.vo';
import { DecisionId } from '@change-review/domain/value-objects/decision-id.vo';
import { DecisionMerge } from '@change-review/domain/value-objects/decision-merge.vo';
import { DecisionSetId } from '@change-review/domain/value-objects/decision-set-id.vo';
import { DecisionStatus } from '@change-review/domain/value-objects/decision-status.vo';
import { DeliveryAttempts } from '@change-review/domain/value-objects/delivery-attempts.vo';
import { DeliveryFailure } from '@change-review/domain/value-objects/delivery-failure.vo';
import { Diff } from '@change-review/domain/value-objects/diff.vo';
import { FilePath } from '@change-review/domain/value-objects/file-path.vo';
import { QuestionAnswerId } from '@change-review/domain/value-objects/question-answer-id.vo';
import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import { ReviewAnchor } from '@change-review/domain/value-objects/review-anchor.vo';
import { ReviewAuthor } from '@change-review/domain/value-objects/review-author.vo';
import { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import { ReviewDeliveryId } from '@change-review/domain/value-objects/review-delivery-id.vo';
import { ReviewId } from '@change-review/domain/value-objects/review-id.vo';
import { StackCheckId } from '@change-review/domain/value-objects/stack-check-id.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { StackProgress } from '@change-review/domain/value-objects/stack-progress.vo';
import { TeamStanding } from '@change-review/domain/value-objects/team-standing.vo';
import { WorkspacePath } from '@change-review/domain/value-objects/workspace-path.vo';

export const CHANGE_REVIEW_PAYLOAD_TYPES = [
  AuthorName,
  ChangeStackId,
  CheckClaim,
  Diff,
  RepositoryName,
  ReviewAnchor,
  QuestionAnswerId,
  ReviewCommentId,
  ReviewId,
  ReviewDeliveryId,
  ReviewAuthor,
  CheckRequest,
  StackFacts,
  StackProgress,
  StackCheckId,
  StackChecked,
  TrialStackSettled,
  ChangeStackRedrafted,
  ChangeStackRedraftingEnded,
  ChangeStackCompleted,
  ChangeStackBecameReady,
  StackCheckReservationDropped,
  LeasedStackCheckDeleted,
  StackCheckLayersFailed,
  IncludedCommentReturned,
  IncludedCommentPosted,
  ReviewCommentDeleted,
  ReviewCommentReplied,
  ReviewCommentEdited,
  ReviewPosted,
  ReviewSubmitted,
  DecisionId,
  DecisionGeneration,
  DecisionEvidence,
  DecisionMerge,
  CommitSha,
  FilePath,
  WorkspacePath,
  DecisionSetId,
  DecisionStatus,
  DeliveryAttempts,
  DeliveryFailure,
  DecisionsRecorded,
  DecisionDisputeId,
  DecisionDisputed,
  TeamStanding,
] as const;
