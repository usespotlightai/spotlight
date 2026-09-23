import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import { ChangeStackChecked } from '@change-review/domain/events/change-stack-checked.event';
import { ChangeStackDraftingBegan } from '@change-review/domain/events/change-stack-drafting-began.event';
import { ChangeStackFailed } from '@change-review/domain/events/change-stack-failed.event';
import { ChangeStackReordered } from '@change-review/domain/events/change-stack-reordered.event';
import { ChangeStackReorderingEnded } from '@change-review/domain/events/change-stack-reordering-ended.event';
import { ChangeStackSettled } from '@change-review/domain/events/change-stack-settled.event';
import { DecisionDisputed } from '@change-review/domain/events/decision-disputed.event';
import { DecisionDraftingFailed } from '@change-review/domain/events/decision-drafting-failed.event';
import { DecisionsAsked } from '@change-review/domain/events/decisions-asked.event';
import { DecisionsDiscarded } from '@change-review/domain/events/decisions-discarded.event';
import { DecisionsRecorded } from '@change-review/domain/events/decisions-recorded.event';
import { DecisionsStood } from '@change-review/domain/events/decisions-stood.event';
import { LayersFailedCheck } from '@change-review/domain/events/layers-failed-check.event';
import { ReviewCommentRemoved } from '@change-review/domain/events/review-comment-removed.event';
import { ReviewCommentReplied } from '@change-review/domain/events/review-comment-replied.event';
import { ReviewCommentRewritten } from '@change-review/domain/events/review-comment-rewritten.event';
import { ReviewNotPosted } from '@change-review/domain/events/review-not-posted.event';
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
import { DecisionStanding } from '@change-review/domain/value-objects/decision-standing.vo';
import { Diff } from '@change-review/domain/value-objects/diff.vo';
import { FilePath } from '@change-review/domain/value-objects/file-path.vo';
import { OwedWork } from '@change-review/domain/value-objects/owed-work.vo';
import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import { ReviewAnchor } from '@change-review/domain/value-objects/review-anchor.vo';
import { ReviewAuthor } from '@change-review/domain/value-objects/review-author.vo';
import { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import { ReviewId } from '@change-review/domain/value-objects/review-id.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { StackProgress } from '@change-review/domain/value-objects/stack-progress.vo';

export const CHANGE_REVIEW_EVENT_TYPES = [
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
  StackCheck,
  StackFacts,
  StackProgress,
  OwedWork,
  ChangeStackChecked,
  ChangeStackDraftingBegan,
  ChangeStackFailed,
  ChangeStackReordered,
  ChangeStackReorderingEnded,
  ChangeStackSettled,
  LayersFailedCheck,
  ReviewCommentRemoved,
  ReviewCommentReplied,
  ReviewCommentRewritten,
  ReviewNotPosted,
  ReviewPosted,
  ReviewSubmitted,
  DecisionId,
  DecisionDraft,
  DecisionGrounds,
  DecisionMerge,
  FilePath,
  DecisionSetId,
  DecisionStanding,
  DecisionDraftingFailed,
  DecisionsAsked,
  DecisionsDiscarded,
  DecisionsRecorded,
  DecisionsStood,
  DecisionDisputeId,
  DecisionDisputed,
] as const;
