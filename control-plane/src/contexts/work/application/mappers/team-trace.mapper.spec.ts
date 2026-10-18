import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamTraceMapper } from '@work/application/mappers/team-trace.mapper';
import type { RunUsage } from '@work/application/ports/run-usage-reader.port';
import type { TeamTraceSummary } from '@work/application/ports/team-trace-reader.port';
import { HarnessName } from '@work/domain/value-objects/harness-name.vo';
import { Money } from '@work/domain/value-objects/money.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { Tokens } from '@work/domain/value-objects/tokens.vo';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-08-29T12:00:00.000Z');

const summary = (over: Partial<TeamTraceSummary> = {}): TeamTraceSummary => ({
  taskId: TaskId.of('task_1'),
  title: 'Fix the queue',
  runIds: [RunId.of('run_1')],
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
  endedAt: new Date(AT.getTime() + 143_000),
  runs: 1,
  input: 'Cap the retries',
  output: 'Capped at 500.',
  ...over,
});

const usage = (over: Partial<RunUsage> = {}): RunUsage => ({
  ms: 90_000,
  steps: 40,
  errors: 1,
  changedLines: 0,
  contextTokens: 12_000,
  contextWindow: 200_000,
  cost: Money.of(0.25, 'USD'),
  tokens: Tokens.UNREPORTED,
  ...over,
});

describe('TeamTraceMapper', () => {
  it('adds up what every run of the task cost', () => {
    const dto = TeamTraceMapper.toDto(
      summary({ runIds: [RunId.of('run_1'), RunId.of('run_2')], runs: 2 }),
      new Map([
        ['run_1', usage()],
        ['run_2', usage({ cost: Money.of(0.5, 'USD'), steps: 10, errors: 2 })],
      ]),
    );

    expect(dto.cost).toBeCloseTo(0.75);
    expect(dto.steps).toBe(50);
    expect(dto.errors).toBe(3);
    expect(dto.currency).toBe('USD');
  });

  it('says nothing about cost where nothing was reported', () => {
    const dto = TeamTraceMapper.toDto(
      summary(),
      new Map([['run_1', usage({ cost: null })]]),
    );

    expect(dto.cost).toBeNull();
    expect(dto.currency).toBeNull();
  });

  it('counts a run with no usage as nothing rather than failing', () => {
    const dto = TeamTraceMapper.toDto(summary(), new Map());

    expect(dto.steps).toBe(0);
    expect(dto.errors).toBe(0);
    expect(dto.cost).toBeNull();
  });

  it('takes the trace from the first run to the last', () => {
    expect(TeamTraceMapper.toDto(summary(), new Map()).ms).toBe(143_000);
  });

  it('carries what the run was put to and what it said back', () => {
    const dto = TeamTraceMapper.toDto(summary(), new Map());

    expect(dto.input).toBe('Cap the retries');
    expect(dto.output).toBe('Capped at 500.');
    expect(dto.startedAt).toBe(AT.toISOString());
  });
});
