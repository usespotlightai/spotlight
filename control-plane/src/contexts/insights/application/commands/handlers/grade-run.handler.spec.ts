import { GradeRunCommand } from '@insights/application/commands/grade-run.command';
import { GradeRunHandler } from '@insights/application/commands/handlers/grade-run.handler';
import { deletionsInMemory } from '@insights/application/ports/deletions.fake-spec';
import type { StationJudge } from '@insights/application/ports/station-judges.port';
import { ReadRunScoresHandler } from '@insights/application/queries/handlers/read-run-scores.handler';
import { ReadRunScoresQuery } from '@insights/application/queries/read-run-scores.query';
import { FactRecorder } from '@insights/application/services/fact-recorder.service';
import { GradingTermsOf } from '@insights/application/services/grading-terms-of.service';
import { InsightsAccess } from '@insights/application/services/insights-access.service';
import { RunScoresViews } from '@insights/application/services/run-scores-views.service';
import { StationJudgeReports } from '@insights/application/services/station-judge-reports.service';
import type { ScoreRecorded } from '@insights/domain/events/score-recorded.event';
import { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import {
  JudgingsInMemory,
  judgeScore,
  queuedJudging,
  RUBRIC_VERSION,
  rubricOf,
  ScoresInMemory,
} from '@insights/judging.fake-spec';
import {
  endedRecord,
  inTransaction,
  NOBODY_ELSE,
  RunRecordsInMemory,
  StationFactsInMemory,
  WORKSPACE,
} from '@insights/runs.fake-spec';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const CLAIMS_JUDGE: StationJudge = {
  teamId: TeamId.of('team_1'),
  lineId: LineId.of('line_1'),
  rubricVersion: RUBRIC_VERSION,
  claims: ['It retries the upload.', 'It adds a test.'],
  passThreshold: 1,
  sample: 1,
  minAgreement: 0.5,
};

const grading = async (
  judged: readonly boolean[] | null = [true, false],
  station: StationJudge | null = CLAIMS_JUDGE,
) => {
  const records = new RunRecordsInMemory();
  const scores = new ScoresInMemory();
  const judgings = new JudgingsInMemory();
  await records.add(endedRecord('run_1'));
  if (judged) {
    await scores.add(judgeScore('run_1', judged, { taskId: 'task_1' }));
    scores.events.length = 0;
  }
  const evidence = {
    hasTask: async () => true,
    of: async () => null,
    judgesOnTeam: async () => new Map(),
    judgeAt: async () => station,
  };
  const facts = new StationFactsInMemory(records, { scores });
  const reports = new StationJudgeReports(evidence, facts);
  let next = 0;
  const access = new InsightsAccess({
    ...NOBODY_ELSE,
    viewerOf: async (_teamId, principal) =>
      principal.userId.equals(UserId.of('user_stranger'))
        ? null
        : { workspaceId: WORKSPACE, by: principal.userId },
  });
  const terms = new GradingTermsOf(evidence, judgings);
  const views = new RunScoresViews(facts, reports, terms);
  const deletions = deletionsInMemory();
  const reading = new ReadRunScoresHandler(access, views);
  const handler = new GradeRunHandler(
    access,
    terms,
    records,
    scores,
    new FactRecorder(deletions),
    inTransaction,
    {
      generate: () => {
        next += 1;
        return `grade_${next}`;
      },
    },
    { now: () => new Date('2026-09-30T12:00:00.000Z'), sleep: async () => {} },
  );

  const graded = async (command: GradeRunCommand) => {
    await handler.execute(command);

    return reading.execute(
      new ReadRunScoresQuery(command.teamId, command.runId, command.viewerId),
    );
  };

  return {
    scores,
    judgings,
    reports,
    deletions,
    grade: (claims: readonly boolean[], by = 'user_ada', runId = 'run_1') =>
      graded(new GradeRunCommand('team_1', runId, claims, by)),
  };
};

describe('GradeRunHandler', () => {
  it('drops a grade of a run whose task was deleted meanwhile', async () => {
    const run = await grading();

    await run.deletions.markDeleted(
      DeletionScope.ofTask(WORKSPACE, TaskId.of('task_1')),
    );
    await run.grade([true, true]);

    expect(
      [...run.scores.stored.values()].filter((each) => !each.fromJudge),
    ).toEqual([]);
  });

  it('records a person’s grade claim by claim on the judge’s rubric and pass threshold', async () => {
    const run = await grading();

    const scores = await run.grade([true, false]);

    expect(scores.claims).toEqual(CLAIMS_JUDGE.claims);
    expect(scores.grades).toEqual([
      expect.objectContaining({
        by: 'user_ada',
        mine: true,
        value: 0.5,
        claimResults: [true, false],
        passes: false,
        label: '1 of 2 claims met',
      }),
    ]);
    const grade = [...run.scores.stored.values()].find(
      (each) => !each.fromJudge,
    );
    expect(grade?.rubricVersion).toBe(RUBRIC_VERSION);
    expect(grade?.passThreshold).toBe(1);
    expect((run.scores.events as ScoreRecorded[])[0]?.source).toBe('person');
  });

  it('replaces a person’s grade with their later one', async () => {
    const run = await grading();

    await run.grade([true, true]);
    const scores = await run.grade([false, false]);

    expect(scores.grades.map((each) => each.label)).toEqual([
      '0 of 2 claims met',
    ]);
  });

  it('keeps each person’s grade', async () => {
    const run = await grading();

    await run.grade([true, true], 'user_ada');
    const scores = await run.grade([false, true], 'user_grace');

    expect(scores.grades).toHaveLength(2);
  });

  it('rejects a grade that marks the wrong number of claims', async () => {
    const run = await grading();

    await expect(run.grade([true])).rejects.toBeInstanceOf(ApplicationError);
    await expect(run.grade([])).rejects.toMatchObject({ kind: 'invalid' });
  });

  it('names the claims the judge marked, even once the station’s claims changed', async () => {
    const run = await grading(null, {
      ...CLAIMS_JUDGE,
      rubricVersion: RubricVersion.of('d'.repeat(64)),
    });
    await run.scores.add(
      judgeScore('run_1', [true, true, false], { taskId: 'task_1' }),
    );
    const marked = [
      'It retries the upload.',
      'It adds a test.',
      'It leaves the handler alone.',
    ];
    await run.judgings.add(
      queuedJudging('run_1', rubricOf(RUBRIC_VERSION, marked)),
    );

    const scores = await run.grade([true, true, true]);

    expect(scores.claims).toEqual(marked);
    expect(scores.grades[0]?.claimResults).toEqual([true, true, true]);
  });

  it('grades a run the judge has yet to score on the station’s claims, and pairs the grade once the judge scores it', async () => {
    const run = await grading(null);

    expect((await run.grade([true, true])).gradable).toBe(true);

    await run.scores.add(
      judgeScore('run_1', [true, false], { taskId: 'task_1' }),
    );
    const { report } = await run.reports.at({
      workspaceId: WORKSPACE,
      teamId: TeamId.of('team_1'),
      lineId: LineId.of('line_1'),
      stationId: StationId.of('station_1'),
    });

    expect(report.versions[0]?.agreement.pairs).toBe(1);
    expect(report.versions[0]?.agreement.confusion.cells).toEqual([
      [0, 1],
      [0, 0],
    ]);
  });

  it('rejects a grade where neither the judge nor the station has claims', async () => {
    const run = await grading(null, null);

    await expect(run.grade([true])).rejects.toMatchObject({ kind: 'invalid' });
  });

  it('finds no run for someone off the team, nor a run it does not know', async () => {
    const run = await grading();

    await expect(
      run.grade([true, true], 'user_stranger'),
    ).rejects.toMatchObject({
      kind: 'not-found',
    });
    await expect(
      run.grade([true, true], 'user_ada', 'run_9'),
    ).rejects.toMatchObject({
      kind: 'not-found',
    });
  });
});
