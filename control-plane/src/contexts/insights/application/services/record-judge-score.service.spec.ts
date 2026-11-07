import { deletionsInMemory } from '@insights/application/ports/deletions.fake-spec';
import {
  DeleteInsights,
  type InsightsRepositories,
} from '@insights/application/services/delete-insights.service';
import { FactRecorder } from '@insights/application/services/fact-recorder.service';
import { RecordJudgeScore } from '@insights/application/services/record-judge-score.service';
import { RunJudged } from '@insights/domain/events/run-judged.event';
import { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import { ScoreScale } from '@insights/domain/value-objects/score-scale.vo';
import { SeenEvidence } from '@insights/domain/value-objects/seen-evidence.vo';
import {
  locationOf,
  RUBRIC_VERSION,
  reasonOf,
  ScoresInMemory,
} from '@insights/judging.fake-spec';
import {
  FIRST_CONFIG,
  inTransaction,
  TEAM,
  WORKSPACE,
} from '@insights/runs.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const judged = (): RunJudged =>
  new RunJudged(
    RunId.of('run_1'),
    WORKSPACE,
    locationOf('task_1'),
    FIRST_CONFIG,
    RUBRIC_VERSION,
    ScoreScale.yesNo(),
    1,
    null,
    'some/model',
    [reasonOf()],
    SeenEvidence.none(),
    new Date('2026-09-30T10:00:00.000Z'),
  );

const recording = () => {
  const scores = new ScoresInMemory();
  const deletions = deletionsInMemory();
  let ids = 0;
  const scoring = new RecordJudgeScore(
    scores,
    new FactRecorder(deletions),
    inTransaction,
    {
      generate: () => {
        ids += 1;
        return `score_${ids}`;
      },
    },
  );
  const deleting = new DeleteInsights(
    { scores } as unknown as InsightsRepositories,
    deletions,
    inTransaction,
  );

  return { scores, deletions, scoring, deleting };
};

describe('RecordJudgeScore', () => {
  it('stores the judge’s score once per rubric version', async () => {
    const { scores, scoring } = recording();

    await scoring.judged(judged());
    await scoring.judged(judged());

    expect([...scores.stored.values()].map((each) => each.value)).toEqual([1]);
  });

  it('keeps no score that arrives after its task’s scores were deleted, while the judging still exists', async () => {
    const { scores, deletions, scoring, deleting } = recording();

    await deleting.scores(DeletionScope.ofTask(WORKSPACE, TaskId.of('task_1')));
    await scoring.judged(judged());

    expect(scores.stored.size).toBe(0);
    expect(deletions.locks).toEqual([
      `${WORKSPACE.value} ${TEAM.value} task_1`,
    ]);
  });

  it('keeps no score of a deleted team or workspace', async () => {
    const forTeam = recording();
    const forWorkspace = recording();

    await forTeam.deleting.scores(DeletionScope.ofTeam(WORKSPACE, TEAM));
    await forTeam.scoring.judged(judged());
    await forWorkspace.deleting.scores(DeletionScope.ofWorkspace(WORKSPACE));
    await forWorkspace.scoring.judged(judged());

    expect(forTeam.scores.stored.size).toBe(0);
    expect(forWorkspace.scores.stored.size).toBe(0);
  });
});
