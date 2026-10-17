import { RecordJudgeScore } from '@outcomes/application/services/record-judge-score.service';
import { StationJudgeReports } from '@outcomes/application/services/station-judge-reports.service';
import { Judging } from '@outcomes/domain/aggregates/judging.aggregate';
import { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import { Score } from '@outcomes/domain/aggregates/score.aggregate';
import { RunJudged } from '@outcomes/domain/events/run-judged.event';
import { ScoreVersionConflictError } from '@outcomes/domain/exceptions/score-version-conflict.error';
import { JudgeEvidence } from '@outcomes/domain/services/judge-evidence';
import { Citation } from '@outcomes/domain/value-objects/citation.vo';
import { JudgeReason } from '@outcomes/domain/value-objects/judge-reason.vo';
import { NextAct } from '@outcomes/domain/value-objects/next-act.vo';
import { Rubric } from '@outcomes/domain/value-objects/rubric.vo';
import { RunEnd } from '@outcomes/domain/value-objects/run-end.vo';
import { RunPlace } from '@outcomes/domain/value-objects/run-place.vo';
import { RunSetup } from '@outcomes/domain/value-objects/run-setup.vo';
import { ScoreId } from '@outcomes/domain/value-objects/score-id.vo';
import { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';
import { SeenEvidence } from '@outcomes/domain/value-objects/seen-evidence.vo';
import { DrizzleRunFactProjection } from '@outcomes/infrastructure/persistence/drizzle/projections/run-fact.projection';
import { DrizzleJudgingRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/judging.repository';
import { DrizzleRunRecordRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/run-record.repository';
import { DrizzleScoreRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/score.repository';
import { DrizzleTaskDeliveryRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/task-delivery.repository';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { DomainEventDispatcher } from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';

const WORKSPACE = WorkspaceId.of('ws_1');
const TEAM = TeamId.of('team_1');
const VERSION = 'c'.repeat(64);
const CONFIG = 'a'.repeat(64);
const NOW = new Date('2026-09-30T10:00:00.000Z');
const LATER = new Date('2026-09-30T12:00:00.000Z');
const YES_NO = ScoreScale.yesNo();
const CLAIMS_STATION = 'station_claims';
const CLAIMS_VERSION = 'e'.repeat(64);
const CLAIMS = ['It retries the upload.', 'It adds a test for it.'] as const;

const placeOf = (taskId: string) =>
  RunPlace.of({
    teamId: TEAM,
    lineId: 'line_1',
    stationId: 'station_1',
    taskId: TaskId.of(taskId),
  });

const reason = () =>
  JudgeReason.of({
    text: 'It retried in the request.',
    citations: [Citation.ofStep(4), Citation.ofHunk('api/src/uploads.ts#1')],
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
    place: placeOf(`task_${runId}`),
    fingerprint: CONFIG,
    scale: YES_NO,
    value,
    marks: null,
    rubricVersion: VERSION,
    model: 'some/model',
    reasons: [reason()],
    seen: seen(),
    at,
  });

const graded = (runId: string, value: number, by = 'user_ada') =>
  Score.grade({
    id: ScoreId.of(`grade_${runId}_${by}`),
    runId: RunId.of(runId),
    workspaceId: WORKSPACE,
    place: placeOf(`task_${runId}`),
    fingerprint: CONFIG,
    scale: YES_NO,
    value,
    marks: null,
    rubricVersion: VERSION,
    by: UserId.of(by),
    at: LATER,
  });

const endedRecord = (runId: string) =>
  RunRecord.heardOf(RunId.of(runId), WORKSPACE).recordEnd(
    RunEnd.of({
      place: placeOf(`task_${runId}`),
      fingerprint: CONFIG,
      setup: RunSetup.of({
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
      round: 1,
      asked: false,
    }),
  );

let database: TestDatabase;
let judgings: DrizzleJudgingRepository;
let scores: DrizzleScoreRepository;
let records: DrizzleRunRecordRepository;
let reports: StationJudgeReports;
let context: DrizzleContext;
const dispatched: DomainEvent[] = [];

beforeAll(async () => {
  database = await openDatabase('judge_scores');
  context = new DrizzleContext(database.db);
  const dispatcher = {
    dispatch: async (events: readonly DomainEvent[]) => {
      dispatched.push(...events);
    },
  } as unknown as DomainEventDispatcher;
  judgings = new DrizzleJudgingRepository(context, dispatcher);
  scores = new DrizzleScoreRepository(context, dispatcher);
  records = new DrizzleRunRecordRepository(
    context,
    new DrizzleRunFactProjection(context),
    dispatcher,
  );
  reports = new StationJudgeReports(
    {
      hasTask: async () => true,
      of: async () => null,
      judgesOnTeam: async () => new Map(),
      judgeAt: async (stationId) =>
        stationId === CLAIMS_STATION
          ? {
              teamId: 'team_1',
              lineId: 'line_1',
              rubric: null,
              claims: [...CLAIMS],
              passShare: 0.5,
              rubricVersion: CLAIMS_VERSION,
              sample: 1,
              trust: 0.5,
            }
          : {
              teamId: 'team_1',
              lineId: 'line_1',
              rubric: 'Did the run retry uploads?',
              claims: [],
              passShare: 1,
              rubricVersion: VERSION,
              sample: 1,
              trust: 0.5,
            },
    },
    scores,
    records,
    new DrizzleTaskDeliveryRepository(
      context,
      new DrizzleRunFactProjection(context),
      dispatcher,
    ),
  );
}, 60_000);

afterAll(async () => {
  await database?.close();
});

describe('judgings, kept', () => {
  it('keeps a pending job for a judging until it is judged, and says so', async () => {
    await judgings.add(
      Judging.asked({
        runId: RunId.of('run_judged'),
        workspaceId: WORKSPACE,
        place: placeOf('task_judged'),
        fingerprint: CONFIG,
        rubric: Rubric.of({ text: 'Did it retry?', version: VERSION }),
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
          value: true,
          reasons: [{ text: 'It retried.', steps: [4], hunks: [] }],
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
              given: null,
              returned: null,
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

describe('scores, kept', () => {
  it('keeps a judge’s score with its cited reasons', async () => {
    await scores.add(judged('run_a', 1));

    const [score] = await scores.ofRuns([RunId.of('run_a')]);
    expect(score?.fromJudge).toBe(true);
    expect(score?.reasons[0]?.citations.map((each) => each.kind)).toEqual([
      'step',
      'hunk',
    ]);
    expect(score?.seen.stepAt(4)?.text).toBe('Retrying.');
    expect(score?.seen.hunkOf('api/src/uploads.ts#1')?.lines).toEqual([
      '-upload()',
      '+retry(upload)',
    ]);
    expect((await scores.judgeOf(RunId.of('run_a'), VERSION))?.id.value).toBe(
      'judge_run_a',
    );
  });

  it('keeps one judge score for a run and rubric', async () => {
    await expect(
      scores.add(
        Score.judge({
          id: ScoreId.of('judge_run_a_again'),
          runId: RunId.of('run_a'),
          workspaceId: WORKSPACE,
          place: placeOf('task_run_a'),
          fingerprint: CONFIG,
          scale: YES_NO,
          value: 0,
          marks: null,
          rubricVersion: VERSION,
          model: 'some/model',
          reasons: [reason()],
          seen: seen(),
          at: LATER,
        }),
      ),
    ).rejects.toBeInstanceOf(ScoreVersionConflictError);
  });

  it('keeps one grade per person for a run, replaced by their later one', async () => {
    await scores.add(graded('run_a', 1));

    await expect(
      scores.add(
        Score.grade({
          id: ScoreId.of('grade_twice'),
          runId: RunId.of('run_a'),
          workspaceId: WORKSPACE,
          place: placeOf('task_run_a'),
          fingerprint: CONFIG,
          scale: YES_NO,
          value: 0,
          marks: null,
          rubricVersion: VERSION,
          by: UserId.of('user_ada'),
          at: LATER,
        }),
      ),
    ).rejects.toBeInstanceOf(ScoreVersionConflictError);

    const mine = await scores.gradeBy(RunId.of('run_a'), UserId.of('user_ada'));
    await scores.save(
      mine?.regrade({
        scale: YES_NO,
        value: 0,
        marks: null,
        rubricVersion: VERSION,
        at: LATER,
      }) as Score,
    );

    expect(
      (await scores.gradeBy(RunId.of('run_a'), UserId.of('user_ada')))?.value,
    ).toBe(0);
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
      place: RunPlace.of({
        teamId: TeamId.of(where.teamId ?? 'team_1'),
        lineId: where.lineId ?? 'line_1',
        stationId: where.stationId,
        taskId: TaskId.of(`task_${runId}`),
      }),
      fingerprint: CONFIG,
      scale: YES_NO,
      value: 1,
      marks: null,
      rubricVersion: where.rubricVersion ?? VERSION,
      model: 'some/model',
      reasons: [reason()],
      seen: seen(),
      at: new Date(NOW.getTime() + at * 60_000),
    });

  it('keeps the last judge scores of each asked station and rubric, and no others', async () => {
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
      judgedAt('many_unasked', 9, { stationId: 'station_d' }),
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
    await scores.add(
      Score.grade({
        id: ScoreId.of('grade_many_c_1'),
        runId: RunId.of('many_c_1'),
        workspaceId: ELSEWHERE,
        place: RunPlace.of({
          teamId: TEAM,
          lineId: 'line_1',
          stationId: 'station_c',
          taskId: TaskId.of('task_many_c_1'),
        }),
        fingerprint: CONFIG,
        scale: YES_NO,
        value: 1,
        marks: null,
        rubricVersion: VERSION,
        by: UserId.of('user_ada'),
        at: LATER,
      }),
    );
    const stations = ['station_a', 'station_b', 'station_c'].map(
      (stationId) => ({ lineId: 'line_1', stationId, rubricVersion: VERSION }),
    );

    const read = await scores.judgedAtStations({
      workspaceId: ELSEWHERE,
      teamId: TEAM,
      stations: [...stations, stations[0] as (typeof stations)[number]],
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
        scores.judgedAtStation({
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
      added[4],
    );
    expect(
      await scores.judgedAtStations({
        workspaceId: ELSEWHERE,
        teamId: TEAM,
        stations: [],
        last: 3,
      }),
    ).toEqual([]);
  });
});

describe('how often the judge agrees with people', () => {
  it('pairs the station’s judge scores with what people did, and trusts it once it agrees enough', async () => {
    for (let at = 0; at < 12; at += 1) {
      const runId = `run_${at}`;
      const yes = at % 2 === 0;
      await records.add(
        endedRecord(runId).recordAction(
          NextAct.of(yes ? 'closed' : 'sent-back', LATER),
        ),
      );
      await scores.add(
        judged(runId, yes ? 1 : 0, new Date(NOW.getTime() + at * 60_000)),
      );
    }

    const { report, calibration } = await reports.at({
      workspaceId: WORKSPACE,
      teamId: TEAM,
      lineId: 'line_1',
      stationId: 'station_1',
    });

    const [version] = report.versions;
    expect(version?.rubricVersion).toBe(VERSION);
    expect(version?.judged).toBe(13);
    expect(version?.agreement.pairs).toBe(13);
    expect(version?.agreement.confusion.cells).toEqual([
      [6, 0],
      [1, 6],
    ]);
    expect(report.coverage.runs).toBe(12);
    expect(calibration).toMatchObject({ trusted: true, measure: 'kappa' });
    expect(
      await reports.calibrationAt({
        workspaceId: WORKSPACE,
        teamId: TEAM,
        lineId: 'line_1',
        stationId: 'station_1',
      }),
    ).toEqual({ rubricVersion: VERSION, calibration });
  });

  it('deletes the judgings and scores of a deleted task', async () => {
    await scores.removeForTask(TaskId.of('task_run_a'));
    await judgings.removeForTask(TaskId.of('task_judged'));

    expect(await scores.ofRuns([RunId.of('run_a')])).toEqual([]);
    expect(await judgings.of(RunId.of('run_judged'))).toBeNull();
  });

  it('deletes a judge’s score recorded while its task’s judgings were being deleted', async () => {
    await judgings.add(
      Judging.asked({
        runId: RunId.of('run_racing'),
        workspaceId: WORKSPACE,
        place: placeOf('task_racing'),
        fingerprint: CONFIG,
        rubric: Rubric.of({ text: 'Did it retry?', version: VERSION }),
        now: NOW,
      }),
    );
    let locked = () => {};
    let release = () => {};
    const lockedNow = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const recording = new RecordJudgeScore(
      Object.assign(Object.create(judgings), {
        ofForScoring: async (runId: RunId) => {
          const found = await judgings.ofForScoring(runId);
          locked();
          await released;
          return found;
        },
      }),
      scores,
      context,
      { generate: () => 'judge_run_racing' },
    ).judged(
      new RunJudged(
        RunId.of('run_racing'),
        WORKSPACE,
        placeOf('task_racing'),
        CONFIG,
        VERSION,
        YES_NO,
        1,
        null,
        'some/model',
        [reason()],
        seen(),
        LATER,
      ),
    );
    await lockedNow;

    const deleting = context.inTransaction(async () => {
      await judgings.removeForTask(TaskId.of('task_racing'));
      await scores.removeForTask(TaskId.of('task_racing'));
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    release();
    await Promise.all([recording, deleting]);

    expect(await judgings.of(RunId.of('run_racing'))).toBeNull();
    expect(await scores.ofRuns([RunId.of('run_racing')])).toEqual([]);
  });
});

describe('how often a claims judge agrees with people, claim by claim', () => {
  const claimsPlace = (taskId: string) =>
    RunPlace.of({
      teamId: TEAM,
      lineId: 'line_1',
      stationId: CLAIMS_STATION,
      taskId: TaskId.of(taskId),
    });
  const share = (marks: readonly boolean[]) =>
    marks.filter(Boolean).length / marks.length;

  it('keeps each claim the judge and people marked, and weighs their agreement on each claim and over all of them', async () => {
    for (let at = 0; at < 12; at += 1) {
      const runId = `claims_${at}`;
      const retried = at % 2 === 0;
      const tested = at % 3 === 0;
      const judgeMarks = [retried, at % 4 === 0];
      const personMarks = [retried, tested];

      await scores.add(
        Score.judge({
          id: ScoreId.of(`judge_${runId}`),
          runId: RunId.of(runId),
          workspaceId: WORKSPACE,
          place: claimsPlace(`task_${runId}`),
          fingerprint: CONFIG,
          scale: ScoreScale.claims(),
          value: share(judgeMarks),
          marks: judgeMarks,
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
          at: new Date(NOW.getTime() + at * 60_000),
        }),
      );
      await scores.add(
        Score.grade({
          id: ScoreId.of(`grade_${runId}`),
          runId: RunId.of(runId),
          workspaceId: WORKSPACE,
          place: claimsPlace(`task_${runId}`),
          fingerprint: CONFIG,
          scale: ScoreScale.claims(),
          value: share(personMarks),
          marks: personMarks,
          rubricVersion: CLAIMS_VERSION,
          by: UserId.of('user_ada'),
          at: LATER,
        }),
      );
    }

    const kept = (await scores.ofRuns([RunId.of('claims_0')])).find(
      (each) => each.fromJudge,
    );
    expect(kept?.marks).toEqual([true, true]);
    expect(kept?.reasons.map((each) => each.claim)).toEqual([0, 1]);

    const { report, calibration } = await reports.at({
      workspaceId: WORKSPACE,
      teamId: TEAM,
      lineId: 'line_1',
      stationId: CLAIMS_STATION,
    });

    const [version] = report.versions;
    expect(version?.scale.kind).toBe('claims');
    expect(version?.agreement.pairs).toBe(12);
    expect(version?.agreement.claims.map((each) => each.index)).toEqual([0, 1]);
    expect(version?.agreement.claims[0]).toMatchObject({
      pairs: 12,
      observed: 1,
      kappa: 1,
    });
    expect(version?.agreement.claims[1]?.observed).toBeCloseTo(7 / 12);
    expect(version?.agreement.observed).toBeCloseTo(19 / 24);
    expect(calibration).toMatchObject({
      measure: 'kappa',
      pairs: 12,
      agreement: version?.agreement.kappa,
    });
  });
});
