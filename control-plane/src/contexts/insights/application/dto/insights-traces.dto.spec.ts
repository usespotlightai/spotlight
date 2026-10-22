import { insightsTracesOf } from '@insights/application/dto/insights-traces.dto';
import type { TracedWork } from '@insights/application/ports/work.port';
import { tracesOf } from '@insights/domain/services/traces';
import { TraceRange } from '@insights/domain/value-objects/trace-range.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-01T15:00:00.000Z');

const station = (stationId: string, position: number) => ({
  stationId,
  name: `Station ${position}`,
  color: '#edc12b',
  position,
  count: 3,
});

const WORK: TracedWork = {
  tasks: [
    {
      taskId: 'task_1',
      title: 'Fix the queue',
      input: 'Please',
      stationId: 'station_3',
    },
  ],
  stations: [
    station('station_2', 1),
    station('station_1', 0),
    station('station_3', 2),
  ],
  outputs: new Map([['task_1', 'Done']]),
};

const run = (runId: string, stationId: string, hour: number) => ({
  runId,
  taskId: 'task_1',
  stationId,
  openedBy: 'user_ada',
  harness: 'claude-code',
  model: 'opus',
  queuedAt: new Date(Date.UTC(2026, 9, 1, hour - 1)),
  startedAt: new Date(Date.UTC(2026, 9, 1, hour - 1)),
  endedAt: new Date(Date.UTC(2026, 9, 1, hour)),
  ms: 1_000,
  cost: null,
  errors: null,
  ending: 'completed' as const,
  failure: null,
});

describe('insightsTracesOf', () => {
  it('names each trace and run from the work, with the stations in the line’s order and the task’s output', () => {
    const range = TraceRange.of('1d', NOW);
    const traces = tracesOf(
      [run('run_1', 'station_1', 9), run('run_2', 'station_2', 10)],
      [],
      null,
    );

    const listed = insightsTracesOf(range, [], traces, WORK, false, 0, []);

    expect(listed.traces).toHaveLength(1);
    expect(listed.traces[0]).toMatchObject({
      title: 'Fix the queue',
      input: 'Please',
      output: 'Done',
      station: { stationId: 'station_3' },
      ms: 2 * 3_600_000,
      cost: null,
    });
    expect(listed.traces[0]?.stations.map((each) => each.stationId)).toEqual([
      'station_1',
      'station_2',
      'station_3',
    ]);
    expect(
      listed.traces[0]?.runs.map((each) => [
        each.runId,
        each.station?.name,
        each.ending,
      ]),
    ).toEqual([
      ['run_2', 'Station 1', 'completed'],
      ['run_1', 'Station 0', 'completed'],
    ]);
  });

  it('leaves out a trace whose task the work does not know', () => {
    const traces = tracesOf(
      [{ ...run('run_9', 'station_1', 9), taskId: 'task_gone' }],
      [],
      null,
    );

    expect(
      insightsTracesOf(TraceRange.of('1d', NOW), [], traces, WORK, false, 0, [])
        .traces,
    ).toEqual([]);
  });
});
