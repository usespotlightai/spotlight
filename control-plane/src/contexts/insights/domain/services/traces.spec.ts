import {
  type EndedTraceRun,
  runsPerTask,
  tracesOf,
} from '@insights/domain/services/traces';
import type { UnfinishedRun } from '@insights/domain/services/unfinished-runs';
import { describe, expect, it } from 'vitest';

const at = (hour: number) => new Date(Date.UTC(2026, 9, 1, hour));

const ended = (
  runId: string,
  taskId: string,
  hour: number,
  change: Partial<EndedTraceRun> = {},
): EndedTraceRun => ({
  runId,
  taskId,
  stationId: 'station_1',
  openedBy: null,
  harness: 'claude-code',
  model: null,
  queuedAt: at(hour - 1),
  startedAt: at(hour - 1),
  endedAt: at(hour),
  ms: 3_600_000,
  cost: { amount: 1, currency: 'USD' },
  errors: 1,
  ending: 'completed',
  failure: null,
  ...change,
});

const unfinished = (
  runId: string,
  taskId: string,
  hour: number,
): UnfinishedRun => ({
  runId,
  taskId,
  lineId: 'line_1',
  stationId: 'station_1',
  openedBy: null,
  harness: 'claude-code',
  model: null,
  progress: 'in-progress',
  queuedAt: at(hour),
  startedAt: at(hour),
});

describe('tracesOf', () => {
  it('groups runs by task, the latest first, and adds up their errors and cost', () => {
    const traces = tracesOf(
      [
        ended('run_1', 'task_1', 9),
        ended('run_2', 'task_2', 10),
        ended('run_3', 'task_1', 12),
      ],
      [],
      null,
    );

    expect(
      traces.map((each) => [each.taskId, each.runs.map((run) => run.runId)]),
    ).toEqual([
      ['task_1', ['run_3', 'run_1']],
      ['task_2', ['run_2']],
    ]);
    expect(traces[0]).toMatchObject({
      startedAt: at(8),
      endedAt: at(12),
      total: 2,
      errors: 2,
      spending: { spend: { amount: 2, currency: 'USD' } },
    });
  });

  it('puts a task with an unfinished run first, with no end', () => {
    const traces = tracesOf(
      [ended('run_1', 'task_1', 12), ended('run_2', 'task_2', 9)],
      [unfinished('run_3', 'task_2', 10)],
      null,
    );

    expect(traces.map((each) => each.taskId)).toEqual(['task_2', 'task_1']);
    expect(traces[0]?.endedAt).toBeNull();
    expect(traces[0]?.runs.map((each) => each.runId)).toEqual([
      'run_3',
      'run_2',
    ]);
  });

  it('lists a run once when it ended between the two reads, as ended', () => {
    const [trace] = tracesOf(
      [ended('run_1', 'task_1', 9)],
      [unfinished('run_1', 'task_1', 8)],
      null,
    );

    expect(trace?.runs.map((each) => [each.runId, each.kind])).toEqual([
      ['run_1', 'ended'],
    ]);
    expect(trace?.ms).toBe(3_600_000);
  });

  it('counts every run of the task when a filter left some out', () => {
    const traces = tracesOf(
      [ended('run_1', 'task_1', 9)],
      [],
      runsPerTask([
        { taskId: 'task_1' },
        { taskId: 'task_1' },
        { taskId: 'task_2' },
      ]),
    );

    expect(
      traces.map((each) => [each.taskId, each.runs.length, each.total]),
    ).toEqual([['task_1', 1, 2]]);
  });

  it('gives no cost where prices are in more than one currency', () => {
    const [trace] = tracesOf(
      [
        ended('run_1', 'task_1', 9),
        ended('run_2', 'task_1', 10, { cost: { amount: 1, currency: 'EUR' } }),
      ],
      [],
      null,
    );

    expect(trace?.spending.spend).toBeNull();
  });
});
