import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { TakeOverTaskHandler } from '@work/application/commands/handlers/take-over-task.handler';
import { TakeOverTaskCommand } from '@work/application/commands/take-over-task.command';
import { leasedRun } from '@work/application/ports/runs.fake-spec';
import type { TaskDispatching } from '@work/application/services/dispatch-task.service';
import { LineLoader } from '@work/application/services/line-loader.service';
import { workAccessSeeing } from '@work/application/services/work-access.fake-spec';
import { Task } from '@work/domain/aggregates/task.aggregate';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import {
  lineMapOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { TakeoverId } from '@work/domain/value-objects/takeover-id.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TeamMembers } from '@work/domain/value-objects/team-members.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-11-16T09:00:00.000Z');
const BUILD = StationId.of('station_build');
const LINE_RUN = RunId.of('run_line');

const line = lineMapOf({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  stations: [
    stationOf({
      id: StationId.of('station_backlog'),
      key: StationKey.of('backlog'),
      name: StationName.of('Backlog'),
      position: 0,
      color: '#a3a8b0',
      kind: 'backlog',
    }),
    stationOf({
      id: BUILD,
      key: StationKey.of('build'),
      name: StationName.of('Build'),
      position: 1,
      color: '#a3a8b0',
      harness: HarnessId.of('dev'),
    }),
    stationOf({
      id: StationId.of('station_completed'),
      key: StationKey.of('completed'),
      name: StationName.of('Completed'),
      position: 2,
      color: '#a3a8b0',
      kind: 'completed',
    }),
  ],
});

const running = () =>
  Task.add({
    line,
    at: BUILD,
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    createdBy: UserId.of('user_1'),
    now: NOW,
    newId: () => 'task_1',
  }).assignRun(LINE_RUN, line);

const takenOverBy = (person: string) =>
  running().takeOver({
    id: TakeoverId.of('takeover_0'),
    by: UserId.of(person),
    members: TeamMembers.of([UserId.of('user_1'), UserId.of('user_2')]),
    line,
    verdict: null,
    currentRunStarted: true,
    at: NOW,
  });

const people: PersonReaderPort = {
  find: async (id) =>
    id.value === 'user_2' ? { id, name: 'Maya Chen', image: null } : null,
  findMany: async () => new Map(),
};

const takeOver = async (
  body: string | null,
  viewer = 'user_1',
  started = true,
  found: () => Task = running,
): Promise<{ saved: Task | undefined; result: unknown }> => {
  let saved: Task | undefined;
  const tasks = {
    find: vi.fn(async () => found()),
    save: vi.fn(async (task: Task) => {
      saved = task;
    }),
  } as unknown as TaskRepository;
  const dispatch: TaskDispatching = {
    runIdFor: async () => RunId.of('run_turn'),
  };
  const transaction: TransactionPort = {
    inTransaction: async (work) => work(),
  };
  const ids: IdGeneratorPort = { generate: () => 'takeover_1' };
  const clock: ClockPort = { now: () => NOW, sleep: async () => {} };
  const access = workAccessSeeing((_teamId, seen) => seen.value === 'user_1', {
    members: [UserId.of('user_1')],
  });
  const facts = {
    of: async () => [leasedRun({ runId: LINE_RUN, started })],
  };
  const lines = new LineLoader(access, {
    find: async () => line,
    findByStation: async () => line,
  } as never);

  const result = await new TakeOverTaskHandler(
    tasks,
    lines,
    access,
    facts,
    transaction,
    dispatch,
    ids,
    clock,
    people,
  ).execute(
    new TakeOverTaskCommand('team_1', 'task_1', viewer, 'not-right', body),
  );

  return { saved, result };
};

describe('TakeOverTaskHandler', () => {
  it('takes the task over and starts the first turn from the person’s first message', async () => {
    const { saved, result } = await takeOver('Use a bounded queue.');

    expect(saved?.openTakeover?.from?.equals(LINE_RUN)).toBe(true);
    expect(saved?.currentRunId?.value).toBe('run_turn');
    expect(saved?.drivenByAPerson(RunId.of('run_turn'))).toBe(true);
    expect(result).toEqual({ takeoverId: 'takeover_1', runId: 'run_turn' });
  });

  it('blames no line run that was queued and never started', async () => {
    const { saved } = await takeOver('Use a bounded queue.', 'user_1', false);

    expect(saved?.openTakeover?.from).toBeNull();
  });

  it('starts no turn until the person says something', async () => {
    const { saved, result } = await takeOver(null);

    expect(saved?.takenOver).toBe(true);
    expect(saved?.currentRunId).toBeNull();
    expect(result).toEqual({ takeoverId: 'takeover_1', runId: null });
  });

  it('says who took the task over first', async () => {
    await expect(
      takeOver('Use a bounded queue.', 'user_1', true, () =>
        takenOverBy('user_2'),
      ),
    ).rejects.toMatchObject({
      kind: 'conflict',
      message: 'Maya Chen took over this task first.',
    });
  });

  it('says the person already took the task over themselves', async () => {
    await expect(
      takeOver('Use a bounded queue.', 'user_1', true, () =>
        takenOverBy('user_1'),
      ),
    ).rejects.toMatchObject({
      kind: 'conflict',
      message: 'You took over this task already.',
    });
  });

  it('lets nobody off the team take a task over', async () => {
    await expect(takeOver('Use a bounded queue.', 'user_9')).rejects.toThrow(
      'Task task_1 not found.',
    );
  });
});
