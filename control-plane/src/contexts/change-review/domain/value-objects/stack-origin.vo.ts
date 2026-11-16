import type { CommitSha } from '@change-review/domain/value-objects/commit-sha.vo';
import type { Pusher } from '@change-review/domain/value-objects/pusher.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export type StackOrigin =
  | { readonly kind: 'run'; readonly runId: RunId }
  | {
      readonly kind: 'push';
      readonly head: CommitSha;
      readonly pushedBy: Pusher | null;
    };

export const StackOrigin = {
  run: (runId: RunId): StackOrigin => ({ kind: 'run', runId }),

  push: (head: CommitSha, pushedBy: Pusher | null): StackOrigin => ({
    kind: 'push',
    head,
    pushedBy,
  }),

  runOf: (origin: StackOrigin): RunId | null =>
    origin.kind === 'run' ? origin.runId : null,
};
