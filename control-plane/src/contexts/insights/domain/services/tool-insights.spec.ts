import type { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import { day, historyOf } from '@insights/domain/insights.fake-spec';
import { costedRecord, endedRecord } from '@insights/domain/runs.fake-spec';
import {
  toolCountsOf,
  toolInsightsFrom,
} from '@insights/domain/services/tool-insights';
import { Refusal } from '@insights/domain/value-objects/refusal.vo';
import {
  RunTools,
  type ServerCalls,
} from '@insights/domain/value-objects/run-tools.vo';
import { LatencyHistogram } from '@shared-kernel/domain/value-objects/latency-histogram.vo';
import { describe, expect, it } from 'vitest';

const ALWAYS = { from: new Date(0), to: new Date(8_640_000_000_000_000) };

const insightsOf = (
  records: readonly RunRecord[],
  weeks: readonly string[],
  defined: readonly string[],
) =>
  toolInsightsFrom(
    toolCountsOf(historyOf({ records }), ALWAYS),
    weeks,
    defined,
  );

const WEEKS = ['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'];

const calls = (
  server: string,
  ms: readonly number[],
  failed = 0,
  lastCallFailed = false,
): ServerCalls => ({
  server,
  calls: ms.length,
  failed,
  latency: LatencyHistogram.timing(ms),
  lastCallFailed,
});

const ran = (
  runId: string,
  at: Date,
  change: {
    stationId?: string;
    skills?: readonly string[];
    read?: readonly string[];
    servers?: readonly ServerCalls[];
    ending?: 'completed' | 'failed' | 'cancelled';
  } = {},
) =>
  costedRecord(runId, {
    taskId: `task_${runId}`,
    endedAt: at,
    stationId: change.stationId,
    skills: change.skills,
    ending: change.ending,
    tools: RunTools.of({
      servers: change.servers ?? [],
      skillsRead: change.read ?? [],
    }),
  });

describe('toolInsightsFrom', () => {
  it('counts per week the runs with a skill enabled and the runs that read it', () => {
    const insights = insightsOf(
      [
        ran('run_1', day('2026-09-08'), { skills: ['grafana'] }),
        ran('run_2', day('2026-09-09'), {
          skills: ['grafana'],
          read: ['grafana'],
        }),
        ran('run_3', day('2026-09-29'), { read: ['grafana'] }),
      ],
      WEEKS,
      ['grafana'],
    );

    expect(insights.skills).toEqual([
      expect.objectContaining({
        key: 'grafana',
        defined: true,
        enabled: 2,
        used: 2,
        weeks: [
          { week: '2026-09-07', runs: 2, enabled: 2, used: 1, usedRate: 0.5 },
          { week: '2026-09-14', runs: 0, enabled: 0, used: 0, usedRate: null },
          { week: '2026-09-21', runs: 0, enabled: 0, used: 0, usedRate: null },
          { week: '2026-09-28', runs: 1, enabled: 0, used: 1, usedRate: 1 },
        ],
      }),
    ]);
  });

  it('marks a skill spreading across the team and at each station that started to use it', () => {
    const records = [
      ...['a', 'b', 'c', 'd', 'e'].map((each, at) =>
        ran(`early_${each}`, day(`2026-09-0${8 + (at % 2)}`), {
          stationId: 'station_review',
        }),
      ),
      ...['a', 'b', 'c', 'd', 'e'].map((each) =>
        ran(`late_${each}`, day('2026-09-29'), {
          stationId: 'station_review',
          read: ['grafana'],
        }),
      ),
    ];

    const [skill] = insightsOf(records, WEEKS, []).skills;

    expect(skill?.trend).toBe('spreading');
    expect(skill?.defined).toBe(false);
    expect(skill?.stations).toEqual([
      {
        lineId: 'line_1',
        stationId: 'station_review',
        runs: 10,
        enabled: 0,
        used: 5,
        trend: 'spreading',
      },
    ]);
  });

  it('lists defined skills no run read as unused, even ones that stations enabled', () => {
    const insights = insightsOf(
      [
        ran('run_1', day('2026-09-29'), {
          skills: ['grafana', 'our-migrations'],
          read: ['grafana'],
        }),
      ],
      WEEKS,
      ['our-migrations', 'grafana', 'release-notes'],
    );

    expect(insights.unused).toEqual(['our-migrations', 'release-notes']);
  });

  it('measures each server’s runs, calls per run, latency, errors and failing runs', () => {
    const insights = insightsOf(
      [
        ran('run_1', day('2026-09-29'), {
          servers: [calls('linear', [100, 200, 300])],
        }),
        ran('run_2', day('2026-09-29'), {
          servers: [calls('linear', [400], 1, true)],
          ending: 'failed',
        }),
        ran('run_3', day('2026-09-29'), {
          servers: [calls('linear', [1_000], 1, false), calls('sentry', [50])],
          ending: 'failed',
        }),
      ],
      WEEKS,
      [],
    );

    expect(insights.servers).toEqual([
      {
        server: 'linear',
        runs: 3,
        calls: 5,
        callsPerRun: 5 / 3,
        p50Ms: 316,
        p95Ms: 1_414,
        failedCalls: 2,
        errorRate: 0.4,
        failingRuns: 1,
        refused: 0,
      },
      expect.objectContaining({ server: 'sentry', runs: 1, failingRuns: 0 }),
    ]);
  });

  it('counts the runs a tool or server was refused in, not the refusals', () => {
    const twice = ran('run_1', day('2026-09-29'), {
      servers: [calls('linear', [100])],
    })
      .refused(
        Refusal.of({
          tool: 'create_issue',
          server: 'linear',
          at: day('2026-09-29'),
        }),
      )
      .refused(
        Refusal.of({
          tool: 'create_issue',
          server: 'linear',
          at: day('2026-09-30'),
        }),
      )
      .refused(
        Refusal.of({
          tool: 'comment',
          server: 'linear',
          at: day('2026-09-30'),
        }),
      );

    const insights = insightsOf([twice], WEEKS, []);

    expect(insights.refusals).toEqual([
      { tool: 'comment', server: 'linear', refused: 1 },
      { tool: 'create_issue', server: 'linear', refused: 1 },
    ]);
    expect(insights.servers[0]?.refused).toBe(1);
  });

  it('counts refused approvals per tool of each server, and against that server', () => {
    const refused = (runId: string, tool: string, server: string | null) =>
      ran(runId, day('2026-09-29'), {
        servers: server ? [calls(server, [100])] : [],
      }).refused(Refusal.of({ tool, server, at: day('2026-09-30') }));

    const insights = insightsOf(
      [
        refused('run_1', 'create_issue', 'linear'),
        refused('run_2', 'create_issue', 'linear'),
        refused('run_3', 'create_issue', 'jira'),
        refused('run_4', 'github.merge', null),
      ],
      WEEKS,
      [],
    );

    expect(insights.refusals).toEqual([
      { tool: 'create_issue', server: 'linear', refused: 2 },
      { tool: 'create_issue', server: 'jira', refused: 1 },
      { tool: 'github.merge', server: null, refused: 1 },
    ]);
    expect(
      insights.servers.map(({ server, refused }) => ({ server, refused })),
    ).toEqual([
      { server: 'linear', refused: 2 },
      { server: 'jira', refused: 1 },
    ]);
  });

  it('leaves out runs cancelled before they ran', () => {
    const insights = insightsOf(
      [
        endedRecord('run_1', { ending: 'cancelled', skills: ['grafana'] }),
        ran('run_2', day('2026-09-29')),
      ],
      WEEKS,
      [],
    );

    expect(insights.runs).toBe(1);
    expect(insights.skills).toEqual([]);
  });
});

describe('toolCountsOf', () => {
  it('counts the runs that ran for the team, each station and each week, all of them first', () => {
    const counts = toolCountsOf(
      historyOf({
        records: [
          ran('run_1', day('2026-09-14'), {
            stationId: 'review',
            skills: ['grafana'],
          }),
          ran('run_2', day('2026-09-13'), { stationId: 'build' }),
          ran('run_3', day('2026-09-14'), {
            stationId: 'build',
            ending: 'cancelled',
          }),
          ran('run_4', day('2026-09-29'), { stationId: 'build' }),
        ],
      }),
      { from: day('2026-09-01'), to: day('2026-09-28') },
    );

    expect(counts.runs).toEqual([
      { stationId: null, week: null, runs: 2 },
      { stationId: null, week: '2026-09-07', runs: 1 },
      { stationId: null, week: '2026-09-14', runs: 1 },
      { stationId: 'build', week: null, runs: 1 },
      { stationId: 'build', week: '2026-09-07', runs: 1 },
      { stationId: 'review', week: null, runs: 1 },
      { stationId: 'review', week: '2026-09-14', runs: 1 },
    ]);
    expect(counts.stations.map((each) => each.stationId)).toEqual([
      'build',
      'review',
    ]);
    expect(counts.skills).toEqual([
      { key: 'grafana', stationId: null, week: null, enabled: 1, used: 0 },
      {
        key: 'grafana',
        stationId: null,
        week: '2026-09-14',
        enabled: 1,
        used: 0,
      },
      { key: 'grafana', stationId: 'review', week: null, enabled: 1, used: 0 },
      {
        key: 'grafana',
        stationId: 'review',
        week: '2026-09-14',
        enabled: 1,
        used: 0,
      },
    ]);
  });
});
