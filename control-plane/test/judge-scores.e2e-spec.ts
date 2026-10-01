import { RecordJudgeScore } from '@outcomes/application/services/record-judge-score.service';
import { StationJudgeReports } from '@outcomes/application/services/station-judge-reports.service';
import { Judging } from '@outcomes/domain/aggregates/judging.aggregate';
import { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import { Score } from '@outcomes/domain/aggregates/score.aggregate';
import { RunJudged } from '@outcomes/domain/events/run-judged.event';
import { ScoreMovedOnError } from '@outcomes/domain/exceptions/score-moved-on.error';
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
    steps: [{ index: 4, kind: 'said', tool: null, text: 'Retrying.' }],
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
  Score.judged({
    id: ScoreId.of(`judge_${runId}`),
    runId: RunId.of(runId),
    workspaceId: WORKSPACE,
    place: placeOf(`task_${runId}`),
    fingerprint: CONFIG,
    scale: YES_NO,
    value,
    rubricVersion: VERSION,
    model: 'some/model',
    reasons: [reason()],
    seen: seen(),
    at,
  });

const graded = (runId: string, value: number, by = 'user_ada') =>
  Score.graded({
    id: ScoreId.of(`grade_${runId}_${by}`),
    runId: RunId.of(runId),
    workspaceId: WORKSPACE,
    place: placeOf(`task_${runId}`),
    fingerprint: CONFIG,
    scale: YES_NO,
    value,
    rubricVersion: VERSION,
    by: UserId.of(by),
    at: LATER,
  });

const endedRecord = (runId: string) =>
  RunRecord.heardOf(RunId.of(runId), WORKSPACE).ended(
    RunEnd.of({
      place: placeOf(`task_${runId}`),
      fingerprint: CONFIG,
      setup: RunSetup.of({
        harness: 'claude-code',
        model: null,
        effort: null,
        profileKey: null,
        repositories: [],
      }),
      queuedAt: null,
      startedAt: null,
      endedAt: NOW,
      ending: 'completed',
      failure: null,
      round: 1,
    }),
  );

let held: TestDatabase;
let judgings: DrizzleJudgingRepository;
let scores: DrizzleScoreRepository;
let records: DrizzleRunRecordRepository;
let reports: StationJudgeReports;
let context: DrizzleContext;
const dispatched: DomainEvent[] = [];

beforeAll(async () => {
  held = await openDatabase('judge_scores');
  context = new DrizzleContext(held.db);
  const dispatcher = {
    dispatch: async (events: readonly DomainEvent[]) => {
      dispatched.push(...events);
    },
  } as unknown as DomainEventDispatcher;
  judgings = new DrizzleJudgingRepository(context, dispatcher);
  scores = new DrizzleScoreRepository(context, dispatcher);
  records = new DrizzleRunRecordRepository(context);
  reports = new StationJudgeReports(
    {
      holds: async () => true,
      of: async () => null,
      judgeAt: async () => ({
        teamId: 'team_1',
        lineId: 'line_1',
        rubric: 'Did the run retry uploads?',
        rubricVersion: VERSION,
        sample: 1,
        trust: 0.5,
      }),
    },
    scores,
    records,
    new DrizzleTaskDeliveryRepository(context),
  );
}, 60_000);

afterAll(async () => {
  await held?.close();
});

describe('judgings, kept', () => {
  it('holds a judging as owed work until it is judged, and says so', async () => {
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

    const due = await judgings.dueForWork(NOW);
    expect(due?.runId.value).toBe('run_judged');

    const leased = due?.leased(NOW);
    if (!leased) {
      throw new Error('nothing was due');
    }
    await judgings.save(leased);
    expect(await judgings.dueForWork(NOW)).toBeNull();

    const held = await judgings.of(RunId.of('run_judged'));
    await judgings.save(
      held?.judged({
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
              kind: 'said',
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
    expect(done?.owesWork).toBe(false);
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
        Score.judged({
          id: ScoreId.of('judge_run_a_again'),
          runId: RunId.of('run_a'),
          workspaceId: WORKSPACE,
          place: placeOf('task_run_a'),
          fingerprint: CONFIG,
          scale: YES_NO,
          value: 0,
          rubricVersion: VERSION,
          model: 'some/model',
          reasons: [reason()],
          seen: seen(),
          at: LATER,
        }),
      ),
    ).rejects.toBeInstanceOf(ScoreMovedOnError);
  });

  it('keeps one grade per person for a run, replaced by their later one', async () => {
    await scores.add(graded('run_a', 1));

    await expect(
      scores.add(
        Score.graded({
          id: ScoreId.of('grade_twice'),
          runId: RunId.of('run_a'),
          workspaceId: WORKSPACE,
          place: placeOf('task_run_a'),
          fingerprint: CONFIG,
          scale: YES_NO,
          value: 0,
          rubricVersion: VERSION,
          by: UserId.of('user_ada'),
          at: LATER,
        }),
      ),
    ).rejects.toBeInstanceOf(ScoreMovedOnError);

    const mine = await scores.gradeBy(RunId.of('run_a'), UserId.of('user_ada'));
    await scores.save(
      mine?.regraded({
        scale: YES_NO,
        value: 0,
        rubricVersion: VERSION,
        at: LATER,
      }) as Score,
    );

    expect(
      (await scores.gradeBy(RunId.of('run_a'), UserId.of('user_ada')))?.value,
    ).toBe(0);
  });
});

describe('how often the judge agrees with people', () => {
  it('pairs the station’s judge scores with what people did, and trusts it once it agrees enough', async () => {
    for (let at = 0; at < 12; at += 1) {
      const runId = `run_${at}`;
      const yes = at % 2 === 0;
      await records.add(
        endedRecord(runId).actedOn(
          NextAct.of(yes ? 'approved' : 'sent-back', LATER),
        ),
      );
      await scores.add(
        judged(runId, yes ? 1 : 0, new Date(NOW.getTime() + at * 60_000)),
      );
    }

    const { report, standing } = await reports.at({
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
    expect(standing).toMatchObject({ trusted: true, measure: 'kappa' });
    expect(
      await reports.standingAt({
        workspaceId: WORKSPACE,
        teamId: TEAM,
        lineId: 'line_1',
        stationId: 'station_1',
      }),
    ).toEqual({ rubricVersion: VERSION, standing });
  });

  it('forgets a deleted task’s judgings and scores', async () => {
    await scores.removeForTask(TaskId.of('task_run_a'));
    await judgings.removeForTask(TaskId.of('task_judged'));

    expect(await scores.ofRuns([RunId.of('run_a')])).toEqual([]);
    expect(await judgings.of(RunId.of('run_judged'))).toBeNull();
  });

  it('forgets a judge’s score recorded while its task’s judgings were being forgotten', async () => {
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
        'some/model',
        [reason()],
        seen(),
        LATER,
      ),
    );
    await lockedNow;

    const forgetting = context.run(async () => {
      await judgings.removeForTask(TaskId.of('task_racing'));
      await scores.removeForTask(TaskId.of('task_racing'));
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    release();
    await Promise.all([recording, forgetting]);

    expect(await judgings.of(RunId.of('run_racing'))).toBeNull();
    expect(await scores.ofRuns([RunId.of('run_racing')])).toEqual([]);
  });
});
