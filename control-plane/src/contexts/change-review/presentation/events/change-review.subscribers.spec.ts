import type { ChangeStackReactions } from '@change-review/application/events/handlers/change-stack-reactions.handler';
import type { ReviewReactions } from '@change-review/application/events/handlers/review-reactions.handler';
import type { ChangeStackAnnouncerPort } from '@change-review/application/ports/change-stack-announcer.port';
import type { CheckRunnersPort } from '@change-review/application/ports/check-runners.port';
import type { ApplyPullRequestClose } from '@change-review/application/services/apply-pull-request-close.service';
import type { DeleteTaskAcrossAggregates } from '@change-review/application/services/delete-task-across-aggregates.service';
import type { ReceiveReviewComment } from '@change-review/application/services/receive-review-comment.service';
import type { RequestDecisions } from '@change-review/application/services/request-decisions.service';
import type { SignalReviewing } from '@change-review/application/services/signal-reviewing.service';
import { ChangeStackChecked } from '@change-review/domain/events/change-stack-checked.event';
import { CheckReservationDropped } from '@change-review/domain/events/check-reservation-dropped.event';
import { LayersFailedCheck } from '@change-review/domain/events/layers-failed-check.event';
import { LeasedCheckDeleted } from '@change-review/domain/events/leased-check-deleted.event';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { changeReviewSubscribers } from '@change-review/presentation/events/change-review.subscribers';
import type { PullRequestClosedIntegrationEvent } from '@shared-kernel/application/integration-events/pull-request-closed.integration-event';
import type { ReviewCommentReceivedIntegrationEvent } from '@shared-kernel/application/integration-events/review-comment-received.integration-event';
import type { RunEndedIntegrationEvent } from '@shared-kernel/application/integration-events/run-ended.integration-event';
import type { TaskDispatchedIntegrationEvent } from '@shared-kernel/application/integration-events/task-dispatched.integration-event';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const RECEIVED: ReviewCommentReceivedIntegrationEvent = {
  kind: 'github.review-comment-received.v1',
  workspaceId: 'ws_1',
  action: 'created',
  pullRequest: 'https://github.com/acme/api/pull/7',
  commentId: 300,
  url: 'https://github.com/acme/api/pull/7#discussion_r300',
  path: 'src/a.ts',
  subject: 'line',
  side: 'old',
  line: 4,
  startLine: null,
  body: 'Why not a constant?',
  answers: null,
  login: 'octocat',
  writtenAt: '2026-09-16T09:00:00.000Z',
};

const receiving = () => {
  const receive = vi.fn(async () => {});
  const subscriber = changeReviewSubscribers(
    {} as unknown as ChangeStackReactions,
    {} as unknown as ChangeStackAnnouncerPort,
    {} as unknown as DeleteTaskAcrossAggregates,
    {} as unknown as ReviewReactions,
    { receive } as unknown as ReceiveReviewComment,
    {} as unknown as SignalReviewing,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  ).find((each) => each.kinds.includes(RECEIVED.kind));

  if (!subscriber) {
    throw new Error('nobody receives a review comment');
  }

  return { subscriber, receive };
};

describe('change review receiving a review comment on GitHub', () => {
  it('receives it in the workspace GitHub named', async () => {
    const { subscriber, receive } = receiving();

    await subscriber.handle(RECEIVED);

    expect(receive).toHaveBeenCalledWith({
      workspaceId: WorkspaceId.of('ws_1'),
      action: 'created',
      pullRequest: 'https://github.com/acme/api/pull/7',
      comment: {
        id: 300,
        url: 'https://github.com/acme/api/pull/7#discussion_r300',
        path: 'src/a.ts',
        subject: 'line',
        side: 'old',
        line: 4,
        startLine: null,
        body: 'Why not a constant?',
        answers: null,
        login: 'octocat',
        writtenAt: new Date('2026-09-16T09:00:00.000Z'),
      },
    });
  });

  it('receives one that GitHub sent without a time', async () => {
    const { subscriber, receive } = receiving();

    const unwritten: ReviewCommentReceivedIntegrationEvent = {
      ...RECEIVED,
      writtenAt: null,
    };

    await subscriber.handle(unwritten);

    expect(receive).toHaveBeenCalledWith(
      expect.objectContaining({
        comment: expect.objectContaining({ writtenAt: null }),
      }),
    );
  });
});

describe('change review receiving a run begin and end', () => {
  const signalled = () => {
    const began = vi.fn(async () => {});
    const ended = vi.fn(async () => {});
    const subscribers = changeReviewSubscribers(
      {} as unknown as ChangeStackReactions,
      {} as unknown as ChangeStackAnnouncerPort,
      {} as unknown as DeleteTaskAcrossAggregates,
      {} as unknown as ReviewReactions,
      {} as unknown as ReceiveReviewComment,
      { began, ended } as unknown as SignalReviewing,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const receiving = (kind: string) => {
      const found = subscribers.find((each) => each.kinds.includes(kind));

      if (!found) {
        throw new Error(`nobody receives ${kind}`);
      }

      return found;
    };

    return { receiving, began, ended };
  };

  it('signals a review begun when a task is dispatched to a run', async () => {
    const { receiving, began } = signalled();

    const handed: TaskDispatchedIntegrationEvent = {
      kind: 'work.task-dispatched.v1',
      taskId: 'task_1',
      workspaceId: 'ws_1',
      runId: 'run_1',
    };

    await receiving(handed.kind).handle(handed);

    expect(began).toHaveBeenCalledWith(TaskId.of('task_1'), RunId.of('run_1'));
  });

  it('signals a review ended when its run ends, and nothing for a run with no task', async () => {
    const { receiving, ended } = signalled();
    const subscriber = receiving('work.run-ended.v1');

    const ofTask: RunEndedIntegrationEvent = {
      kind: 'work.run-ended.v1',
      runId: 'run_1',
      workspaceId: 'ws_1',
      taskId: 'task_1',
      stationId: 'station_1',
      outcome: 'completed',
      failure: null,
      stopped: false,
      asked: false,
    };
    const ofChat: RunEndedIntegrationEvent = {
      ...ofTask,
      runId: 'run_2',
      taskId: null,
    };

    await subscriber.handle(ofTask);
    await subscriber.handle(ofChat);

    expect(ended).toHaveBeenCalledTimes(1);
    expect(ended).toHaveBeenCalledWith(TaskId.of('task_1'), RunId.of('run_1'));
  });
});

describe('change review receiving a run end', () => {
  it('requests the decisions a task’s run made, and none for a run with no task', async () => {
    const runEnded = vi.fn(async () => {});
    const subscriber = changeReviewSubscribers(
      {} as unknown as ChangeStackReactions,
      {} as unknown as ChangeStackAnnouncerPort,
      {} as unknown as DeleteTaskAcrossAggregates,
      {} as unknown as ReviewReactions,
      {} as unknown as ReceiveReviewComment,
      {} as unknown as SignalReviewing,
      {} as never,
      { runEnded } as unknown as RequestDecisions,
      {} as never,
      {} as never,
      {} as never,
    ).find((each) => each.name === 'change-review.request-decisions');

    const ofTask: RunEndedIntegrationEvent = {
      kind: 'work.run-ended.v1',
      runId: 'run_1',
      workspaceId: 'ws_1',
      taskId: 'task_1',
      stationId: 'station_1',
      outcome: 'completed',
      failure: null,
      stopped: false,
      asked: false,
    };

    await subscriber?.handle(ofTask);
    const ofChat: RunEndedIntegrationEvent = {
      ...ofTask,
      runId: 'run_2',
      taskId: null,
    };

    await subscriber?.handle(ofChat);

    expect(subscriber?.kinds).toEqual(['work.run-ended.v1']);
    expect(runEnded).toHaveBeenCalledTimes(1);
    expect(runEnded).toHaveBeenCalledWith(
      TaskId.of('task_1'),
      RunId.of('run_1'),
    );
  });
});

describe('change review receiving a pull request close', () => {
  it('applies the close to the decisions of the task that has the pull request', async () => {
    const closed = vi.fn(async () => {});
    const subscriber = changeReviewSubscribers(
      {} as unknown as ChangeStackReactions,
      {} as unknown as ChangeStackAnnouncerPort,
      {} as unknown as DeleteTaskAcrossAggregates,
      {} as unknown as ReviewReactions,
      {} as unknown as ReceiveReviewComment,
      {} as unknown as SignalReviewing,
      {} as never,
      {} as never,
      { closed } as unknown as ApplyPullRequestClose,
      {} as never,
      {} as never,
    ).find((each) => each.name === 'change-review.apply-pull-request-close');

    const merged: PullRequestClosedIntegrationEvent = {
      kind: 'github.pull-request-closed.v1',
      workspaceId: 'ws_1',
      pullRequest: 'https://github.com/acme/api/pull/7',
      repository: 'acme/api',
      merged: true,
      mergeCommit: 'c'.repeat(40),
      closedAt: '2026-09-21T09:30:00.000Z',
    };

    await subscriber?.handle(merged);

    expect(closed).toHaveBeenCalledWith({
      workspaceId: WorkspaceId.of('ws_1'),
      pullRequest: PullRequestUrl.of('https://github.com/acme/api/pull/7'),
      repository: Repository.of('acme/api'),
      merge: { commit: 'c'.repeat(40) },
      closedAt: new Date('2026-09-21T09:30:00.000Z'),
    });
  });
});

describe('change review receiving a stack’s check end', () => {
  const releasing = () => {
    const released = vi.fn(async () => {});
    const subscriber = changeReviewSubscribers(
      {} as unknown as ChangeStackReactions,
      {} as unknown as ChangeStackAnnouncerPort,
      {} as unknown as DeleteTaskAcrossAggregates,
      {} as unknown as ReviewReactions,
      {} as unknown as ReceiveReviewComment,
      {} as unknown as SignalReviewing,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { released } as unknown as CheckRunnersPort,
    ).find(
      (each) => each.name === 'change-review.release-runner-of-checked-stack',
    );

    if (!subscriber) {
      throw new Error('nobody releases the runner of a checked stack');
    }

    return { subscriber, released };
  };

  it('releases the runner of a stack that passed its check', async () => {
    const { subscriber, released } = releasing();

    await subscriber.handle(
      new ChangeStackChecked(
        ChangeStackId.of('stack_1'),
        RunId.of('run_1'),
        null,
        WorkspaceId.of('ws_1'),
        true,
        false,
        false,
      ),
    );

    expect(released).toHaveBeenCalledWith(ChangeStackId.of('stack_1'));
  });

  it('releases the runner of a stack whose layers failed their check', async () => {
    const { subscriber, released } = releasing();

    await subscriber.handle(
      new LayersFailedCheck(ChangeStackId.of('stack_1'), RunId.of('run_1')),
    );

    expect(released).toHaveBeenCalledWith(ChangeStackId.of('stack_1'));
  });
});

describe('change review receiving that a check was deleted while a runner leased it', () => {
  it('releases the runner that was checking it', async () => {
    const released = vi.fn(async () => {});
    const subscriber = changeReviewSubscribers(
      {} as unknown as ChangeStackReactions,
      {} as unknown as ChangeStackAnnouncerPort,
      {} as unknown as DeleteTaskAcrossAggregates,
      {} as unknown as ReviewReactions,
      {} as unknown as ReceiveReviewComment,
      {} as unknown as SignalReviewing,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { released } as unknown as CheckRunnersPort,
    ).find(
      (each) => each.name === 'change-review.release-runner-of-deleted-check',
    );

    if (!subscriber) {
      throw new Error('nobody releases the runner of a deleted check');
    }

    await subscriber.handle(
      new LeasedCheckDeleted(ChangeStackId.of('stack_1')),
    );

    expect(released).toHaveBeenCalledWith(ChangeStackId.of('stack_1'));
  });
});

describe('change review receiving a check drop the runner reserved for it', () => {
  const releasing = () => {
    const reservationDropped = vi.fn(async () => {});
    const subscriber = changeReviewSubscribers(
      {} as unknown as ChangeStackReactions,
      {} as unknown as ChangeStackAnnouncerPort,
      {} as unknown as DeleteTaskAcrossAggregates,
      {} as unknown as ReviewReactions,
      {} as unknown as ReceiveReviewComment,
      {} as unknown as SignalReviewing,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { reservationDropped } as unknown as CheckRunnersPort,
    ).find((each) => each.name === 'change-review.release-reserved-runner');

    if (!subscriber) {
      throw new Error(
        'nobody releases a runner that a check no longer reserves',
      );
    }

    return { subscriber, reservationDropped };
  };

  it('releases the runner provisioned for it', async () => {
    const { subscriber, reservationDropped } = releasing();

    await subscriber.handle(
      new CheckReservationDropped(
        ChangeStackId.of('stack_1'),
        RunnerId.of('pooled_1'),
      ),
    );

    expect(reservationDropped).toHaveBeenCalledWith(RunnerId.of('pooled_1'));
  });
});
