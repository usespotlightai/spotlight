import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';

export type PullRequestStep =
  | { readonly kind: 'open' }
  | { readonly kind: 'edit'; readonly pullRequest: PullRequestUrl }
  | { readonly kind: 'keep'; readonly pullRequest: PullRequestUrl };
