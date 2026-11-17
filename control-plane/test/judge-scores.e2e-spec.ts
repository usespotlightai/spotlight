import {
  DeleteInsights,
  type InsightsRepositories,
} from '@insights/application/services/delete-insights.service';
import { FactRecorder } from '@insights/application/services/fact-recorder.service';
import { RecordJudgeScore } from '@insights/application/services/record-judge-score.service';
import { StationJudgeReports } from '@insights/application/services/station-judge-reports.service';
import { Judging } from '@insights/domain/aggregates/judging.aggregate';
import { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import { Score } from '@insights/domain/aggregates/score.aggregate';
import { RunJudged } from '@insights/domain/events/run-judged.event';
import { ScoreVersionConflictError } from '@insights/domain/exceptions/score-version-conflict.error';
import type { ScopedRemoval } from '@insights/domain/repositories/scoped-removal';
import { JudgeEvidence } from '@insights/domain/services/judge-evidence';
import { Citation } from '@insights/domain/value-objects/citation.vo';
import { ConfigFingerprint } from '@insights/domain/value-objects/config-fingerprint.vo';
import { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import { HumanAction } from '@insights/domain/value-objects/human-action.vo';
import { JudgeReason } from '@insights/domain/value-objects/judge-reason.vo';
import { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import { Rubric } from '@insights/domain/value-objects/rubric.vo';
import { RunAgentConfig } from '@insights/domain/value-objects/run-agent-config.vo';
import { RunEnd } from '@insights/domain/value-objects/run-end.vo';
import { RunLocation } from '@insights/domain/value-objects/run-location.vo';
import { ScoreId } from '@insights/domain/value-objects/score-id.vo';
import { SeenEvidence } from '@insights/domain/value-objects/seen-evidence.vo';
import { DrizzleDeletions } from '@insights/infrastructure/persistence/drizzle/ledgers/deletions.ledger';
import { DrizzleStationFacts } from '@insights/infrastructure/persistence/drizzle/readers/station-facts.reader';
import { DrizzleJudgingRepository } from '@insights/infrastructure/persistence/drizzle/repositories/judging.repository';
import { DrizzleRunRecordRepository } from '@insights/infrastructure/persistence/drizzle/repositories/run-record.repository';
import { DrizzleScoreRepository } from '@insights/infrastructure/persistence/drizzle/repositories/score.repository';
import { scoreFactOf } from '@insights/runs.fake-spec';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openDatabase, type TestDatabase } from './support/database';
import { projectedInsights } from './support/insights-facts';

const WORKSPACE = WorkspaceId.of('ws_1');
const TEAM = TeamId.of('team_1');
const VERSION = RubricVersion.of('c'.repeat(64));
const CONFIG = ConfigFingerprint.of('a'.repeat(64));
const NOW = new Date('2026-09-30T10:00:00.000Z');
const LATER = new Date('2026-09-30T12:00:00.000Z');
const CLAIMS_STATION = 'station_claims';
const CLAIMS_VERSION = RubricVersion.of('e'.repeat(64));
const CLAIMS = ['It retries the upload.', 'It adds a test for it.'] as const;

const locationOf = (taskId: string) =>
  RunLocation.of({
    teamId: TEAM,
    lineId: LineId.of('line_1'),
    stationId: StationId.of('station_1'),
    taskId: TaskId.of(taskId),
  });

const reason = () =>
  JudgeReason.of({
    text: 'It retried in the request.',
    citations: [Citation.ofStep(4), Citation.ofHunk('api/src/uploads.ts#1')],
    claim: 0,
  });

const seen = () =>
  SeenEvidence.of({
    steps: [{ index: 4, kind: 'message', tool: null, text: 'Retrying.' }],
    hunks: [
      {
        id: 'api/src/uploads.ts#1',
        path: 'api/src/uploads.ts',
        header: '@@ -1 +1 @@',
        lines: ['-upload()', '+retry(upload)'],
      },
    ],
  });

const judged = (runId: string, value: number, at = NOW) =>
  Score.judge({
    id: ScoreId.of(`judge_${runId}`),
    runId: RunId.of(runId),
    workspaceId: WORKSPACE,
    location: locationOf(`task_${runId}`),
    fingerprint: CONFIG,
    claimResults: [value === 1],
    passThreshold: 1,
    rubricVersion: VERSION,
    model: 'some/model',
    reasons: [reason()],
    seen: seen(),
    at,
  });

const endedRecord = (runId: string) =>
  RunRecord.empty(RunId.of(runId), WORKSPACE).recordEnd(
    RunEnd.of({
      location: locationOf(`task_${runId}`),
      fingerprint: CONFIG,
      agentConfig: RunAgentConfig.of({
        harness: 'claude-code',
        model: null,
        effort: null,
        profileKey: null,
        repositories: [],
        skills: [],
      }),
      queuedAt: null,
      startedAt: null,
      endedAt: NOW,
      ending: 'completed',
      failure: null,
      visit: 1,
      asked: false,
    }),
  );

let database: TestDatabase;
let judgings: DrizzleJudgingRepository;
let scores: DrizzleScoreRepository;
let records: DrizzleRunRecordRepository;
let reports: StationJudgeReports;
let context: DrizzleContext;
let facts: DrizzleStationFacts;
const dispatched: DomainEvent[] = [];

beforeAll(async () => {
  database = await openDatabase('judge_scores');
  context = new DrizzleContext(database.db);
  const dispatcher = {
    dispatch: async (events: readonly DomainEvent[]) => {
      dispatched.push(...events);
    },
  };
  judgings = new DrizzleJudgingRepository(context, dispatcher);
  scores = new DrizzleScoreRepository(context, dispatcher);
  const projected = projectedInsights(context);
  records = new DrizzleRunRecordRepository(context, {
    dispatch: async (events) => {
      dispatched.push(...events);
      await projected.dispatcher.dispatch(events);
    },
  });
  facts = new DrizzleStationFacts(context);
  reports = new StationJudgeReports(
    {
      judgesOnTeam: async () => new Map(),
      judgeAt: async (stationId) =>
        stationId.value === CLAIMS_STATION
          ? {
              teamId: TeamId.of('team_1'),
              lineId: LineId.of('line_1'),
              claims: [...CLAIMS],
              passThreshold: 0.5,
              rubricVersion: CLAIMS_VERSION,
              sample: 1,
              minAgreement: 0.5,
            }
          : {
              teamId: TeamId.of('team_1'),
              lineId: LineId.of('line_1'),
              claims: ['It retries the upload.'],
              passThreshold: 1,
              rubricVersion: VERSION,
              sample: 1,
              minAgreement: 0.5,
            },
    },
    facts,
  );
}, 60_000);

afterAll(async () => {
  await database?.close();
});

const erased = async <A extends { delete(): A }>(
  aggregates: ScopedRemoval<A>,
  taskId: TaskId,
): Promise<void> => {
  for (const each of await aggregates.ofScope(
    DeletionScope.ofTask(WORKSPACE, taskId),
    100,
  )) {
    await aggregates.save(each.delete());
  }
};

describe('judgings, stored', () => {
  it('stores a pending job for a judging until it is judged, and says so', async () => {
    await judgings.add(
      Judging.requested({
        runId: RunId.of('run_judged'),
        workspaceId: WORKSPACE,
        location: locationOf('task_judged'),
        fingerprint: CONFIG,
        rubric: Rubric.of({ claims: ['It retries.'], version: VERSION }),
        now: NOW,
      }),
    );

    const due = await judgings.nextDueJob(NOW);
    expect(due?.runId.value).toBe('run_judged');

    const leased = due?.leaseJob(NOW);
    if (!leased) {
      throw new Error('nothing was due');
    }
    await judgings.save(leased);
    expect(await judgings.nextDueJob(NOW)).toBeNull();

    const judging = await judgings.of(RunId.of('run_judged'));
    await judgings.save(
      judging?.recordVerdict({
        verdict: {
          claims: [
            {
              index: 0,
              met: true,
              reasons: [{ text: 'It retried.', steps: [4], hunks: [] }],
            },
          ],
        },
        evidence: JudgeEvidence.of({
          runId: RunId.of('run_judged'),
          title: 'Retry uploads',
          description: null,
          steps: [
            {
              index: 4,
              kind: 'message',
              tool: null,
              text: 'Retrying.',
              input: null,
              output: null,
            },
          ],
          hunks: [],
        }),
        model: 'some/model',
        now: LATER,
      }) as Judging,
    );

    const done = await judgings.of(RunId.of('run_judged'));
    expect(done?.hasPendingJob).toBe(false);
    expect(done?.judgedAt).toEqual(LATER);
    expect(done?.rubric.version).toBe(VERSION);
    expect(
      dispatched.some(
        (each) =>
          each.kind === 'judging.judged' &&
          (each as RunJudged).runId.value === 'run_judged',
      ),
    ).toBe(true);
  });
});

describe('scores, stored', () => {
  it('stores a judge’s score with its cited reasons', async () => {
    await scores.add(judged('run_a', 1));

    const [score] = await facts.scoresOfRuns([RunId.of('run_a')]);
    expect(score?.reasons[0]?.citations.map((each) => each.kind)).toEqual([
      'step',
      'hunk',
    ]);
    expect(score?.seen.stepAt(4)?.text).toBe('Retrying.');
    expect(score?.seen.hunkOf('api/src/uploads.ts#1')?.lines).toEqual([
      '-upload()',
      '+retry(upload)',
    ]);
    expect((await scores.of(RunId.of('run_a'), VERSION))?.id.value).toBe(
      'judge_run_a',
    );
  });

  it('stores one judge score for a run and rubric', async () => {
    await expect(
      scores.add(
        Score.judge({
          id: ScoreId.of('judge_run_a_again'),
          runId: RunId.of('run_a'),
          workspaceId: WORKSPACE,
          location: locationOf('task_run_a'),
          fingerprint: CONFIG,
          claimResults: [false],
          passThreshold: 1,
          rubricVersion: VERSION,
          model: 'some/model',
          reasons: [reason()],
          seen: seen(),
          at: LATER,
        }),
      ),
    ).rejects.toBeInstanceOf(ScoreVersionConflictError);
  });
});

describe('judge scores at many stations, read at once', () => {
  const ELSEWHERE = WorkspaceId.of('ws_stations');
  const NEXT_VERSION = 'd'.repeat(64);

  const judgedAt = (
    runId: string,
    at: number,
    where: {
      stationId: string;
      teamId?: string;
      lineId?: string;
      workspaceId?: WorkspaceId;
      rubricVersion?: string;
    },
  ) =>
    Score.judge({
      id: ScoreId.of(`judge_${runId}`),
      runId: RunId.of(runId),
      workspaceId: where.workspaceId ?? ELSEWHERE,
      location: RunLocation.of({
        teamId: TeamId.of(where.teamId ?? 'team_1'),
        lineId: LineId.of(where.lineId ?? 'line_1'),
        stationId: StationId.of(where.stationId),
        taskId: TaskId.of(`task_${runId}`),
      }),
      fingerprint: CONFIG,
      claimResults: [true],
      passThreshold: 1,
      rubricVersion: where.rubricVersion ?? VERSION,
      model: 'some/model',
      reasons: [reason()],
      seen: seen(),
      at: new Date(NOW.getTime() + at * 60_000),
    });

  it('reads the last judge scores of each requested station and rubric, and no others', async () => {
    const added = [
      ...[0, 1, 2, 3, 4].map((at) =>
        judgedAt(`many_a_${at}`, at, { stationId: 'station_a' }),
      ),
      judgedAt('many_a_tie', 2, { stationId: 'station_a' }),
      judgedAt('many_b_0', 0, { stationId: 'station_b' }),
      judgedAt('many_b_1', 1, { stationId: 'station_b' }),
      ...[2, 3, 4].map((at) =>
        judgedAt(`many_b_next_${at}`, at, {
          stationId: 'station_b',
          rubricVersion: NEXT_VERSION,
        }),
      ),
      judgedAt('many_c_0', 0, { stationId: 'station_c' }),
      judgedAt('many_other_team', 9, {
        stationId: 'station_a',
        teamId: 'team_2',
      }),
      judgedAt('many_unrequested', 9, { stationId: 'station_d' }),
      judgedAt('many_other_workspace', 9, {
        stationId: 'station_a',
        workspaceId: WorkspaceId.of('ws_stations_next_door'),
      }),
      judgedAt('many_other_line', 9, {
        stationId: 'station_a',
        lineId: 'line_2',
      }),
    ];
    for (const each of added) {
      await scores.add(each);
    }
    const stations = ['station_a', 'station_b', 'station_c'].map(
      (stationId) => ({
        lineId: LineId.of('line_1'),
        stationId: StationId.of(stationId),
        rubricVersion: VERSION,
      }),
    );

    const read = await facts.judgedAtStations({
      workspaceId: ELSEWHERE,
      teamId: TEAM,
      stations: [...stations, stations[0]],
      last: 3,
    });

    expect(read.map((each) => each.id.value).sort()).toEqual(
      [
        'judge_many_a_3',
        'judge_many_a_4',
        'judge_many_a_tie',
        'judge_many_b_0',
        'judge_many_b_1',
        'judge_many_c_0',
      ].sort(),
    );
    const oneByOne = await Promise.all(
      stations.map((each) =>
        facts.judgedAtStation({
          workspaceId: ELSEWHERE,
          teamId: TEAM,
          ...each,
          last: 3,
        }),
      ),
    );
    expect(read.map((each) => each.id.value).sort()).toEqual(
      oneByOne
        .flat()
        .map((each) => each.id.value)
        .sort(),
    );
    expect(read.find((each) => each.id.value === 'judge_many_a_4')).toEqual(
      scoreFactOf(added[4]),
    );
    expect(
      await facts.judgedAtStations({
        workspaceId: ELSEWHERE,
        teamId: TEAM,
        stations: [],
        last: 3,
      }),
    ).toEqual([]);
  });
});

describe('how often the judge agrees with people', () => {
  it('lists live judge verdicts since a time in time order, a page at a time', async () => {
    const since = new Date('2027-01-01T00:00:00.000Z');
    const placeOf = (taskId: string) =>
      RunLocation.of({
        teamId: TEAM,
        lineId: LineId.of('line_1'),
        stationId: StationId.of('station_since'),
        taskId: TaskId.of(taskId),
      });
    const hoursAfter = (hours: number) =>
      new Date(since.getTime() + hours * 60 * 60_000);
    const live = (runId: string, at: Date, origin?: 'backfill') =>
      Score.judge({
        id: ScoreId.of(`judge_${runId}`),
        runId: RunId.of(runId),
        workspaceId: WORKSPACE,
        location: placeOf(`task_${runId}`),
        fingerprint: CONFIG,
        claimResults: [true],
        passThreshold: 1,
        rubricVersion: VERSION,
        model: 'some/model',
        reasons: [reason()],
        seen: seen(),
        at,
        origin,
      });
    for (const each of [
      live('since_b', hoursAfter(1)),
      live('since_a', hoursAfter(2)),
      live('since_c', since),
      live('since_before', hoursAfter(-1)),
      live('since_backfilled', hoursAfter(1), 'backfill'),
    ]) {
      await scores.add(each);
    }

    const first = await facts.liveJudgedSince({ since, after: null, max: 2 });
    const second = await facts.liveJudgedSince({
      since,
      after: first[1] ?? null,
      max: 2,
    });

    expect(first.map((each) => each.runId.value)).toEqual([
      'since_c',
      'since_b',
    ]);
    expect(second.map((each) => each.runId.value)).toEqual(['since_a']);
    expect(first[1]).toMatchObject({
      scoreId: ScoreId.of('judge_since_b'),
      at: hoursAfter(1),
      workspaceId: WORKSPACE,
      location: placeOf('task_since_b'),
    });
  });

  it('pairs the station’s judge scores with what people did, and qualifies it once it agrees enough', async () => {
    for (let at = 0; at < 12; at += 1) {
      const runId = `run_${at}`;
      const yes = at % 2 === 0;
      await records.add(
        endedRecord(runId).recordAction(
          HumanAction.of(yes ? 'accepted' : 'sent-back', LATER),
        ),
      );
      await scores.add(
        judged(runId, yes ? 1 : 0, new Date(NOW.getTime() + at * 60_000)),
      );
    }

    const { report, calibration } = await reports.at({
      workspaceId: WORKSPACE,
      teamId: TEAM,
      lineId: LineId.of('line_1'),
      stationId: StationId.of('station_1'),
    });

    const [version] = report.versions;
    expect(version?.rubricVersion).toBe(VERSION);
    expect(version?.judged).toBe(13);
    expect(version?.agreement.pairs).toBe(12);
    expect(version?.agreement.confusion.cells).toEqual([
      [6, 0],
      [0, 6],
    ]);
    expect(report.coverage.runs).toBe(12);
    expect(calibration).toMatchObject({ qualified: true });
    expect(
      await reports.calibrationAt({
        workspaceId: WORKSPACE,
        teamId: TEAM,
        lineId: LineId.of('line_1'),
        stationId: StationId.of('station_1'),
      }),
    ).toEqual({ rubricVersion: VERSION, calibration });
  });

  it('deletes the judgings and scores of a deleted task', async () => {
    await erased(scores, TaskId.of('task_run_a'));
    await erased(judgings, TaskId.of('task_judged'));

    expect(await facts.scoresOfRuns([RunId.of('run_a')])).toEqual([]);
    expect(await judgings.of(RunId.of('run_judged'))).toBeNull();
  });

  it('keeps no judge’s score that was being recorded while its task was deleted', async () => {
    const deletions = new DrizzleDeletions(context);
    let loading = () => {};
    let release = () => {};
    const loadingNow = new Promise<void>((resolve) => {
      loading = resolve;
    });
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const recording = new RecordJudgeScore(
      Object.assign(Object.create(scores) as typeof scores, {
        of: async (runId: RunId, rubricVersion: RubricVersion) => {
          loading();
          await released;
          return scores.of(runId, rubricVersion);
        },
      }),
      new FactRecorder(deletions),
      context,
      { generate: () => 'judge_run_racing' },
    ).judged(
      new RunJudged(
        RunId.of('run_racing'),
        WORKSPACE,
        locationOf('task_racing'),
        CONFIG,
        VERSION,
        [true],
        1,
        'some/model',
        [reason()],
        seen(),
        LATER,
      ),
    );
    await loadingNow;

    const deleting = new DeleteInsights(
      { scores } as unknown as InsightsRepositories,
      deletions,
      context,
    ).scores(DeletionScope.ofTask(WORKSPACE, TaskId.of('task_racing')));
    await new Promise((resolve) => setTimeout(resolve, 200));
    release();
    await Promise.all([recording, deleting]);

    expect(await facts.scoresOfRuns([RunId.of('run_racing')])).toEqual([]);
  });
});

describe('a claims judge’s scores, stored', () => {
  const claimsLocation = (taskId: string) =>
    RunLocation.of({
      teamId: TEAM,
      lineId: LineId.of('line_1'),
      stationId: StationId.of(CLAIMS_STATION),
      taskId: TaskId.of(taskId),
    });

  it('stores each claim the judge marked, with a reason for each', async () => {
    await scores.add(
      Score.judge({
        id: ScoreId.of('judge_claims_0'),
        runId: RunId.of('claims_0'),
        workspaceId: WORKSPACE,
        location: claimsLocation('task_claims_0'),
        fingerprint: CONFIG,
        claimResults: [true, true],
        passThreshold: 0.5,
        rubricVersion: CLAIMS_VERSION,
        model: 'some/model',
        reasons: [0, 1].map((claim) =>
          JudgeReason.of({
            text: `Claim ${claim}.`,
            citations: [Citation.ofStep(4)],
            claim,
          }),
        ),
        seen: seen(),
        at: NOW,
      }),
    );

    const [stored] = await facts.scoresOfRuns([RunId.of('claims_0')]);
    expect(stored?.claimResults).toEqual([true, true]);
    expect(stored?.reasons.map((each) => each.claim)).toEqual([0, 1]);
  });
});
