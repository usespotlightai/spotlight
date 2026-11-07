import type { RunEndedIntegrationEvent } from '@shared-kernel/application/integration-events/run-ended.integration-event';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { ChatOutcomes } from '@work/application/events/handlers/chat-outcomes.handler';
import {
  requestedBy,
  runEnded,
  runExhausted,
  runFailed,
  runUnprovisioned,
} from '@work/application/ports/runs.fake-spec';
import type { ChatDispatching } from '@work/application/services/dispatch-chat.service';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-14T09:00:00.000Z');

const IN_CHAT = requestedBy.chat('chat_1');

const working = () =>
  Chat.start({
    lines: [],
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    startedBy: UserId.of('user_1'),
    harness: HarnessId.of('claude-code'),
    body: ChatMessageBody.of('Plan the retries.'),
    now: NOW,
    newId: () => 'chat_1',
  }).assignRun(RunId.of('run_1'), NOW);

const handedAgain = () =>
  working()
    .runEnded(RunId.of('run_1'), {
      session: HarnessSession.of('session_1'),
      claimedBy: RunnerId.of('runner_1'),
    })
    .chat.addMessage({
      by: UserId.of('user_1'),
      body: ChatMessageBody.of('Split it.'),
      at: NOW,
    })
    .assignRun(RunId.of('run_2'), NOW);

const completed = (part: Partial<RunEndedIntegrationEvent> = {}) =>
  runEnded({
    requester: IN_CHAT,
    claimedBy: 'runner_1',
    session: 'session_1',
    ...part,
  });

const outcomesOf = (chat: Chat | null) => {
  const save = vi.fn(async (_saved: Chat) => undefined);
  const takenUp = vi.fn(async (taken: Chat) =>
    taken.assignRun(RunId.of('run_2'), NOW),
  );
  const outcomes = new ChatOutcomes(
    { find: vi.fn(async () => chat), save } as unknown as ChatRepository,
    { takenUp } as ChatDispatching,
  );

  return { outcomes, save, takenUp };
};

describe('ChatOutcomes', () => {
  it('releases the run and keeps the session for the next one', async () => {
    const { outcomes, save, takenUp } = outcomesOf(working());

    await outcomes.onRunEnded(completed());

    const saved = save.mock.calls[0]?.[0];
    expect(saved?.running).toBe(false);
    expect(saved?.session?.value).toBe('session_1');
    expect(saved?.claimedBy?.value).toBe('runner_1');
    expect(takenUp).not.toHaveBeenCalled();
  });

  it('takes up again the messages sent after the agent last got one', async () => {
    const withMessage = working().addMessage({
      by: UserId.of('user_1'),
      body: ChatMessageBody.of('And one more thing.'),
      at: NOW,
    });
    const { outcomes, save, takenUp } = outcomesOf(withMessage);

    await outcomes.onRunEnded(completed());

    expect(takenUp).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[0].currentRunId?.value).toBe('run_2');
  });

  it('takes up the messages the agent did not get when the person stopped it', async () => {
    const withMessage = working().addMessage({
      by: UserId.of('user_1'),
      body: ChatMessageBody.of('Look at the task briefing instead.'),
      at: NOW,
    });
    const { outcomes, save, takenUp } = outcomesOf(withMessage);

    await outcomes.onRunEnded(completed({ stopped: true, handsOver: false }));

    expect(takenUp).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[0].currentRunId?.value).toBe('run_2');
  });

  it('waits for the person when the agent was stopped with nothing left to take', async () => {
    const { outcomes, takenUp } = outcomesOf(working());

    await outcomes.onRunEnded(completed({ stopped: true, handsOver: false }));

    expect(takenUp).not.toHaveBeenCalled();
  });

  it.each([
    [
      'a run that never started',
      runUnprovisioned({ runId: 'run_2', requester: IN_CHAT }),
    ],
    [
      'a run whose runner failed before briefing it',
      runFailed({
        runId: 'run_2',
        requester: IN_CHAT,
        exitCode: -1,
        message: 'checkout failed',
        claimedBy: 'runner_1',
      }),
    ],
  ])(
    'unacknowledges what %s acknowledged, and waits for the person',
    async (_, ended) => {
      const { outcomes, save, takenUp } = outcomesOf(handedAgain());

      await outcomes.onRunEnded(ended);

      const saved = save.mock.calls[0]?.[0];
      expect(saved?.running).toBe(false);
      expect(saved?.session?.value).toBe('session_1');
      expect(saved?.unacknowledged.map((each) => each.position.value)).toEqual([
        1,
      ]);
      expect(takenUp).not.toHaveBeenCalled();
    },
  );

  it('ignores a run the chat has already moved past', async () => {
    const { outcomes, save } = outcomesOf(working());

    await outcomes.onRunEnded(completed({ runId: 'run_0' }));

    expect(save).not.toHaveBeenCalled();
  });

  it('ignores a run that works a task', async () => {
    const { outcomes, save } = outcomesOf(working());

    await outcomes.onRunEnded(
      completed({ requester: requestedBy.task('task_1', 0) }),
    );

    expect(save).not.toHaveBeenCalled();
  });

  it('releases a run no runner finished, and unacknowledges what it acknowledged', async () => {
    const { outcomes, save, takenUp } = outcomesOf(handedAgain());

    await outcomes.onRunEnded(
      runExhausted({ runId: 'run_2', requester: IN_CHAT }),
    );

    const saved = save.mock.calls[0]?.[0];
    expect(saved?.running).toBe(false);
    expect(saved?.unacknowledged.map((each) => each.position.value)).toEqual([
      1,
    ]);
    expect(takenUp).not.toHaveBeenCalled();
  });
});
