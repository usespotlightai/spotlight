import { GradeRunCommand } from '@insights/application/commands/grade-run.command';
import { GradeRunHandler } from '@insights/application/commands/handlers/grade-run.handler';
import type { StationJudge } from '@insights/application/ports/evidence.port';
import { InsightsAccess } from '@insights/application/services/insights-access.service';
import { RunScoresViews } from '@insights/application/services/run-scores-views.service';
import { StationJudgeReports } from '@insights/application/services/station-judge-reports.service';
import type { ScoreRecorded } from '@insights/domain/events/score-recorded.event';
import {
  JudgingsInMemory,
  judgeScore,
  queuedJudging,
  RUBRIC_VERSION,
  rubricOf,
  ScoresInMemory,
} from '@insights/domain/judging.fake-spec';
import {
  endedRecord,
  inTransaction,
  NOBODY_ELSE,
  RunRecordsInMemory,
  TaskPullRequestsInMemory,
  WORKSPACE,
} from '@insights/domain/runs.fake-spec';
import { ScoreScale } from '@insights/domain/value-objects/score-scale.vo';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const NUMBER_JUDGE: StationJudge = {
  teamId: 'team_1',
  lineId: 'line_1',
  rubric: 'scores: 1-5\nHow well did it retry?',
  rubricVersion: RUBRIC_VERSION,
  claims: [],
  passThreshold: 1,
  sample: 1,
  minAgreement: 0.5,
};

const CLAIMS_JUDGE: StationJudge = {
  teamId: 'team_1',
  lineId: 'line_1',
  rubric: null,
  rubricVersion: RUBRIC_VERSION,
  claims: ['It retries the upload.', 'It adds a test.'],
  passThreshold: 1,
  sample: 1,
  minAgreement: 0.5,
};

const grading = async (
  judged: ScoreScale | null = ScoreScale.yesNo(),
  station: StationJudge | null = null,
) => {
  const records = new RunRecordsInMemory();
  const scores = new ScoresInMemory();
  const judgings = new JudgingsInMemory();
  await records.add(endedRecord('run_1'));
  if (judged) {
    await scores.add(
      judgeScore('run_1', judged, judged.values[0] ?? 0, { taskId: 'task_1' }),
    );
    scores.events.length = 0;
  }
  const evidence = {
    hasTask: async () => true,
    of: async () => null,
    judgesOnTeam: async () => new Map(),
    judgeAt: async () => station,
  };
  const reports = new StationJudgeReports(
    evidence,
    scores,
    records,
    new TaskPullRequestsInMemory(),
  );
  let next = 0;
  const handler = new GradeRunHandler(
    new InsightsAccess({
      ...NOBODY_ELSE,
      membershipOnTeam: async (_teamId, principal) =>
        principal.userId.equals(UserId.of('user_stranger'))
          ? null
          : { workspaceId: WORKSPACE, by: principal.userId },
    }),
    new RunScoresViews(records, scores, reports, judgings),
    scores,
    inTransaction,
    {
      generate: () => {
        next += 1;
        return `grade_${next}`;
      },
    },
    { now: () => new Date('2026-09-30T12:00:00.000Z'), sleep: async () => {} },
  );

  return {
    scores,
    judgings,
    reports,
    grade: (value: boolean | number | null, by = 'user_ada', runId = 'run_1') =>
      handler.execute(new GradeRunCommand('team_1', runId, value, null, by)),
    gradeClaims: (claims: readonly boolean[] | null, by = 'user_ada') =>
      handler.execute(new GradeRunCommand('team_1', 'run_1', null, claims, by)),
  };
};

describe('GradeRunHandler', () => {
  it('records a person’s grade on the judge’s scale and rubric', async () => {
    const run = await grading();

    const scores = await run.grade(true);

    expect(scores.grades).toEqual([
      expect.objectContaining({ by: 'user_ada', mine: true, label: 'yes' }),
    ]);
    const grade = [...run.scores.stored.values()].find(
      (each) => !each.fromJudge,
    );
    expect(grade?.rubricVersion).toBe(RUBRIC_VERSION);
    expect((run.scores.events as ScoreRecorded[])[0]?.source).toBe('person');
  });

  it('replaces a person’s grade with their later one', async () => {
    const run = await grading();

    await run.grade(true);
    const scores = await run.grade(false);

    expect(scores.grades.map((each) => each.label)).toEqual(['no']);
  });

  it('keeps each person’s grade', async () => {
    const run = await grading();

    await run.grade(true, 'user_ada');
    const scores = await run.grade(false, 'user_grace');

    expect(scores.grades).toHaveLength(2);
  });

  it('grades a claims judge claim by claim, naming the claims to grade, and rejects a single value or the wrong number of claims', async () => {
    const run = await grading(null, CLAIMS_JUDGE);

    const scores = await run.gradeClaims([true, false]);

    expect(scores.kind).toBe('claims');
    expect(scores.claims).toEqual(CLAIMS_JUDGE.claims);
    expect(scores.grades[0]).toMatchObject({
      value: 0.5,
      claimResults: [true, false],
      label: '50% of claims met',
    });
    await expect(run.grade(true)).rejects.toBeInstanceOf(ApplicationError);
    await expect(run.gradeClaims([true])).rejects.toBeInstanceOf(
      ApplicationError,
    );
  });

  it('names the claims the judge marked, even once the station’s claims changed', async () => {
    const run = await grading(null, {
      ...CLAIMS_JUDGE,
      rubricVersion: 'd'.repeat(64),
    });
    await run.scores.add(
      judgeScore('run_1', ScoreScale.claims(), 0, {
        taskId: 'task_1',
        claimResults: [true, true, false],
      }),
    );
    const marked = [
      'It retries the upload.',
      'It adds a test.',
      'It leaves the handler alone.',
    ];
    await run.judgings.add(
      queuedJudging('run_1', rubricOf(null, RUBRIC_VERSION, marked)),
    );

    const scores = await run.gradeClaims([true, true, true]);

    expect(scores.claims).toEqual(marked);
    expect(scores.grades[0]?.claimResults).toEqual([true, true, true]);
  });

  it('grades on 1 to 5 where the judge did', async () => {
    const run = await grading(ScoreScale.oneToFive());

    expect((await run.grade(4)).grades[0]?.value).toBe(4);
    await expect(run.grade(true)).rejects.toBeInstanceOf(ApplicationError);
  });

  it('grades a run the judge has yet to score on the station’s rubric, and pairs the grade once the judge scores it', async () => {
    const run = await grading(null, NUMBER_JUDGE);

    expect((await run.grade(4)).kind).toBe('number');

    await run.scores.add(
      judgeScore('run_1', ScoreScale.oneToFive(), 3, { taskId: 'task_1' }),
    );
    const { report } = await run.reports.at({
      workspaceId: WORKSPACE,
      teamId: TeamId.of('team_1'),
      lineId: 'line_1',
      stationId: 'station_1',
    });

    expect(report.versions[0]?.agreement.pairs).toBe(1);
    expect(report.versions[0]?.agreement.mae).toBe(1);
  });

  it('grades yes or no where no judge scored the run', async () => {
    const run = await grading(null);

    expect((await run.grade(false)).kind).toBe('yes-no');
  });

  it('rejects a missing grade', async () => {
    const run = await grading();

    await expect(run.grade(null)).rejects.toMatchObject({
      kind: 'invalid',
    });
  });

  it('finds no run for someone off the team, nor a run it does not know', async () => {
    const run = await grading();

    await expect(run.grade(true, 'user_stranger')).rejects.toMatchObject({
      kind: 'not-found',
    });
    await expect(run.grade(true, 'user_ada', 'run_9')).rejects.toMatchObject({
      kind: 'not-found',
    });
  });
});
