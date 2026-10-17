import type {
  PendingReview,
  PendingReviewsPort,
} from '@outcomes/application/ports/pending-reviews.port';

export const pendingReviewsInMemory = (): PendingReviewsPort & {
  readonly stored: Map<string, PendingReview[]>;
} => {
  const stored = new Map<string, PendingReview[]>();
  const keyOf = (
    workspaceId: { value: string },
    pullRequest: { value: string },
  ) => `${workspaceId.value} ${pullRequest.value}`;

  return {
    stored,
    add: async (workspaceId, review) => {
      const key = keyOf(workspaceId, review.pullRequest);
      stored.set(key, [...(stored.get(key) ?? []), review]);
    },
    pendingFor: async (workspaceId, pullRequest, since) =>
      (stored.get(keyOf(workspaceId, pullRequest)) ?? []).filter(
        (each) => each.at.getTime() >= since.getTime(),
      ),
    release: async (workspaceId, pullRequest) => {
      stored.delete(keyOf(workspaceId, pullRequest));
    },
    releaseBefore: async (workspaceId, before) => {
      for (const [key, reviews] of [...stored.entries()]) {
        if (key.startsWith(`${workspaceId.value} `)) {
          const remaining = reviews.filter(
            (each) => each.at.getTime() >= before.getTime(),
          );

          if (remaining.length > 0) {
            stored.set(key, remaining);
          } else {
            stored.delete(key);
          }
        }
      }
    },
    releaseWorkspace: async (workspaceId) => {
      for (const key of [...stored.keys()]) {
        if (key.startsWith(`${workspaceId.value} `)) {
          stored.delete(key);
        }
      }
    },
  };
};
