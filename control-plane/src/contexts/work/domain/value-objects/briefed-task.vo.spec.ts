import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import {
  BriefedTask,
  type BriefedTaskParts,
} from '@work/domain/value-objects/briefed-task.vo';
import {
  lineMapOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { describe, expect, it } from 'vitest';

const line = lineMapOf({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('default'),
  name: LineName.of('Default'),
  stations: [
    stationOf({
      id: StationId.of('station_0'),
      key: StationKey.of('backlog'),
      name: StationName.of('Backlog'),
      position: 0,
      color: '#a3a8b0',
      kind: 'backlog',
    }),
    stationOf({
      id: StationId.of('station_1'),
      key: StationKey.of('triage'),
      name: StationName.of('Triage'),
      position: 1,
      color: '#93a1b5',
      harness: HarnessId.of('dev'),
    }),
    stationOf({
      id: StationId.of('station_end'),
      key: StationKey.of('completed'),
      name: StationName.of('Completed'),
      position: 2,
      color: '#a3a8b0',
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
    const briefed = withBriefing().briefedOn(line);

    expect(briefed.stationId.value).toBe('station_1');
    expect(briefed.title).toBe('Fix the queue');
    expect(briefed.description).toBe('It stalls on restart.');
    expect(briefed.reviewing).toBeNull();
    expect(briefed.allAttachments).toEqual([SCREENSHOT]);
    expect(briefed.notes).toEqual([]);
    expect(briefed.openReviewComments).toEqual([]);
  });

  it('reads back as it was stored', () => {
    const briefed = withBriefing().briefedOn(line);
    const read = BriefedTask.rehydrate(
      JSON.parse(JSON.stringify(briefed.parts)) as BriefedTaskParts,
    );

    expect(read.equals(briefed)).toBe(true);
    expect(read.parts).toEqual(briefed.parts);
  });

  it('reads back what was briefed though a task could no longer say it today', () => {
    const parts = {
      ...withBriefing().briefedOn(line).parts,
      title: 'x'.repeat(10_000),
      notes: [{ station: '', body: '', attachments: [] }],
    };

    expect(BriefedTask.rehydrate(parts).parts).toEqual(parts);
  });
});
