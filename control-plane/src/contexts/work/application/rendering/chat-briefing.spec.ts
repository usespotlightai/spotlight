import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { BriefedMemory } from '@work/application/ports/team-memories.port';
import { ChatBriefing } from '@work/application/rendering/chat-briefing';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { ChatHandedToRun } from '@work/domain/events/chat-handed-to-run.event';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TraceReference } from '@work/domain/value-objects/trace-reference.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-26T09:00:00.000Z');
const LEON = UserId.of('user_1');

const traceOf = (id: string, title: string) =>
  TraceReference.of({
    taskId: TaskId.of(id),
    title: TaskTitle.of(title),
    teamId: TeamId.of('team_1'),
  });

const started = (traces: readonly TraceReference[] = []) =>
  Chat.start({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    startedBy: LEON,
    harness: HarnessId.of('claude-code'),
    body: ChatMessageBody.given('Why did these fail?'),
    traces,
    now: NOW,
    newId: () => 'chat_1',
  });

const brief = (chat: Chat, memories: readonly BriefedMemory[] = []) =>
  ChatBriefing.brief({ chat, team: 'Core', lines: [], memories });

const followingUp = (chat: Chat, traces: readonly TraceReference[]) => {
  const handed = chat
    .handedTo(RunId.of('run_1'), NOW)
    .endedRun(RunId.of('run_1'))
    .said({
      by: LEON,
      body: ChatMessageBody.given('And this one?'),
      traces,
      at: NOW,
    })
    .handedTo(RunId.of('run_2'), NOW);
  const event = handed
    .pullEvents()
    .filter((each): each is ChatHandedToRun => each instanceof ChatHandedToRun)
    .pop();

  return ChatBriefing.followUp(handed, event?.handed ?? []);
};

describe('ChatBriefing', () => {
  it('gives the command for each shared trace, and how to read one', () => {
    const briefed = brief(started([traceOf('task_1', 'Retries back off')]));

    expect(briefed).toContain(
      '- Retries back off: `spotlight trace --task task_1`',
    );
    expect(briefed).toContain('## Reading a trace');
  });

  it('says nothing of traces where none was shared', () => {
    const briefed = brief(started());

    expect(briefed).not.toContain('spotlight trace');
    expect(briefed).not.toContain('## Reading a trace');
  });

  it('follows up with what was said since the last run', () => {
    const followed = followingUp(started(), []);

    expect(followed).toBe('And this one?');
  });

  it('explains reading a trace when the first one comes later', () => {
    const followed = followingUp(started(), [
      traceOf('task_2', 'Checks go red'),
    ]);

    expect(followed).toContain('`spotlight trace --task task_2`');
    expect(followed).toContain('## Reading a trace');
  });

  it('does not explain reading a trace twice', () => {
    const followed = followingUp(
      started([traceOf('task_1', 'Retries back off')]),
      [traceOf('task_2', 'Checks go red')],
    );

    expect(followed).toContain('`spotlight trace --task task_2`');
    expect(followed).not.toContain('## Reading a trace');
  });

  it('gives a fresh chat what the team has learned', () => {
    const briefing = brief(started(), [
      {
        id: 'memory_1',
        handle: 'M-3',
        kind: 'preference',
        body: 'Name branches after the ticket.',
      },
    ]);

    expect(briefing).toContain('## What the team has learned');
    expect(briefing).toContain(
      '- **M-3** · preference: Name branches after the ticket.',
    );
  });

  it('says how to recall more, but not to remember, since a chat has no task to ground it', () => {
    const briefing = brief(started(), []);

    expect(briefing).toContain('`spotlight recall "<words>"`');
    expect(briefing).not.toContain('spotlight remember');
  });
});
