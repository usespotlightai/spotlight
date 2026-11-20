import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { ChatRefusal } from '@work/domain/value-objects/chat-refusal';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';

export type ChatPullRequestStep =
  | { readonly kind: 'refused'; readonly refusal: ChatRefusal }
  | { readonly kind: 'known'; readonly url: PullRequestUrl }
  | { readonly kind: 'open'; readonly line: LineMap };
