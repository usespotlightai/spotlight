import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { ChatOutcomes } from '@work/application/events/handlers/chat-outcomes.handler';
import type { ChatDispatching } from '@work/application/services/chat-dispatch';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { RunCompleted } from '@work/domain/events/run-completed.event';
import { RunExhausted } from '@work/domain/events/run-exhausted.event';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-14T09:00:00.000Z');

const IN_CHAT = RunSubject.chat(ChatId.of('chat_1'));

const working = () =>
  Chat.start({
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
    .recordSession(HarnessSession.of('session_1'), RunnerId.of('runner_1'))
    .endRun(RunId.of('run_1'))
    .addMessage({
      by: UserId.of('user_1'),
      body: ChatMessageBody.of('Split it.'),
      at: NOW,
    })
    .assignRun(RunId.of('run_2'), NOW);

const completed = (
  outcome = RunOutcome.of({ exitCode: 0, failed: false }),
  runId = 'run_1',
  subject: RunSubject | null = IN_CHAT,
) =>
  new RunCompleted(
    RunId.of(runId),
    WorkspaceId.of('ws_1'),
    subject,
    outcome,
    RunnerId.of('runner_1'),
    null,
    HarnessSession.of('session_1'),
    1,
  );

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

    await outcomes.onRunCompleted(completed());

    const saved = save.mock.calls[0]?.[0];
    expect(saved?.running).toBe(false);
    expect(saved?.sessionId?.value).toBe('session_1');
    expect(saved?.runnerId?.value).toBe('runner_1');
    expect(takenUp).not.toHaveBeenCalled();
  });

  it('takes up again the messages sent after the agent last got one', async () => {
    const withMessage = working().addMessage({
      by: UserId.of('user_1'),
      body: ChatMessageBody.of('And one more thing.'),
      at: NOW,
    });
    const { outcomes, save, takenUp } = outcomesOf(withMessage);

    await outcomes.onRunCompleted(completed());

    expect(takenUp).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[0].currentRunId?.value).toBe('run_2');
  });

  it('leaves the messages waiting when the person stopped the agent', async () => {
    const withMessage = working().addMessage({
      by: UserId.of('user_1'),
      body: ChatMessageBody.of('Never mind.'),
      at: NOW,
    });
    const { outcomes, takenUp } = outcomesOf(withMessage);

    await outcomes.onRunCompleted(completed(RunOutcome.stopped(0)));

    expect(takenUp).not.toHaveBeenCalled();
  });

  it.each([
    [
      'a run that never started',
      RunOutcome.unprovisioned({ description: 'no capacity' }, 3),
      null,
    ],
    [
      'a run whose runner failed before briefing it',
      RunOutcome.of({ exitCode: -1, failed: true, message: 'checkout failed' }),
      RunnerId.of('runner_1'),
    ],
  ])(
    'unacknowledges what %s acknowledged, and waits for the person',
    async (_, outcome, workedBy) => {
      const { outcomes, save, takenUp } = outcomesOf(handedAgain());

      await outcomes.onRunCompleted(
        new RunCompleted(
          RunId.of('run_2'),
          WorkspaceId.of('ws_1'),
          IN_CHAT,
          outcome,
          workedBy,
          null,
          null,
          1,
        ),
      );

      const saved = save.mock.calls[0]?.[0];
      expect(saved?.running).toBe(false);
      expect(saved?.sessionId?.value).toBe('session_1');
      expect(saved?.unacknowledged.map((each) => each.position.value)).toEqual([
        1,
      ]);
      expect(takenUp).not.toHaveBeenCalled();
    },
  );

  it('ignores a run the chat has already moved past', async () => {
    const { outcomes, save } = outcomesOf(working());

    await outcomes.onRunCompleted(completed(undefined, 'run_0'));

    expect(save).not.toHaveBeenCalled();
  });

  it('ignores a run that works a task', async () => {
    const { outcomes, save } = outcomesOf(working());

    await outcomes.onRunCompleted(
      completed(
        undefined,
        'run_1',
        RunSubject.task(TaskId.of('task_1'), null, TaskRevision.of(0)),
      ),
    );

    expect(save).not.toHaveBeenCalled();
  });

  it('releases a run no runner finished, and unacknowledges what it acknowledged', async () => {
    const { outcomes, save, takenUp } = outcomesOf(handedAgain());

    await outcomes.onRunExhausted(
      new RunExhausted(
        RunId.of('run_2'),
        WorkspaceId.of('ws_1'),
        IN_CHAT,
        3,
        3,
      ),
    );

    const saved = save.mock.calls[0]?.[0];
    expect(saved?.running).toBe(false);
    expect(saved?.unacknowledged.map((each) => each.position.value)).toEqual([
      1,
    ]);
    expect(takenUp).not.toHaveBeenCalled();
  });
});
