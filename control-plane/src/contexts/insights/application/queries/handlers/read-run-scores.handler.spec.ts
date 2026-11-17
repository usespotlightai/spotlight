import type { StationJudge } from '@insights/application/ports/station-judges.port';
import { ReadRunScoresHandler } from '@insights/application/queries/handlers/read-run-scores.handler';
import { ReadRunScoresQuery } from '@insights/application/queries/read-run-scores.query';
import { InsightsAccess } from '@insights/application/services/insights-access.service';
import { RunScoresViews } from '@insights/application/services/run-scores-views.service';
import { StationJudgeReports } from '@insights/application/services/station-judge-reports.service';
import { Score } from '@insights/domain/aggregates/score.aggregate';
import { Citation } from '@insights/domain/value-objects/citation.vo';
import {
  HumanAction,
  type HumanActionKind,
} from '@insights/domain/value-objects/human-action.vo';
import { JudgeReason } from '@insights/domain/value-objects/judge-reason.vo';
import type { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import { ScoreId } from '@insights/domain/value-objects/score-id.vo';
import { SeenEvidence } from '@insights/domain/value-objects/seen-evidence.vo';
import {
  judgeScore,
  locationOf,
  NEXT_RUBRIC_VERSION,
  RUBRIC_VERSION,
  ScoresInMemory,
} from '@insights/judging.fake-spec';
import {
  endedRecord,
  NOBODY_ELSE,
  RunRecordsInMemory,
  StationFactsInMemory,
  WORKSPACE,
} from '@insights/runs.fake-spec';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const JUDGE: StationJudge = {
  teamId: TeamId.of('team_1'),
  lineId: LineId.of('line_1'),
  rubricVersion: RUBRIC_VERSION,
  claims: ['It retries the upload.'],
  passThreshold: 1,
  sample: 1,
  minAgreement: 0.5,
};

const AT = new Date('2026-09-30T11:00:00.000Z');

const reading = async (
  agreeing: boolean,
  judgedBy: RubricVersion = RUBRIC_VERSION,
  action: HumanActionKind | null = null,
) => {
  const records = new RunRecordsInMemory();
  const scores = new ScoresInMemory();
  await records.add(
    action
      ? endedRecord('run_1').recordAction(HumanAction.of(action, AT))
      : endedRecord('run_1'),
  );
  await scores.add(
    Score.judge({
      id: ScoreId.of('score_1'),
      runId: RunId.of('run_1'),
      workspaceId: WORKSPACE,
      location: locationOf(),
      fingerprint: null,
      claimResults: [true],
      passThreshold: 1,
      rubricVersion: judgedBy,
      model: 'some/model',
      reasons: [
        JudgeReason.of({
          text: 'It retries the upload.',
          citations: [
            Citation.ofStep(5),
            Citation.ofHunk('api/src/uploads.ts#1'),
          ],
          claim: 0,
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
        HumanAction.of(yes === agreeing ? 'accepted' : 'sent-back', AT),
      ),
    );
    await scores.add(judgeScore(runId, [yes]));
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
    new InsightsAccess({
      ...NOBODY_ELSE,
      viewerOf: async (_teamId, principal) => ({
        workspaceId: WORKSPACE,
        by: principal.userId,
      }),
    }),
    new RunScoresViews(
      new StationFactsInMemory(records, { scores }),
      new StationJudgeReports(
        evidence,
        new StationFactsInMemory(records, { scores }),
      ),
    ),
  );
};

const scoresOf = async (
  agreeing: boolean,
  team = 'team_1',
  judgedBy = RUBRIC_VERSION,
  action: HumanActionKind | null = null,
) =>
  (await reading(agreeing, judgedBy, action)).execute(
    new ReadRunScoresQuery(team, 'run_1', 'user_ada'),
  );

describe('ReadRunScoresHandler', () => {
  it('names the claims of the judge it shows, and shows no judge whose claims changed since', async () => {
    expect((await scoresOf(true)).judge?.claims).toEqual([
      'It retries the upload.',
    ]);
    expect(
      (await scoresOf(true, 'team_1', NEXT_RUBRIC_VERSION)).judge,
    ).toBeNull();
  });

  it('lays out a qualified judge’s score with each cited step and hunk as the judge read it', async () => {
    const scores = await scoresOf(true);

    expect(scores.calibration.qualified).toBe(true);
    expect(scores.judge?.claimResults).toEqual([true]);
    expect(scores.judge?.passes).toBe(true);
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

  it('keeps an unqualified judge’s score to itself, saying only that it judged and why it is hidden', async () => {
    const scores = await scoresOf(false);

    expect(scores.judged).toBe(true);
    expect(scores.judge).toBeNull();
    expect(scores.calibration).toMatchObject({
      qualified: false,
      hiddenReason: 'below-min-agreement',
    });
  });

  it('keeps a score by an earlier rubric to itself, even while the current rubric’s judge is qualified', async () => {
    const scores = await scoresOf(true, 'team_1', NEXT_RUBRIC_VERSION);

    expect(scores.calibration.qualified).toBe(true);
    expect(scores.judged).toBe(true);
    expect(scores.judge).toBeNull();
  });

  it('answers what people did with the run beside a judge that agrees with them', async () => {
    const scores = await scoresOf(true, 'team_1', RUBRIC_VERSION, 'accepted');

    expect(scores.labelFrom).toBe('accepted');
    expect(scores.agrees).toBe(true);
  });

  it('marks a judge that passed a run people sent back', async () => {
    const scores = await scoresOf(true, 'team_1', RUBRIC_VERSION, 'sent-back');

    expect(scores.labelFrom).toBe('sent-back');
    expect(scores.agrees).toBe(false);
  });

  it('answers the human label but no agreement where the judge’s score is hidden', async () => {
    const scores = await scoresOf(false, 'team_1', RUBRIC_VERSION, 'accepted');

    expect(scores.judge).toBeNull();
    expect(scores.labelFrom).toBe('accepted');
    expect(scores.agrees).toBeNull();
  });

  it('answers no label while people did nothing with the run', async () => {
    const scores = await scoresOf(true);

    expect(scores.labelFrom).toBeNull();
    expect(scores.agrees).toBeNull();
  });

  it('finds no run on another team', async () => {
    await expect(scoresOf(true, 'team_2')).rejects.toMatchObject({
      kind: 'not-found',
    });
  });
});
