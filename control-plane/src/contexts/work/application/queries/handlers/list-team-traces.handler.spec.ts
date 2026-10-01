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

let asked: string[][] = [];

const digests = {
  forRuns: async (runIds: readonly RunId[]) => {
    asked.push(runIds.map((each) => each.value));

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

const handler = (found: TeamTraceSummary[]) =>
  new ListTeamTracesHandler({ listForTeam: async () => found }, digests);

describe('ListTeamTracesHandler', () => {
  beforeEach(() => {
    asked = [];
  });

  it('asks only for what the runs it is reporting on came to', async () => {
    await handler([trace('task_1', ['run_1', 'run_2'])]).execute(
      new ListTeamTracesQuery('team_1', 'user_1', new Date(0)),
    );

    expect(asked).toEqual([['run_1', 'run_2']]);
  });

  it('asks for nothing where the team has run nothing', async () => {
    const traces = await handler([]).execute(
      new ListTeamTracesQuery('team_1', 'user_1', new Date(0)),
    );

    expect(traces).toEqual([]);
    expect(asked).toEqual([[]]);
  });

  it('hands back what each trace came to', async () => {
    const [held] = await handler([trace('task_1', ['run_1'])]).execute(
      new ListTeamTracesQuery('team_1', 'user_1', new Date(0)),
    );

    expect(held?.taskId).toBe('task_1');
    expect(held?.cost).toBe(0.5);
    expect(held?.faults).toBe(1);
  });
});
