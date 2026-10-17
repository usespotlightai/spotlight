import type { StationJudge } from '@outcomes/application/ports/evidence.port';
import { ReadRunScoresHandler } from '@outcomes/application/queries/handlers/read-run-scores.handler';
import { ReadRunScoresQuery } from '@outcomes/application/queries/read-run-scores.query';
import { OutcomesAccess } from '@outcomes/application/services/outcomes-access.service';
import { RunScoresViews } from '@outcomes/application/services/run-scores-views.service';
import { StationJudgeReports } from '@outcomes/application/services/station-judge-reports.service';
import { Score } from '@outcomes/domain/aggregates/score.aggregate';
import {
  JudgingsInMemory,
  judgeScore,
  NEXT_RUBRIC_VERSION,
  placeOf,
  queuedJudging,
  RUBRIC_VERSION,
  rubricOf,
  ScoresInMemory,
} from '@outcomes/domain/judging.fake-spec';
import {
  endedRecord,
  NOBODY_ELSE,
  RunRecordsInMemory,
  TaskDeliveriesInMemory,
  WORKSPACE,
} from '@outcomes/domain/outcomes.fake-spec';
import { Citation } from '@outcomes/domain/value-objects/citation.vo';
import { JudgeReason } from '@outcomes/domain/value-objects/judge-reason.vo';
import { NextAct } from '@outcomes/domain/value-objects/next-act.vo';
import { ScoreId } from '@outcomes/domain/value-objects/score-id.vo';
import { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';
import { SeenEvidence } from '@outcomes/domain/value-objects/seen-evidence.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const JUDGE: StationJudge = {
  teamId: 'team_1',
  lineId: 'line_1',
  rubric: 'Did the run retry uploads?',
  rubricVersion: RUBRIC_VERSION,
  claims: [],
  passShare: 1,
  sample: 1,
  trust: 0.5,
};

const AT = new Date('2026-09-30T11:00:00.000Z');

const reading = async (agreeing: boolean, scoredBy = RUBRIC_VERSION) => {
  const records = new RunRecordsInMemory();
  const scores = new ScoresInMemory();
  const judgings = new JudgingsInMemory();
  await records.add(endedRecord('run_1'));
  await judgings.add(
    queuedJudging('run_1', rubricOf('scores: yes-no\nDid it retry?', scoredBy)),
  );
  await scores.add(
    Score.judge({
      id: ScoreId.of('score_1'),
      runId: RunId.of('run_1'),
      workspaceId: WORKSPACE,
      place: placeOf(),
      fingerprint: null,
      scale: ScoreScale.yesNo(),
      value: 1,
      marks: null,
      rubricVersion: scoredBy,
      model: 'some/model',
      reasons: [
        JudgeReason.of({
          text: 'It retries the upload.',
          citations: [
            Citation.ofStep(5),
            Citation.ofHunk('api/src/uploads.ts#1'),
          ],
        }),
      ],
      seen: SeenEvidence.of({
        steps: [
          { index: 5, kind: 'tool', tool: 'edit', text: 'src/uploads.ts' },
        ],
        hunks: [
          {
            id: 'api/src/uploads.ts#1',
            path: 'api/src/uploads.ts',
            header: '@@ -1 +1 @@',
            lines: ['-upload()', '+retry(upload)'],
          },
        ],
      }),
      at: new Date('2026-09-30T10:05:00.000Z'),
    }),
  );

  for (let at = 0; at < 10; at += 1) {
    const runId = `run_other_${at}`;
    const yes = at % 2 === 0;
    await records.add(
      endedRecord(runId, { taskId: `task_${runId}` }).recordAction(
        NextAct.of(yes === agreeing ? 'closed' : 'sent-back', AT),
      ),
    );
    await scores.add(judgeScore(runId, ScoreScale.yesNo(), yes ? 1 : 0));
  }

  const evidence = {
    hasTask: async () => true,
    of: async () => {
      throw new Error('the run’s journal is never read again');
    },
    judgesOnTeam: async () => new Map(),
    judgeAt: async () => JUDGE,
  };

  return new ReadRunScoresHandler(
    new OutcomesAccess({
      ...NOBODY_ELSE,
      membershipOnTeam: async (_teamId, principal) => ({
        workspaceId: WORKSPACE,
        by: principal.userId,
      }),
    }),
    new RunScoresViews(
      records,
      scores,
      new StationJudgeReports(
        evidence,
        scores,
        records,
        new TaskDeliveriesInMemory(),
      ),
      judgings,
    ),
  );
};

const scoresOf = async (
  agreeing: boolean,
  team = 'team_1',
  scoredBy = RUBRIC_VERSION,
) =>
  (await reading(agreeing, scoredBy)).execute(
    new ReadRunScoresQuery(team, 'run_1', 'user_ada'),
  );

describe('ReadRunScoresHandler', () => {
  it('grades by the rubric the judge was given, whatever the station’s rubric says now', async () => {
    const scores = await scoresOf(true, 'team_1', NEXT_RUBRIC_VERSION);

    expect(scores.rubricBody).toBe('Did it retry?');
  });

  it('lays out a trusted judge’s score with each cited step and hunk as the judge read it', async () => {
    const scores = await scoresOf(true);

    expect(scores.calibration.trusted).toBe(true);
    expect(scores.judge?.label).toBe('yes');
    expect(scores.judge?.reasons[0]?.citations).toEqual([
      {
        kind: 'step',
        step: { index: 5, kind: 'tool', tool: 'edit', text: 'src/uploads.ts' },
        hunk: null,
      },
      {
        kind: 'hunk',
        step: null,
        hunk: {
          id: 'api/src/uploads.ts#1',
          path: 'api/src/uploads.ts',
          header: '@@ -1 +1 @@',
          lines: ['-upload()', '+retry(upload)'],
        },
      },
    ]);
  });

  it('keeps an untrusted judge’s score to itself, saying only that it judged and why it is hidden', async () => {
    const scores = await scoresOf(false);

    expect(scores.judged).toBe(true);
    expect(scores.judge).toBeNull();
    expect(scores.calibration).toMatchObject({
      trusted: false,
      hiddenBecause: 'below-trust',
    });
  });

  it('keeps a score by an earlier rubric to itself, even while the current rubric’s judge is trusted', async () => {
    const scores = await scoresOf(true, 'team_1', NEXT_RUBRIC_VERSION);

    expect(scores.calibration.trusted).toBe(true);
    expect(scores.judged).toBe(true);
    expect(scores.judge).toBeNull();
  });

  it('finds no run on another team', async () => {
    await expect(scoresOf(true, 'team_2')).rejects.toMatchObject({
      kind: 'not-found',
    });
  });
});
