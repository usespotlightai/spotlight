import type { RunEndedIntegrationEvent } from '@shared-kernel/application/integration-events/run-ended.integration-event';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { ChatOutcomes } from '@work/application/events/handlers/chat-outcomes.handler';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import {
  requestedBy,
  runEnded,
  runExhausted,
  runFailed,
  runUnprovisioned,
} from '@work/application/ports/runs.fake-spec';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import { ProposalPlacement } from '@work/domain/value-objects/proposal-placement.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-14T09:00:00.000Z');

const LATER = new Date('2026-09-14T09:05:00.000Z');

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
      lastWordsAt: null,
      endedAt: NOW,
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

const outcomesOf = (chat: Chat | null, lastWordsAt: Date | null = null) => {
  const save = vi.fn(async (_saved: Chat) => undefined);
  const takenUp = vi.fn(async (taken: Chat) =>
    taken.assignRun(RunId.of('run_2'), NOW),
  );
  const lastWordsReceivedAt = vi.fn(async (_runId: RunId) => lastWordsAt);
  const outcomes = new ChatOutcomes(
    { find: vi.fn(async () => chat), save } as unknown as ChatRepository,
    { takenUp },
    { lastWordsReceivedAt } as unknown as RunJournalReaderPort,
  );

  return { outcomes, save, takenUp, lastWordsReceivedAt };
};

describe('ChatOutcomes', () => {
  it('does not look for when the agent last wrote while the chat is not resolved', async () => {
    const { outcomes, lastWordsReceivedAt } = outcomesOf(working());

    await outcomes.onRunEnded(completed());

    expect(lastWordsReceivedAt).not.toHaveBeenCalled();
  });

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

  describe('when the proposed task was created before the run ended', () => {
    const position = MessagePosition.of(1);
    const resolved = () =>
      working()
        .propose({
          runId: RunId.of('run_1'),
          placement: ProposalPlacement.of({
            lineId: LineId.of('line_1'),
            stationId: StationId.of('station_1'),
          }),
          title: TaskTitle.of('Back off exponentially'),
          description: null,
          at: NOW,
        })
        .accept(position, UserId.of('user_1'), LATER)
        .proposalBecame(position, TaskId.of('task_1'), LATER);

    it('keeps the chat resolved when the agent last wrote before that', async () => {
      const { outcomes, save, lastWordsReceivedAt } = outcomesOf(
        resolved(),
        NOW,
      );

      await outcomes.onRunEnded(completed());

      expect(lastWordsReceivedAt).toHaveBeenCalledWith(RunId.of('run_1'));
      expect(save.mock.calls[0]?.[0].resolvedAt).toEqual(LATER);
    });

    it('opens the chat again, as of the run end, when the agent wrote after that', async () => {
      const { outcomes, save } = outcomesOf(
        resolved(),
        new Date('2026-09-14T09:06:00.000Z'),
      );

      await outcomes.onRunEnded(
        completed({ endedAt: '2026-09-14T09:07:00.000Z' }),
      );

      const saved = save.mock.calls[0]?.[0];
      expect(saved?.resolvedAt).toBeNull();
      expect(saved?.reopenedAt).toEqual(new Date('2026-09-14T09:07:00.000Z'));
    });
  });

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
