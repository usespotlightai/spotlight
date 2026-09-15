import { ChatOutcomes } from '@application/events/handlers/chat-outcomes.handler';
import type { ChatDispatching } from '@application/services/chat-dispatch';
import { Chat } from '@domain/aggregates/chat.aggregate';
import { RunAbandoned } from '@domain/events/run-abandoned.event';
import { RunCompleted } from '@domain/events/run-completed.event';
import type { ChatRepository } from '@domain/repositories/chat.repository';
import { ChatId } from '@domain/value-objects/chat-id.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { HarnessSession } from '@domain/value-objects/harness-session.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { RunOutcome } from '@domain/value-objects/run-outcome.vo';
import { RunSubject } from '@domain/value-objects/run-subject.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-14T09:00:00.000Z');

const IN_CHAT = RunSubject.chat(ChatId.of('chat_1'));

const working = () =>
  Chat.start({
    id: 'chat_1',
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    startedBy: UserId.of('user_1'),
    harness: HarnessId.of('claude-code'),
    body: 'Plan the retries.',
    now: NOW,
  }).handedTo(RunId.of('run_1'), NOW);

const completed = (
  outcome = RunOutcome.of({ exitCode: 0, failed: false }),
  runId = 'run_1',
  subject: RunSubject | null = IN_CHAT,
) =>
  new RunCompleted(
    RunId.of(runId),
    subject,
    outcome,
    RunnerId.of('runner_1'),
    null,
    HarnessSession.of('session_1'),
  );

const settling = (chat: Chat | null) => {
  const save = vi.fn(async (_saved: Chat) => undefined);
  const takenUp = vi.fn(async (taken: Chat) =>
    taken.handedTo(RunId.of('run_2'), NOW),
  );
  const outcomes = new ChatOutcomes(
    { find: vi.fn(async () => chat), save } as unknown as ChatRepository,
    { takenUp } as ChatDispatching,
  );

  return { outcomes, save, takenUp };
};

describe('ChatOutcomes', () => {
  it('lets go of the run and keeps the session for the next one', async () => {
    const { outcomes, save, takenUp } = settling(working());

    await outcomes.onRunCompleted(completed());

    const saved = save.mock.calls[0]?.[0];
    expect(saved?.running).toBe(false);
    expect(saved?.sessionId?.value).toBe('session_1');
    expect(saved?.runnerId?.value).toBe('runner_1');
    expect(takenUp).not.toHaveBeenCalled();
  });

  it('takes up again what was said after the agent last listened', async () => {
    const said = working().said({
      by: UserId.of('user_1'),
      body: 'And one more thing.',
      at: NOW,
    });
    const { outcomes, save, takenUp } = settling(said);

    await outcomes.onRunCompleted(completed());

    expect(takenUp).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[0].currentRunId?.value).toBe('run_2');
  });

  it('leaves what was said waiting when the person stopped the agent', async () => {
    const said = working().said({
      by: UserId.of('user_1'),
      body: 'Never mind.',
      at: NOW,
    });
    const { outcomes, takenUp } = settling(said);

    await outcomes.onRunCompleted(completed(RunOutcome.stopped(0)));

    expect(takenUp).not.toHaveBeenCalled();
  });

  it('ignores a run the chat has already moved past', async () => {
    const { outcomes, save } = settling(working());

    await outcomes.onRunCompleted(completed(undefined, 'run_0'));

    expect(save).not.toHaveBeenCalled();
  });

  it('ignores a run that works a task', async () => {
    const { outcomes, save } = settling(working());

    await outcomes.onRunCompleted(
      completed(undefined, 'run_1', RunSubject.task(TaskId.of('task_1'), null)),
    );

    expect(save).not.toHaveBeenCalled();
  });

  it('lets go of a run no runner finished', async () => {
    const { outcomes, save } = settling(working());

    await outcomes.onRunAbandoned(
      new RunAbandoned(RunId.of('run_1'), IN_CHAT, 3),
    );

    expect(save.mock.calls[0]?.[0].running).toBe(false);
  });
});
