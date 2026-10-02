import { OUTCOMES_PUBLICATIONS } from '@outcomes/application/integration-events/outcomes.publications';
import { ChangeJudged } from '@outcomes/domain/events/change-judged.event';
import { ChangeJudgingFailed } from '@outcomes/domain/events/change-judging-failed.event';
import { Citation } from '@outcomes/domain/value-objects/citation.vo';
import { JudgeReason } from '@outcomes/domain/value-objects/judge-reason.vo';
import { JudgingFailure } from '@outcomes/domain/value-objects/judging-failure.vo';
import { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';
import { ModelUsage } from '@shared-kernel/domain/value-objects/model-usage.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-10-02T10:00:00.000Z');

const published = (event: ChangeJudged | ChangeJudgingFailed) =>
  OUTCOMES_PUBLICATIONS.filter((each) => each.from === event.kind).map((each) =>
    each.publish(event),
  );

describe('OUTCOMES_PUBLICATIONS', () => {
  it('publishes a judged change with its score, scale and the citations of each reason', () => {
    expect(
      published(
        new ChangeJudged(
          RunId.of('replay_1'),
          WorkspaceId.of('ws_1'),
          ScoreScale.oneToFive(),
          4,
          'some/model',
          [
            JudgeReason.of({
              text: 'It drains.',
              citations: [Citation.ofStep(2), Citation.ofHunk('api/q.ts#1')],
            }),
          ],
          true,
          ModelUsage.none().with({
            inputTokens: 900,
            outputTokens: 80,
            cost: { amount: 0.03, currency: 'USD' },
          }),
          AT,
        ),
      ),
    ).toEqual([
      {
        kind: 'outcomes.change-judged.v1',
        runId: 'replay_1',
        workspaceId: 'ws_1',
        scale: 'number',
        value: 4,
        model: 'some/model',
        reasons: [{ text: 'It drains.', steps: [2], hunks: ['api/q.ts#1'] }],
        referenced: true,
        spentCosts: [{ amount: 0.03, currency: 'USD' }],
        unpricedCalls: 0,
        at: AT.toISOString(),
      },
    ]);
  });

  it('publishes a judging that failed for good, and why', () => {
    expect(
      published(
        new ChangeJudgingFailed(
          RunId.of('replay_1'),
          WorkspaceId.of('ws_1'),
          JudgingFailure.of('interrupted', AT),
          ModelUsage.none(),
        ),
      ),
    ).toEqual([
      {
        kind: 'outcomes.change-judging-failed.v1',
        runId: 'replay_1',
        workspaceId: 'ws_1',
        failure: 'interrupted',
        spentCosts: [],
        unpricedCalls: 0,
      },
    ]);
  });
});
