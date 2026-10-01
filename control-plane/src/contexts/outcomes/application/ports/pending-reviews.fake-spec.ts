import type {
  PendingReview,
  PendingReviewsPort,
} from '@outcomes/application/ports/pending-reviews.port';

export const pendingReviewsInMemory = (): PendingReviewsPort & {
  readonly held: Map<string, PendingReview[]>;
} => {
  const held = new Map<string, PendingReview[]>();
  const keyOf = (
    workspaceId: { value: string },
    pullRequest: { value: string },
  ) => `${workspaceId.value} ${pullRequest.value}`;

  return {
    held,
    hold: async (workspaceId, review) => {
      const key = keyOf(workspaceId, review.pullRequest);
      held.set(key, [...(held.get(key) ?? []), review]);
    },
    heldFor: async (workspaceId, pullRequest, since) =>
      (held.get(keyOf(workspaceId, pullRequest)) ?? []).filter(
        (each) => each.at.getTime() >= since.getTime(),
      ),
    release: async (workspaceId, pullRequest) => {
      held.delete(keyOf(workspaceId, pullRequest));
    },
    releaseBefore: async (workspaceId, before) => {
      for (const [key, reviews] of [...held.entries()]) {
        if (key.startsWith(`${workspaceId.value} `)) {
          const kept = reviews.filter(
            (each) => each.at.getTime() >= before.getTime(),
          );

          if (kept.length > 0) {
            held.set(key, kept);
          } else {
            held.delete(key);
          }
        }
      }
    },
    releaseWorkspace: async (workspaceId) => {
      for (const key of [...held.keys()]) {
        if (key.startsWith(`${workspaceId.value} `)) {
          held.delete(key);
        }
      }
    },
  };
};
