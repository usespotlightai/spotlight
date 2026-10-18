import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { InvalidRunTransitionError } from '@work/domain/exceptions/invalid-run-transition.error';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { describe, expect, it } from 'vitest';

const line = Line.rehydrate({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('default'),
  name: LineName.of('Default'),
  stations: [
    Station.of({
      id: StationId.of('station_0'),
      key: StationKey.of('backlog'),
      name: StationName.of('Backlog'),
      position: 0,
      color: StationColor.of('#a3a8b0'),
      kind: 'backlog',
    }),
    Station.of({
      id: StationId.of('station_1'),
      key: StationKey.of('triage'),
      name: StationName.of('Triage'),
      position: 1,
      color: StationColor.of('#93a1b5'),
      harness: HarnessId.of('dev'),
    }),
    Station.of({
      id: StationId.of('station_end'),
      key: StationKey.of('completed'),
      name: StationName.of('Completed'),
      position: 2,
      color: StationColor.of('#a3a8b0'),
      kind: 'completed',
    }),
  ],
});

const SCREENSHOT = Attachment.of({
  id: '5f0c1d84-9c2e-4c8b-9a3d-2b7e6d5a1f47',
  name: 'queue-stuck.png',
  contentType: 'image/png',
  size: 2_048,
});

const withBriefing = () =>
  Task.add({
    line,
    at: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    description: TaskDescription.of('It stalls on restart.'),
    rank: TaskRank.of('i'),
    createdBy: UserId.of('user_1'),
    now: new Date('2026-10-01T09:00:00.000Z'),
    newId: () => 'task_1',
    attachments: [SCREENSHOT],
  });

describe('BriefedTask', () => {
  it('takes what a briefing reads from the task', () => {
    const briefed = withBriefing().briefed;

    expect(briefed.stationId.value).toBe('station_1');
    expect(briefed.title).toBe('Fix the queue');
    expect(briefed.description).toBe('It stalls on restart.');
    expect(briefed.reviewing).toBeNull();
    expect(briefed.allAttachments).toEqual([SCREENSHOT]);
    expect(briefed.notes).toEqual([]);
    expect(briefed.openReviewComments).toEqual([]);
  });

  it('reads back as it was stored', () => {
    const briefed = withBriefing().briefed;
    const read = BriefedTask.rehydrate(
      JSON.parse(JSON.stringify(briefed.parts)),
    );

    expect(read.equals(briefed)).toBe(true);
    expect(read.parts).toEqual(briefed.parts);
  });

  it('reads back what was briefed though a task could no longer say it today', () => {
    const parts = {
      ...withBriefing().briefed.parts,
      title: 'x'.repeat(10_000),
      notes: [{ station: '', body: '', attachments: [] }],
    };

    expect(BriefedTask.rehydrate(parts).parts).toEqual(parts);
  });
});

describe('a run briefed with a task', () => {
  const spec = RunSpec.of({
    command: { executable: 'sh', args: [] },
    briefing: 'Fix the queue.',
    handover: { options: [], noteLimit: 0 },
    resume: { key: 'chat-chat_1' },
  });

  it('records it only when it works a task', () => {
    expect(() =>
      Run.enqueue({
        id: RunId.of('run_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        harness: HarnessId.of('dev'),
        subject: RunSubject.chat(ChatId.of('chat_1')),
        spec,
        briefedTask: withBriefing().briefed,
      }),
    ).toThrow(InvalidRunTransitionError);
  });

  it('records it only as briefed at the station the run works at', () => {
    expect(() =>
      Run.enqueue({
        id: RunId.of('run_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        harness: HarnessId.of('dev'),
        subject: RunSubject.task(
          TaskId.of('task_1'),
          StationId.of('station_2'),
          TaskRevision.of(1),
        ),
        spec,
        briefedTask: withBriefing().briefed,
      }),
    ).toThrow(InvalidRunTransitionError);
  });
});
