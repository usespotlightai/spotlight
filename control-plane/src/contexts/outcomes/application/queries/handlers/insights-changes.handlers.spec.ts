import { insightsReaderInMemory } from '@outcomes/application/ports/insights-reader.fake-spec';
import type { JudgeStandingPort } from '@outcomes/application/ports/judge-standing.port';
import type { MemoryUsePort } from '@outcomes/application/ports/memory-use.port';
import type { PeoplePort } from '@outcomes/application/ports/people.port';
import type { WorkPort } from '@outcomes/application/ports/work.port';
import { ReadInsightsChangesHandler } from '@outcomes/application/queries/handlers/read-insights-changes.handler';
import { ReadInsightsMemoryHandler } from '@outcomes/application/queries/handlers/read-insights-memory.handler';
import { ReadInsightsSetupsHandler } from '@outcomes/application/queries/handlers/read-insights-setups.handler';
import { ReadStationAlertHandler } from '@outcomes/application/queries/handlers/read-station-alert.handler';
import { ReadInsightsChangesQuery } from '@outcomes/application/queries/read-insights-changes.query';
import { ReadInsightsMemoryQuery } from '@outcomes/application/queries/read-insights-memory.query';
import { ReadInsightsSetupsQuery } from '@outcomes/application/queries/read-insights-setups.query';
import { ReadStationAlertQuery } from '@outcomes/application/queries/read-station-alert.query';
import { OutcomesAccess } from '@outcomes/application/services/outcomes-access.service';
import { TeamScopes } from '@outcomes/application/services/team-scopes.service';
import { TrustedJudges } from '@outcomes/application/services/trusted-judges.service';
import { StationWatch } from '@outcomes/domain/aggregates/station-watch.aggregate';
import { StationWatchesInMemory } from '@outcomes/domain/alerts.fake-spec';
import {
  ChatRecordsInMemory,
  day,
  TaskFailuresInMemory,
  TaskTouchesInMemory,
} from '@outcomes/domain/insights.fake-spec';
import { judgeScore, ScoresInMemory } from '@outcomes/domain/judging.fake-spec';
import {
  costedRecord,
  FIRST_CONFIG,
  RunRecordsInMemory,
  SECOND_CONFIG,
  TaskDeliveriesInMemory,
  TEAM,
  WORKSPACE,
} from '@outcomes/domain/outcomes.fake-spec';
import { AlertId } from '@outcomes/domain/value-objects/alert-id.vo';
import { AlertRule } from '@outcomes/domain/value-objects/alert-rule.vo';
import { NextAct } from '@outcomes/domain/value-objects/next-act.vo';
import { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-01T15:00:00.000Z');

const ADA = PersonPrincipal.of(UserId.of('user_ada'));

const STRANGER = PersonPrincipal.of(UserId.of('user_eve'));

const people: PeoplePort = {
  membershipOnTeam: async (_teamId, principal) =>
    principal.kind === 'person' &&
    principal.userId.equals(UserId.of('user_ada'))
      ? { workspaceId: WorkspaceId.of('ws_1'), by: principal.userId }
      : null,
  namesOf: async (ids) => new Map(ids.map((each) => [each, `Name of ${each}`])),
};

const modelOf = (fingerprint: string): string =>
  fingerprint === FIRST_CONFIG ? 'sonnet' : 'opus';

const WORK: WorkPort = {
  endedRun: async () => null,
  configsInOrder: async (fingerprints) =>
    fingerprints.map((fingerprint, at) => ({
      fingerprint,
      config: {
        prompt: null,
        harness: 'claude-code',
        model: modelOf(fingerprint),
        effort: null,
        profile: null,
        image: null,
        repositories: [],
        skills: [],
        tools: [],
        decisions: false,
        memories: false,
      },
      changes:
        at === 0 || fingerprints[at - 1] === fingerprint
          ? []
          : [
              {
                part: 'model',
                name: null,
                kind: 'changed' as const,
                was: modelOf(fingerprints[at - 1] ?? ''),
                now: modelOf(fingerprint),
              },
            ],
    })),
  teamRepositories: async () => [],
  teamSkillKeys: async () => [],
  alertsAt: async () => null,
};

const standing = (trusted: boolean): JudgeStandingPort => ({
  standingsOf: async (_team, stations) =>
    stations.map((station) => ({
      stationId: station.stationId,
      rubricVersion: 'c'.repeat(64),
      trusted,
      measure: 'kappa',
      agreement: trusted ? 0.8 : 0.2,
      pairs: 20,
      trust: 0.6,
      hiddenBecause: trusted ? null : 'below-trust',
    })),
});

const held = async (
  more: readonly (readonly [
    string,
    number,
    string,
    'sonnet' | 'opus',
    'closed' | 'sent-back',
  ])[] = [],
) => {
  const records = new RunRecordsInMemory();
  const deliveries = new TaskDeliveriesInMemory();
  const scores = new ScoresInMemory();
  const scopes = new TeamScopes(new OutcomesAccess(people), {
    now: () => NOW,
    sleep: async () => {},
  });
  const reader = insightsReaderInMemory(
    {
      records,
      deliveries,
      touches: new TaskTouchesInMemory(records),
      failures: new TaskFailuresInMemory(),
      chats: new ChatRecordsInMemory(),
    },
    scores,
  );

  for (const [runId, hour, fingerprint, model, act] of [
    ['run_1', 9, FIRST_CONFIG, 'sonnet', 'sent-back'],
    ['run_2', 10, FIRST_CONFIG, 'sonnet', 'closed'],
    ['run_3', 11, SECOND_CONFIG, 'opus', 'closed'],
    ['run_4', 12, SECOND_CONFIG, 'opus', 'closed'],
    ...more,
  ] as const) {
    await records.add(
      costedRecord(runId, {
        taskId: `task_${runId}`,
        fingerprint,
        model,
        amount: model === 'opus' ? 2 : 1,
        startedAt: day('2026-09-29', hour),
        endedAt: day('2026-09-29', hour),
        changedLines: model === 'opus' ? 500 : 10,
      }).recordAction(NextAct.of(act, day('2026-09-29', hour))),
    );
  }
  await scores.add(judgeScore('run_1', ScoreScale.yesNo(), 0));
  await scores.add(judgeScore('run_3', ScoreScale.yesNo(), 1));

  return { records, deliveries, scores, scopes, reader };
};

describe('ReadInsightsChangesHandler', () => {
  it('opens each config change with the station’s tally before and after it and what changed, reading every config at once', async () => {
    const { scopes, reader } = await held();
    const asked: (readonly string[])[] = [];
    const handler = new ReadInsightsChangesHandler(
      scopes,
      reader,
      new TrustedJudges(standing(true)),
      {
        ...WORK,
        configsInOrder: (fingerprints) => {
          asked.push(fingerprints);
          return WORK.configsInOrder(fingerprints);
        },
      },
    );

    const changes = await handler.execute(
      new ReadInsightsChangesQuery('team_1', ADA, '30d'),
    );

    expect(changes.markers).toHaveLength(1);
    const [marker] = changes.markers;
    expect(marker?.fingerprint).toBe(SECOND_CONFIG);
    expect(marker?.previousFingerprint).toBe(FIRST_CONFIG);
    expect(marker?.before.runs).toBe(2);
    expect(marker?.before.sentBack).toBe(1);
    expect(marker?.after.accepted).toBe(2);
    expect(
      marker?.verdicts.find((each) => each.measure === 'accepted_rate'),
    ).toMatchObject({
      settledBefore: 2,
      settledAfter: 2,
      verdict: 'insufficient',
    });
    expect(marker?.changes).toEqual([
      expect.objectContaining({ part: 'model', was: 'sonnet', now: 'opus' }),
    ]);
    expect(marker?.judgeBefore).toEqual({ mean: 0, judged: 1 });
    expect(marker?.judgeAfter).toEqual({ mean: 1, judged: 1 });
    expect(asked).toEqual([[FIRST_CONFIG, SECOND_CONFIG]]);
  });

  it('opens a return to the earlier config as a change of its own, set against the stretch just before it', async () => {
    const { scopes, reader } = await held([
      ['run_5', 13, FIRST_CONFIG, 'sonnet', 'sent-back'],
      ['run_6', 14, FIRST_CONFIG, 'sonnet', 'sent-back'],
      ['run_7', 15, FIRST_CONFIG, 'sonnet', 'closed'],
    ]);
    const asked: (readonly string[])[] = [];
    const handler = new ReadInsightsChangesHandler(
      scopes,
      reader,
      new TrustedJudges(standing(true)),
      {
        ...WORK,
        configsInOrder: (fingerprints) => {
          asked.push(fingerprints);
          return WORK.configsInOrder(fingerprints);
        },
      },
    );

    const changes = await handler.execute(
      new ReadInsightsChangesQuery('team_1', ADA, '30d'),
    );

    expect(
      changes.markers.map((each) => [
        each.runId,
        each.previousFingerprint,
        each.fingerprint,
        each.before.runs,
        each.after.runs,
        each.after.sentBack,
        each.changes.map((change) => [change.was, change.now]),
      ]),
    ).toEqual([
      ['run_3', FIRST_CONFIG, SECOND_CONFIG, 2, 2, 0, [['sonnet', 'opus']]],
      ['run_5', SECOND_CONFIG, FIRST_CONFIG, 2, 3, 2, [['opus', 'sonnet']]],
    ]);
    expect(changes.markers[1]?.judgeBefore).toEqual({ mean: 1, judged: 1 });
    expect(asked).toEqual([
      [FIRST_CONFIG, SECOND_CONFIG, SECOND_CONFIG, FIRST_CONFIG],
    ]);
  });

  it('shows no judge scores where the station’s judge is not trusted', async () => {
    const { scopes, reader } = await held();
    const handler = new ReadInsightsChangesHandler(
      scopes,
      reader,
      new TrustedJudges(standing(false)),
      WORK,
    );

    const changes = await handler.execute(
      new ReadInsightsChangesQuery('team_1', ADA, '30d'),
    );

    expect(changes.markers[0]?.judgeBefore).toBeNull();
    expect(changes.judges).toEqual([
      expect.objectContaining({
        stationId: 'station_1',
        trusted: false,
        hiddenBecause: 'below-trust',
      }),
    ]);
  });

  it('finds no team for someone not on it', async () => {
    const { scopes, reader } = await held();
    const handler = new ReadInsightsChangesHandler(
      scopes,
      reader,
      new TrustedJudges(standing(true)),
      WORK,
    );

    await expect(
      handler.execute(new ReadInsightsChangesQuery('team_1', STRANGER, '30d')),
    ).rejects.toMatchObject({ kind: 'not-found' });
  });
});

describe('ReadInsightsSetupsHandler', () => {
  it('compares setups, narrowed by station and run size, and judge scores only within one station', async () => {
    const { scopes, reader } = await held();
    const handler = new ReadInsightsSetupsHandler(
      scopes,
      reader,
      new TrustedJudges(standing(true)),
    );

    const all = await handler.execute(
      new ReadInsightsSetupsQuery('team_1', ADA, '30d', null, null),
    );
    const atStation = await handler.execute(
      new ReadInsightsSetupsQuery('team_1', ADA, '30d', 'station_1', null),
    );
    const large = await handler.execute(
      new ReadInsightsSetupsQuery('team_1', ADA, '30d', 'station_1', 'large'),
    );
    const elsewhere = await handler.execute(
      new ReadInsightsSetupsQuery('team_1', ADA, '30d', 'station_9', null),
    );

    expect(all.setups.map((each) => each.model)).toEqual(['opus', 'sonnet']);
    expect(all.setups.map((each) => each.judge)).toEqual([null, null]);
    expect(all.judgeWithheld).toBe('no_station');
    expect(all.judges).toEqual([]);
    expect(atStation.setups.map((each) => each.judge?.judged)).toEqual([1, 1]);
    expect(atStation.judgeWithheld).toBeNull();
    expect(atStation.judges).toHaveLength(1);
    expect(large.setups.map((each) => each.model)).toEqual(['opus']);
    expect(large.size).toBe('large');
    expect(elsewhere.setups).toEqual([]);
  });

  it('refuses a size it does not know', async () => {
    const { scopes, reader } = await held();
    const handler = new ReadInsightsSetupsHandler(
      scopes,
      reader,
      new TrustedJudges(standing(true)),
    );

    await expect(
      handler.execute(
        new ReadInsightsSetupsQuery('team_1', ADA, '30d', null, 'huge'),
      ),
    ).rejects.toMatchObject({ kind: 'invalid' });
  });
});

describe('ReadInsightsMemoryHandler', () => {
  it('sets runs with memories against runs without, and names who flagged one wrong', async () => {
    const { scopes, reader, records } = await held();
    const asked: unknown[] = [];
    const memory: MemoryUsePort = {
      between: async (window) => {
        asked.push(window.teamId.value);
        return {
          standing: 5,
          flagged: [
            {
              memoryId: 'mem_1',
              handle: 'M-1',
              body: 'Run the migrations first.',
              reason: 'Not any more',
              by: 'user_ada',
              at: day('2026-09-29'),
            },
          ],
        };
      },
    };
    for (const [runId, way, memories] of [
      ['run_2', 'briefed', ['mem_1', 'mem_2']],
      ['run_3', 'recalled', ['mem_2']],
      ['run_4', 'briefed', []],
    ] as const) {
      const record = await records.of(RunId.of(runId));

      if (record) {
        await records.save(record.recordMemories(way, memories));
      }
    }
    const handler = new ReadInsightsMemoryHandler(
      scopes,
      reader,
      memory,
      { latestFor: async () => null },
      people,
    );

    const read = await handler.execute(
      new ReadInsightsMemoryQuery('team_1', ADA, '30d'),
    );

    expect(asked).toEqual(['team_1']);
    expect(read.standing).toBe(5);
    expect(read.memoriesBriefed).toBe(2);
    expect(read.memoriesRecalled).toBe(1);
    expect(read.runsBriefed).toBe(1);
    expect(read.runsRecalled).toBe(1);
    expect(read.withMemories.runs).toBe(2);
    expect(read.withMemories.accepted).toBe(2);
    expect(read.withoutMemories.runs).toBe(2);
    expect(read.withoutMemories.sentBack).toBe(1);
    expect(read.flagged[0]?.byName).toBe('Name of user_ada');
    expect(read.benchmark).toBeNull();
  });
});

describe('ReadStationAlertHandler', () => {
  const alerted = async () => {
    const { records, deliveries } = await held();
    const watches = new StationWatchesInMemory();
    const rule = AlertRule.of({
      measure: 'sent_back_rate',
      above: 0.4,
      over: 2,
    });
    const watch = StationWatch.start({
      workspaceId: WORKSPACE,
      teamId: TEAM,
      lineId: 'line_1',
      stationId: 'station_1',
    }).check(
      [
        {
          rule,
          reading: {
            value: 0.6,
            baseline: null,
            runId: RunId.of('run_2'),
            taskId: TaskId.of('task_run_2'),
          },
        },
      ],
      day('2026-09-29', 10),
      () => AlertId.of('alert_1'),
    );
    await watches.add(watch);

    return new ReadStationAlertHandler(
      new OutcomesAccess(people),
      watches,
      records,
      deliveries,
      { now: () => NOW, sleep: async () => {} },
    );
  };

  it('reads the threshold crossed and the measure run by run around it, its own run pinned to the reading it raised on', async () => {
    const handler = await alerted();

    const alert = await handler.execute(
      new ReadStationAlertQuery('team_1', ADA, 'alert_1'),
    );

    expect(alert.threshold).toEqual({
      measure: 'sent_back_rate',
      risesBy: null,
      fallsBy: null,
      above: 0.4,
      below: null,
      over: 2,
    });
    expect(alert.taskId).toBe('task_run_2');
    expect(alert.insightsPeriod).toBe('7d');
    expect(alert.series.map((each) => [each.runId, each.value])).toEqual([
      ['run_1', null],
      ['run_2', 0.6],
      ['run_3', 0],
      ['run_4', 0],
    ]);
  });

  it('finds no alert of another team, nor one that never went off', async () => {
    const handler = await alerted();

    await expect(
      handler.execute(new ReadStationAlertQuery('team_1', ADA, 'alert_9')),
    ).rejects.toMatchObject({ kind: 'not-found' });
    await expect(
      handler.execute(new ReadStationAlertQuery('team_1', STRANGER, 'alert_1')),
    ).rejects.toMatchObject({ kind: 'not-found' });
  });
});
