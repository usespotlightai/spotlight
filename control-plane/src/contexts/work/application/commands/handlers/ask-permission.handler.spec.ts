import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { AskPermissionCommand } from '@work/application/commands/ask-permission.command';
import { AskPermissionHandler } from '@work/application/commands/handlers/ask-permission.handler';
import { RunWorks } from '@work/application/services/run-works.service';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import type { ApprovalDecision } from '@work/domain/value-objects/approval.vo';
import { CalledTool } from '@work/domain/value-objects/called-tool.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { ProfileKey } from '@work/domain/value-objects/profile-key.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { StationRoutes } from '@work/domain/value-objects/station-routes.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-23T09:00:00.000Z');

const IMPLEMENTING = StationId.of('station_1');

const LINE = Line.rehydrate({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  stations: [
    Station.of({
      id: StationId.of('station_0'),
      key: StationKey.of('backlog'),
      name: StationName.of('Backlog'),
      position: 0,
      color: StationColor.of('#a3a8b0'),
      kind: 'backlog',
      routes: StationRoutes.of({ stations: [IMPLEMENTING] }),
    }),
    Station.of({
      id: IMPLEMENTING,
      key: StationKey.of('implementation'),
      name: StationName.of('Implementation'),
      position: 1,
      color: StationColor.of('#a3a8b0'),
      harness: HarnessId.of('claude-code'),
      profile: ProfileKey.of('careful'),
    }),
    Station.of({
      id: StationId.of('station_2'),
      key: StationKey.of('completed'),
      name: StationName.of('Completed'),
      position: 2,
      color: StationColor.of('#a3a8b0'),
      kind: 'completed',
    }),
  ],
});

const PUSH = {
  sessionId: 'sess_1',
  kind: 'execute',
  title: '`git push origin main`',
  input: { command: 'git push origin main', description: 'Push the fix' },
};

const runOf = (
  id: string,
  subject = RunSubject.task(
    TaskId.of('task_1'),
    IMPLEMENTING,
    TaskRevision.of(0),
  ),
) =>
  Run.enqueue({
    id: RunId.of(id),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('claude-code'),
    subject,
    spec: RunSpec.of({
      command: { executable: 'claude-agent-acp', args: [] },
      briefing: 'do the thing',
      handover: { options: [], noteLimit: 4_000 },
      resume: { key: 'task:station' },
    }),
  }).claim(RunnerId.of('runner_1'), NOW);

const withRun = (runId: string) =>
  Task.rehydrate({
    ...Task.add({
      line: LINE,
      at: IMPLEMENTING,
      title: TaskTitle.of('Fix the queue'),
      rank: TaskRank.between(null, null),
      createdBy: UserId.of('user_1'),
      now: NOW,
      newId: () => 'task_1',
    }),
    currentRunId: RunId.of(runId),
  });

const asking = (start: Task, subject?: RunSubject) => {
  let current = start;
  let run = runOf('run_1', subject);

  const handler = new AskPermissionHandler(
    new RunWorks(
      { findById: async () => run } as unknown as RunRepository,
      {
        find: async () => current,
        save: async (saved: Task) => {
          current = saved;
        },
      } as unknown as TaskRepository,
      {
        find: async () =>
          Chat.start({
            workspaceId: WorkspaceId.of('ws_1'),
            teamId: TeamId.of('team_1'),
            startedBy: UserId.of('user_1'),
            harness: HarnessId.of('claude-code'),
            body: ChatMessageBody.of('Plan the queue.'),
            now: NOW,
            newId: () => 'chat_1',
          }).assignRun(RunId.of('run_1'), NOW),
      } as unknown as ChatRepository,
      { findByStation: async () => LINE } as unknown as LineRepository,
      { of: async () => null },
      { now: () => NOW, sleep: async () => {} },
    ),
    {
      toolFor: (title) =>
        title === 'mcp__linear__create_issue'
          ? CalledTool.of({ server: 'linear', tool: 'create_issue' })
          : null,
    },
  );

  return {
    ask: async (asked = PUSH) =>
      (
        await handler.execute(
          new AskPermissionCommand(run.id.value, 'runner_1', asked),
        )
      ).decision,
    decide: (decision: ApprovalDecision) => {
      const at = NotePosition.of(current.notes.length - 1);

      current = current.answer(
        at,
        {
          station: StationName.of('Implementation'),
          body: TaskNoteBody.of(
            decision === 'granted' ? 'Go ahead.' : 'Not today.',
          ),
          at: NOW,
          voice: Voice.person(UserId.of('user_1')),
        },
        decision,
      );
    },
    takenUpBy: (runId: string) => {
      run = runOf(runId);
      current = Task.rehydrate({ ...current, currentRunId: RunId.of(runId) });
    },
    current: () => current,
  };
};

describe('AskPermissionHandler', () => {
  it('puts what the harness asks to a person, the run keeping the task while it waits and carrying its session', async () => {
    const { ask, current } = asking(withRun('run_1'));

    await expect(ask()).resolves.toBe('asked');

    const asked = current().notes[current().notes.length - 1];
    expect(asked?.form).toBe('approval');
    expect(asked?.approval?.subject.kind).toBe('harness-permission');
    expect(asked?.approval?.subject.name).toBe('claude-code execute');
    expect(asked?.approval?.because).toContain('careful');
    expect(asked?.body.value).toContain('git push origin main');
    expect(current().currentRunId).toEqual(RunId.of('run_1'));
    expect(current().sessionId?.value).toBe('sess_1');
  });

  it('records the MCP tool a permission names, so a refusal is counted against it', async () => {
    const { ask, current } = asking(withRun('run_1'));

    await ask({ ...PUSH, title: 'mcp__linear__create_issue' });

    expect(
      current().notes[current().notes.length - 1]?.approval?.subject.tool,
    ).toEqual({ server: 'linear', tool: 'create_issue' });
  });

  it('lets the run that takes the task up again do it once a person approves', async () => {
    const { ask, decide, takenUpBy, current } = asking(withRun('run_1'));

    await ask();
    decide('granted');
    takenUpBy('run_2');

    await expect(
      ask({ ...PUSH, input: { ...PUSH.input, description: 'Push it now' } }),
    ).resolves.toBe('allow');
    expect(current().notes.find((each) => each.approval)?.approval?.spent).toBe(
      true,
    );
  });

  it('asks again for a second go, since an approval is spent once', async () => {
    const { ask, decide, takenUpBy } = asking(withRun('run_1'));

    await ask();
    decide('granted');
    takenUpBy('run_2');
    await ask();

    await expect(ask()).resolves.toBe('asked');
  });

  it('refuses what a person rejected', async () => {
    const { ask, decide, takenUpBy } = asking(withRun('run_1'));

    await ask();
    decide('refused');
    takenUpBy('run_2');

    await expect(ask()).resolves.toBe('reject');
  });

  it('refuses a run its task detached', async () => {
    const { ask } = asking(withRun('run_other'));

    await expect(ask()).resolves.toBe('reject');
  });

  it('refuses a chat, which has nobody to ask', async () => {
    const { ask } = asking(
      withRun('run_1'),
      RunSubject.chat(ChatId.of('chat_1')),
    );

    await expect(ask()).resolves.toBe('reject');
  });
});
