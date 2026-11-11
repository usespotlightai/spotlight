import type { GitHubDelivery } from '@github/application/dto/github-delivery.dto';
import type { PullRequestActivity } from '@github/application/dto/pull-request-activity.dto';
import type { PullRequestSnapshot } from '@github/domain/aggregates/pull-request.aggregate';
import type {
  CommentAction,
  ReceivedComment,
} from '@github/domain/events/review-comment-received.event';
import type { PullRequestThread } from '@github/domain/value-objects/pull-request-thread.vo';
import type { ReviewState } from '@github/domain/value-objects/review-state.vo';

export const WEBHOOK_PARSER = Symbol('WEBHOOK_PARSER');

type WebhookReviewComment = ReceivedComment & { readonly byBot: boolean };

export type WebhookEvent =
  | { readonly kind: 'installation-removed' }
  | {
      readonly kind: 'review-comment';
      readonly action: CommentAction;
      readonly pullRequest: string;
      readonly comment: WebhookReviewComment;
      readonly snapshot: PullRequestSnapshot | null;
    }
  | {
      readonly kind: 'conversation-comment';
      readonly action: CommentAction;
      readonly pullRequest: string;
      readonly comment: {
        readonly id: number;
        readonly login: string | null;
        readonly byBot: boolean;
      };
    }
  | {
      readonly kind: 'review-thread';
      readonly pullRequest: string;
      readonly thread: PullRequestThread;
      readonly snapshot: PullRequestSnapshot | null;
    }
  | { readonly kind: 'pull-request'; readonly snapshot: PullRequestSnapshot }
  | {
      readonly kind: 'pull-request-closed';
      readonly pullRequest: string;
      readonly repository: string;
      readonly gitHubId: number | null;
      readonly merge: { readonly commit: string } | null;
      readonly closedAt: Date | null;
    }
  | {
      readonly kind: 'pull-request-reopened';
      readonly pullRequest: string;
      readonly repository: string;
      readonly gitHubId: number | null;
      readonly reopenedAt: Date | null;
    }
  | {
      readonly kind: 'pull-request-reviewed';
      readonly pullRequest: string;
      readonly id: number | null;
      readonly snapshot: PullRequestSnapshot | null;
      readonly state: ReviewState;
      readonly login: string | null;
      readonly byBot: boolean;
      readonly submittedAt: Date | null;
    }
  | {
      readonly kind: 'pull-request-review-dismissed';
      readonly pullRequest: string;
      readonly id: number;
      readonly snapshot: PullRequestSnapshot | null;
    }
  | {
      readonly kind: 'pull-request-activity';
      readonly activity: PullRequestActivity;
    };

export interface ParsedDelivery {
  readonly installation: string | null;
  readonly events: readonly WebhookEvent[];
}

export interface WebhookParserPort {
  idOf(delivery: GitHubDelivery): string;

  signatureOf(delivery: GitHubDelivery): string | undefined;

  parse(delivery: GitHubDelivery): ParsedDelivery;
}
