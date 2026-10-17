import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { ConnectionsMade } from '@work/application/services/connections-made.service';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { TaskVersionConflictError } from '@work/domain/exceptions/task-version-conflict.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { ConnectionAsk } from '@work/domain/value-objects/connection-ask.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-10-05T10:00:00.000Z');
const RUN = RunId.of('run_1');
const TEAM = TeamId.of('team_1');
const ALICE = UserId.of('user_alice');
const WORK = StationId.of('station_work');

const station = (
  id: string,
  position: number,
  kind: 'backlog' | 'work' | 'completed',
) =>
  Station.of({
    id: StationId.of(id),
    key: StationKey.of(id.replace('station_', '')),
    name: StationName.of(id.replace('station_', '')),
    position,
    color: StationColor.plain(),
    kind,
  });

const line = Line.rehydrate({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TEAM,
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  stations: [
    station('station_backlog', 0, 'backlog'),
    station('station_work', 1, 'work'),
    station('station_completed', 2, 'completed'),
  ],
});

const waiting = () => {
  const { task } = Task.rehydrate({
    ...Task.add({
      line,
      at: WORK,
      title: TaskTitle.of('Comment on ENG-12'),
      rank: TaskRank.of('i'),
      raisedBy: ALICE,
      now: NOW,
      newId: () => 'task_1',
    }),
    currentRunId: RUN,
  }).askToConnect(
    RUN,
    {
      station: StationName.of('work'),
      body: TaskNoteBody.of('Connect Linear.'),
      at: NOW,
      voice: Voice.station(RUN),
    },
    ConnectionAsk.of({
      teamId: TEAM,
      source: 'linear',
      integration: 'Linear',
      personId: ALICE,
    }),
  );
  task.pullEvents();
  return task;
};

const answering = (fails = 0) => {
  let current = waiting();
  const saved: Task[] = [];
  const tasks = {
    awaitingConnection: vi.fn(async () => [current]),
    find: vi.fn(async () => current),
    save: vi.fn(async (task: Task) => {
      if (fails > 0) {
        fails--;
        throw new TaskVersionConflictError('task_1');
      }
      current = task;
      saved.push(task);
    }),
  } as unknown as TaskRepository;

  return {
    made: new ConnectionsMade(tasks, { now: () => NOW, sleep: async () => {} }),
    tasks,
    saved,
  };
};

describe('ConnectionsMade', () => {
  it('answers each task waiting on that person’s connection in their own voice', async () => {
    const { made, tasks, saved } = answering();

    await made.answer({ teamId: TEAM, source: 'linear', personId: ALICE });

    expect(tasks.awaitingConnection).toHaveBeenCalledWith(
      TEAM,
      ALICE,
      'linear',
    );
    expect(saved).toHaveLength(1);
    const answer = saved[0]?.notes[saved[0].notes.length - 1];
    expect(answer?.kind).toBe('answered');
    expect(answer?.body.value).toBe('Connected Linear.');
    expect(answer?.voice.author).toEqual(ALICE);
    expect(saved[0]?.awaitingReview).toBe(false);
  });

  it('tries again when the task changed while it answered', async () => {
    const { made, saved } = answering(1);

    await made.answer({ teamId: TEAM, source: 'linear', personId: ALICE });

    expect(saved).toHaveLength(1);
  });

  it('leaves alone a task someone else was asked about', async () => {
    const { made, saved } = answering();

    await made.answer({
      teamId: TEAM,
      source: 'linear',
      personId: UserId.of('user_bob'),
    });

    expect(saved).toEqual([]);
  });
});
