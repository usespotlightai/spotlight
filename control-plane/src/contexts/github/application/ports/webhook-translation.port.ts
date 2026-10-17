import type { GitHubDelivery } from '@github/application/dto/github-delivery.dto';
import type { PullRequestActivity } from '@github/application/dto/pull-request-activity.dto';
import type { PullRequestFacts } from '@github/domain/aggregates/pull-request.aggregate';
import type { PullRequestThread } from '@github/domain/value-objects/bot-activity.vo';

export const WEBHOOK_TRANSLATION = Symbol('WEBHOOK_TRANSLATION');

type ReviewCommentAction = 'created' | 'edited' | 'deleted';

type WebhookPlace =
  | { readonly subject: 'file' }
  | {
      readonly subject: 'line';
      readonly side: 'old' | 'new';
      readonly line: number | null;
      readonly startLine: number | null;
    };

type WebhookReviewComment = {
  readonly id: number;
  readonly url: string;
  readonly path: string;
  readonly body: string;
  readonly answers: number | null;
  readonly login: string | null;
  readonly byBot: boolean;
  readonly writtenAt: Date | null;
} & WebhookPlace;

export type WebhookEvent =
  | { readonly kind: 'installation-removed' }
  | {
      readonly kind: 'review-comment';
      readonly action: ReviewCommentAction;
      readonly pullRequest: string;
      readonly comment: WebhookReviewComment;
      readonly facts: PullRequestFacts | null;
    }
  | {
      readonly kind: 'conversation-comment';
      readonly action: ReviewCommentAction;
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
      readonly facts: PullRequestFacts | null;
    }
  | { readonly kind: 'pull-request'; readonly facts: PullRequestFacts }
  | {
      readonly kind: 'pull-request-closed';
      readonly pullRequest: string;
      readonly repository: string;
      readonly merge: { readonly commit: string } | null;
      readonly closedAt: Date | null;
    }
  | {
      readonly kind: 'pull-request-reviewed';
      readonly pullRequest: string;
      readonly id: number | null;
      readonly facts: PullRequestFacts | null;
      readonly state: 'approved' | 'changes-requested' | 'commented';
      readonly login: string | null;
      readonly byBot: boolean;
      readonly submittedAt: Date | null;
    }
  | {
      readonly kind: 'pull-request-review-dismissed';
      readonly pullRequest: string;
      readonly id: number;
      readonly facts: PullRequestFacts | null;
    }
  | {
      readonly kind: 'pull-request-activity';
      readonly activity: PullRequestActivity;
    };

export interface TranslatedDelivery {
  readonly installation: string | null;
  readonly events: readonly WebhookEvent[];
}

export interface WebhookTranslationPort {
  idOf(delivery: GitHubDelivery): string;

  signatureOf(delivery: GitHubDelivery): string | undefined;

  translated(delivery: GitHubDelivery): TranslatedDelivery;
}
