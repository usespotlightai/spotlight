import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { RunDigest } from '@work/application/ports/run-digest-reader.port';
import type { TeamTraceSummary } from '@work/application/ports/team-trace-reader.port';
import { ListTeamTracesHandler } from '@work/application/queries/handlers/list-team-traces.handler';
import { ListTeamTracesQuery } from '@work/application/queries/list-team-traces.query';
import { HarnessName } from '@work/domain/value-objects/harness-name.vo';
import { Money } from '@work/domain/value-objects/money.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { Tokens } from '@work/domain/value-objects/tokens.vo';
import { beforeEach, describe, expect, it } from 'vitest';

const AT = new Date('2026-08-29T12:00:00.000Z');

const trace = (taskId: string, runIds: string[]): TeamTraceSummary => ({
  taskId: TaskId.of(taskId),
  title: 'Fix the queue',
  runIds: runIds.map((each) => RunId.of(each)),
  station: {
    name: StationName.of('Implementation'),
    color: StationColor.of('#edc12b'),
    position: 1,
    count: 3,
  },
  stations: [],
  harness: HarnessName.of('claude-code'),
  state: 'completed',
  startedAt: AT,
  endedAt: AT,
  runs: runIds.length,
  input: null,
  output: null,
});

let requested: string[][] = [];

const digests = {
  forRuns: async (runIds: readonly RunId[]) => {
    requested.push(runIds.map((each) => each.value));

    return new Map<string, RunDigest>([
      [
        'run_1',
        {
          ms: 1_000,
          steps: 5,
          faults: 1,
          changedLines: 0,
          used: null,
          size: null,
          cost: Money.of(0.5, 'USD'),
          tokens: Tokens.UNREPORTED,
        },
      ],
    ]);
  },
};

const NOW = new Date('2026-08-29T12:30:00.000Z');

const clock: ClockPort = { now: () => NOW, sleep: async () => {} };

let since: Date | null = null;

const handler = (found: TeamTraceSummary[]) =>
  new ListTeamTracesHandler(
    {
      listForTeam: async (_team, _viewer, from) => {
        since = from;
        return found;
      },
    },
    digests,
    clock,
  );

describe('ListTeamTracesHandler', () => {
  beforeEach(() => {
    requested = [];
    since = null;
  });

  it('reads only what the runs it reports on came to', async () => {
    await handler([trace('task_1', ['run_1', 'run_2'])]).execute(
      new ListTeamTracesQuery('team_1', 'user_1', '1h'),
    );

    expect(requested).toEqual([['run_1', 'run_2']]);
  });

  it('requests nothing where the team has run nothing', async () => {
    const { traces } = await handler([]).execute(
      new ListTeamTracesQuery('team_1', 'user_1', '1h'),
    );

    expect(traces).toEqual([]);
    expect(requested).toEqual([[]]);
  });

  it('hands back what each trace came to', async () => {
    const {
      traces: [first],
    } = await handler([trace('task_1', ['run_1'])]).execute(
      new ListTeamTracesQuery('team_1', 'user_1', '1h'),
    );

    expect(first?.taskId).toBe('task_1');
    expect(first?.cost).toBe(0.5);
    expect(first?.faults).toBe(1);
  });

  it('reads the range back from now, and says where it starts and ends', async () => {
    const listed = await handler([]).execute(
      new ListTeamTracesQuery('team_1', 'user_1', '1h'),
    );

    expect(since).toEqual(new Date('2026-08-29T11:30:00.000Z'));
    expect(listed.range).toBe('1h');
    expect(listed.from).toBe('2026-08-29T11:30:00.000Z');
    expect(listed.to).toBe('2026-08-29T12:30:00.000Z');
  });

  it('counts every trace and its faults into the bar it started in', async () => {
    const { volume } = await handler([trace('task_1', ['run_1'])]).execute(
      new ListTeamTracesQuery('team_1', 'user_1', '1h'),
    );

    expect(volume).toHaveLength(30);
    expect(volume[volume.length - 1]).toEqual({
      from: '2026-08-29T12:28:00.000Z',
      to: '2026-08-29T12:30:00.000Z',
      count: 0,
      faults: 0,
    });
    expect(volume.find((bucket) => bucket.count > 0)).toEqual({
      from: '2026-08-29T12:00:00.000Z',
      to: '2026-08-29T12:02:00.000Z',
      count: 1,
      faults: 1,
    });
  });

  it('rejects a range it does not know', async () => {
    await expect(
      handler([]).execute(new ListTeamTracesQuery('team_1', 'user_1', '2y')),
    ).rejects.toThrow(ApplicationError);
  });
});
