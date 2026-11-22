import {
  type Window,
  within,
} from '@insights/domain/value-objects/insights-period.vo';

export interface PullRequestDelivery {
  readonly taskId: string;
  readonly pullRequest: string;
  readonly openedAt: Date;
  readonly firstReviewAt: Date | null;
  readonly closedAt: Date | null;
  readonly merged: boolean;
  readonly taskOpenedAt: Date | null;
}

type Finished = PullRequestDelivery & { readonly closedAt: Date };

export const finishedWithin = (
  window: Window,
  each: PullRequestDelivery,
): each is Finished => within(window, each.closedAt);

export const mergedWithin = (
  window: Window,
  each: PullRequestDelivery,
): each is Finished => each.merged && finishedWithin(window, each);

export const tasksOf = (
  deliveries: readonly PullRequestDelivery[],
): readonly string[] => [...new Set(deliveries.map((each) => each.taskId))];
