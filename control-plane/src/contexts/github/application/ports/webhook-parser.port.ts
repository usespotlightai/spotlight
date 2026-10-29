import type { GitHubDelivery } from '@github/application/dto/github-delivery.dto';
import type { PullRequestActivity } from '@github/application/dto/pull-request-activity.dto';
import type { PullRequestSnapshot } from '@github/domain/aggregates/pull-request.aggregate';
import type { PullRequestThread } from '@github/domain/value-objects/bot-activity.vo';

export const WEBHOOK_PARSER = Symbol('WEBHOOK_PARSER');

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
  readonly inReplyToId: number | null;
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
      readonly snapshot: PullRequestSnapshot | null;
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
      readonly state: 'approved' | 'changes-requested' | 'commented';
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
