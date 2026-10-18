import { insightsRunOf } from '@insights/application/dto/insights.dto';
import type { ListedRun } from '@insights/application/ports/insights-reader.port';
import { describe, expect, it } from 'vitest';

const RUN: ListedRun = {
  runId: 'run_1',
  taskId: 'task_1',
  lineId: 'line_1',
  stationId: 'station_1',
  fingerprint: 'f'.repeat(64),
  harness: 'claude-code',
  model: 'opus',
  effort: 'high',
  profileKey: 'fast',
  repositories: ['acme/api'],
  openedBy: 'user_ada',
  queuedAt: new Date('2026-10-01T08:00:00.000Z'),
  startedAt: new Date('2026-10-01T08:05:00.000Z'),
  endedAt: new Date('2026-10-01T08:35:00.000Z'),
  queuedMs: 300_000,
  runningMs: 1_800_000,
  ms: 1_700_000,
  cost: { amount: 1.25, currency: 'USD' },
  tokens: { input: 10, output: 20, cacheRead: 30, cacheWrite: 40 },
  ending: 'failed',
  failure: 'timed-out',
  checks: 'passed',
  firstHumanAction: {
    kind: 'sent-back',
    at: new Date('2026-10-01T09:00:00.000Z'),
  },
  passed: { to: 'station_2', at: new Date('2026-10-01T09:30:00.000Z') },
  pullRequestState: 'merged',
};

describe('insightsRunOf', () => {
  it('copies every field of a listed run and writes its times as ISO strings', () => {
    expect(insightsRunOf(RUN)).toEqual({
      runId: 'run_1',
      taskId: 'task_1',
      lineId: 'line_1',
      stationId: 'station_1',
      fingerprint: 'f'.repeat(64),
      harness: 'claude-code',
      model: 'opus',
      effort: 'high',
      profileKey: 'fast',
      repositories: ['acme/api'],
      openedBy: 'user_ada',
      queuedAt: '2026-10-01T08:00:00.000Z',
      startedAt: '2026-10-01T08:05:00.000Z',
      endedAt: '2026-10-01T08:35:00.000Z',
      queuedMs: 300_000,
      runningMs: 1_800_000,
      ms: 1_700_000,
      cost: { amount: 1.25, currency: 'USD' },
      tokens: { input: 10, output: 20, cacheRead: 30, cacheWrite: 40 },
      ending: 'failed',
      failure: 'timed-out',
      checks: 'passed',
      firstHumanAction: { kind: 'sent-back', at: '2026-10-01T09:00:00.000Z' },
      passed: { to: 'station_2', at: '2026-10-01T09:30:00.000Z' },
      pullRequestState: 'merged',
    });
  });

  it('writes no time for a run that was never queued or started', () => {
    expect(
      insightsRunOf({
        ...RUN,
        queuedAt: null,
        startedAt: null,
        firstHumanAction: null,
        passed: null,
      }),
    ).toMatchObject({
      queuedAt: null,
      startedAt: null,
      firstHumanAction: null,
      passed: null,
    });
  });
});
