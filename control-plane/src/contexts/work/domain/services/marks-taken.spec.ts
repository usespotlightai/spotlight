import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import type { TaskMarkTaken } from '@work/domain/events/task-mark-taken.event';
import { marksTakenFrom } from '@work/domain/services/marks-taken';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { describe, expect, it } from 'vitest';

const STATION = StationId.of('station_1');
const THREAD = Mark.of('slack.thread', '170.9');
const CHANNEL = Mark.of('slack.channel', 'C1');
const ISSUE = Mark.of('linear.issue', 'ENG-1');

const delivery = Line.rehydrate({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  stations: [
    Station.of({
      id: STATION,
      key: StationKey.of('backlog'),
      name: StationName.of('Backlog'),
      position: 0,
      color: StationColor.of('#a3a8b0'),
      kind: 'backlog',
    }),
    Station.of({
      id: StationId.of('station_completed'),
      key: StationKey.of('completed'),
      name: StationName.of('Completed'),
      position: 1,
      color: StationColor.of('#a3a8b0'),
      kind: 'completed',
    }),
  ],
});

const task = (id: string, ...marks: Mark[]): Task => {
  const added = marks.reduce(
    (marked, mark) => marked.markedBy(mark),
    Task.add({
      line: delivery,
      at: STATION,
      title: TaskTitle.of(`Task ${id}`),
      rank: TaskRank.of('i'),
      now: new Date('2026-09-17T09:00:00.000Z'),
      newId: () => id,
    }),
  );
  added.pullEvents();

  return added;
};

describe('marksTakenFrom', () => {
  it('takes the mark off the task that wore it', () => {
    const [given] = marksTakenFrom(
      [task('task_0', THREAD, ISSUE)],
      task('task_1', THREAD),
    );

    expect(given?.marks).toEqual([ISSUE]);
  });

  it('says which task now holds the mark', () => {
    const [given] = marksTakenFrom(
      [task('task_0', THREAD)],
      task('task_1', THREAD),
    );

    const [taken] = (given?.pullEvents() ?? []) as TaskMarkTaken[];

    expect(taken?.kind).toBe('task.mark-taken');
    expect(taken?.mark).toEqual(THREAD);
    expect(taken?.takenBy.value).toBe('task_1');
  });

  it('gives up every mark the taker claims in one change', () => {
    const markedTask = task('task_0', THREAD, CHANNEL);

    const given = marksTakenFrom(
      [markedTask, markedTask],
      task('task_1', THREAD, CHANNEL),
    );

    expect(given).toHaveLength(1);
    expect(given[0]?.marks).toEqual([]);
    expect(given[0]?.version).toBe(markedTask.version);
  });

  it('leaves alone a task that has none of them', () => {
    expect(
      marksTakenFrom([task('task_0', ISSUE)], task('task_1', THREAD)),
    ).toEqual([]);
  });

  it('never takes a mark from the taker itself', () => {
    const taker = task('task_1', THREAD);

    expect(marksTakenFrom([taker], taker)).toEqual([]);
    expect(taker.markTakenBy(THREAD, taker.id)).toBe(taker);
  });
});
