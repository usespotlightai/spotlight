import type { GitHubDelivery } from '@github/application/dto/github-delivery.dto';
import type { PullRequestActivity } from '@github/application/dto/pull-request-activity.dto';

export const WEBHOOK_TRANSLATION = Symbol('WEBHOOK_TRANSLATION');

type ReviewCommentAction = 'created' | 'edited' | 'deleted';

interface HeardReviewComment {
  readonly id: number;
  readonly url: string;
  readonly path: string;
  readonly side: 'old' | 'new';
  readonly line: number | null;
  readonly startLine: number | null;
  readonly body: string;
  readonly answers: number | null;
  readonly login: string | null;
  readonly writtenAt: Date | null;
}

export type Heard =
  | { readonly kind: 'installation-removed' }
  | {
      readonly kind: 'review-comment';
      readonly action: ReviewCommentAction;
      readonly pullRequest: string;
      readonly comment: HeardReviewComment;
    }
  | {
      readonly kind: 'default-branch-pushed';
      readonly repository: string;
      readonly paths: readonly string[];
    }
  | {
      readonly kind: 'pull-request-activity';
      readonly activity: PullRequestActivity;
    };

export interface TranslatedDelivery {
  readonly installation: string | null;
  readonly heard: readonly Heard[];
}

export interface WebhookTranslationPort {
  idOf(delivery: GitHubDelivery): string;

  signatureOf(delivery: GitHubDelivery): string | undefined;

  translated(delivery: GitHubDelivery): TranslatedDelivery;
}
