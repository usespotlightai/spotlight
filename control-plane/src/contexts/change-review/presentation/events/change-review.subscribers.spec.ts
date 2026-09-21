import type { ChangeStackReactions } from '@change-review/application/events/handlers/change-stack-reactions.handler';
import type { ReviewReactions } from '@change-review/application/events/handlers/review-reactions.handler';
import type { ChangeStackAnnouncerPort } from '@change-review/application/ports/change-stack-announcer.port';
import type { ForgetTaskAcrossAggregates } from '@change-review/application/services/forget-task-across-aggregates.service';
import type { ReceiveReviewComment } from '@change-review/application/services/receive-review-comment.service';
import type { SignalReviewing } from '@change-review/application/services/signal-reviewing.service';
import { changeReviewSubscribers } from '@change-review/presentation/events/change-review.subscribers';
import type { ReviewCommentReceivedIntegrationEvent } from '@shared-kernel/application/integration-events/review-comment-received.integration-event';
import type { RunEndedIntegrationEvent } from '@shared-kernel/application/integration-events/run-ended.integration-event';
import type { TaskHandedToRunIntegrationEvent } from '@shared-kernel/application/integration-events/task-handed-to-run.integration-event';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
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
  side: 'old',
  line: 4,
  startLine: null,
  body: 'Why not a constant?',
  answers: null,
  login: 'octocat',
  writtenAt: '2026-09-16T09:00:00.000Z',
};

const hearing = () => {
  const receive = vi.fn(async () => {});
  const subscriber = changeReviewSubscribers(
    {} as unknown as ChangeStackReactions,
    {} as unknown as ChangeStackAnnouncerPort,
    {} as unknown as ForgetTaskAcrossAggregates,
    {} as unknown as ReviewReactions,
    { receive } as unknown as ReceiveReviewComment,
    {} as unknown as SignalReviewing,
    {} as never,
  ).find((each) => each.kinds.includes(RECEIVED.kind));

  if (!subscriber) {
    throw new Error('nobody hears a review comment');
  }

  return { subscriber, receive };
};

describe('change review hearing a review comment on GitHub', () => {
  it('receives it in the workspace GitHub named', async () => {
    const { subscriber, receive } = hearing();

    await subscriber.handle(RECEIVED);

    expect(receive).toHaveBeenCalledWith({
      workspaceId: WorkspaceId.of('ws_1'),
      action: 'created',
      pullRequest: 'https://github.com/acme/api/pull/7',
      comment: {
        id: 300,
        url: 'https://github.com/acme/api/pull/7#discussion_r300',
        path: 'src/a.ts',
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

  it('receives one GitHub gave no time', async () => {
    const { subscriber, receive } = hearing();

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

describe('change review hearing a run begin and end', () => {
  const signalled = () => {
    const began = vi.fn(async () => {});
    const ended = vi.fn(async () => {});
    const subscribers = changeReviewSubscribers(
      {} as unknown as ChangeStackReactions,
      {} as unknown as ChangeStackAnnouncerPort,
      {} as unknown as ForgetTaskAcrossAggregates,
      {} as unknown as ReviewReactions,
      {} as unknown as ReceiveReviewComment,
      { began, ended } as unknown as SignalReviewing,
      {} as never,
    );
    const hearing = (kind: string) => {
      const found = subscribers.find((each) => each.kinds.includes(kind));

      if (!found) {
        throw new Error(`nobody hears ${kind}`);
      }

      return found;
    };

    return { hearing, began, ended };
  };

  it('signals a review begun when a task is handed to a run', async () => {
    const { hearing, began } = signalled();

    const handed: TaskHandedToRunIntegrationEvent = {
      kind: 'work.task-handed-to-run.v1',
      taskId: 'task_1',
      workspaceId: 'ws_1',
      runId: 'run_1',
    };

    await hearing(handed.kind).handle(handed);

    expect(began).toHaveBeenCalledWith(TaskId.of('task_1'), RunId.of('run_1'));
  });

  it('signals a review ended when its run ends, and nothing for a run with no task', async () => {
    const { hearing, ended } = signalled();
    const subscriber = hearing('work.run-ended.v1');

    const ofTask: RunEndedIntegrationEvent = {
      kind: 'work.run-ended.v1',
      runId: 'run_1',
      workspaceId: 'ws_1',
      taskId: 'task_1',
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
