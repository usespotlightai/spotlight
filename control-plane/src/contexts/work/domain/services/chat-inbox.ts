import {
  type Progress,
  progressOfCurrentRun,
  type RunProgressReading,
} from '@work/domain/value-objects/progress';

export interface ChatActivity {
  readonly hasCurrentRun: boolean;
  readonly waiting: boolean;
}

export interface ChatReading {
  readonly readAt: Date | null;
  readonly lastProposedAt: Date | null;
}

export interface ChatInboxFacts extends ChatActivity, ChatReading {
  readonly resolvedAt: Date | null;
}

export interface ChatInboxStanding {
  readonly unread: boolean;
  readonly resolved: boolean;
  readonly running: boolean;
}

export const chatRunning = (activity: ChatActivity): boolean =>
  activity.hasCurrentRun || activity.waiting;

export const chatUnread = (reading: ChatReading): boolean =>
  reading.lastProposedAt !== null &&
  (reading.readAt === null || reading.lastProposedAt > reading.readAt);

const chatResolved = (
  facts: ChatActivity & { readonly resolvedAt: Date | null },
): boolean => facts.resolvedAt !== null && !chatRunning(facts);

export const chatInboxStanding = (
  facts: ChatInboxFacts,
): ChatInboxStanding => ({
  unread: chatUnread(facts),
  resolved: chatResolved(facts),
  running: chatRunning(facts),
});

export const chatProgress = (
  activity: ChatActivity,
  currentRun: RunProgressReading | null,
): Progress | null =>
  chatRunning(activity)
    ? progressOfCurrentRun(
        activity.hasCurrentRun ? currentRun : null,
        activity.waiting,
      )
    : null;
