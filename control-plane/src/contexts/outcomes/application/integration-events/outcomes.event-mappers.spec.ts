import { OUTCOMES_EVENT_MAPPERS } from '@outcomes/application/integration-events/outcomes.event-mappers';
import { ChangeJudged } from '@outcomes/domain/events/change-judged.event';
import { ChangeJudgingFailed } from '@outcomes/domain/events/change-judging-failed.event';
import { PairJudged } from '@outcomes/domain/events/pair-judged.event';
import { PairJudgingFailed } from '@outcomes/domain/events/pair-judging-failed.event';
import { Citation } from '@outcomes/domain/value-objects/citation.vo';
import { JudgeReason } from '@outcomes/domain/value-objects/judge-reason.vo';
import { JudgingFailure } from '@outcomes/domain/value-objects/judging-failure.vo';
import { PairReason } from '@outcomes/domain/value-objects/pair-reason.vo';
import { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';
import { ModelUsage } from '@shared-kernel/domain/value-objects/model-usage.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-10-02T10:00:00.000Z');

const published = (
  event: ChangeJudged | ChangeJudgingFailed | PairJudged | PairJudgingFailed,
) =>
  OUTCOMES_EVENT_MAPPERS.filter((each) => each.from === event.kind).map(
    (each) => each.map(event, new Date()),
  );

describe('OUTCOMES_EVENT_MAPPERS', () => {
  it('publishes a judged change with its score, scale and the citations of each reason', () => {
    expect(
      published(
        new ChangeJudged(
          RunId.of('replay_1'),
          1,
          WorkspaceId.of('ws_1'),
          ScoreScale.oneToFive(),
          4,
          null,
          [],
          1,
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
        round: 1,
        workspaceId: 'ws_1',
        scale: 'number',
        value: 4,
        marks: null,
        claims: [],
        passShare: 1,
        model: 'some/model',
        reasons: [
          {
            text: 'It drains.',
            steps: [2],
            hunks: ['api/q.ts#1'],
            claim: null,
          },
        ],
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
          2,
          WorkspaceId.of('ws_1'),
          JudgingFailure.of('interrupted', AT),
          ModelUsage.none(),
        ),
      ),
    ).toEqual([
      {
        kind: 'outcomes.change-judging-failed.v1',
        runId: 'replay_1',
        round: 2,
        workspaceId: 'ws_1',
        failure: 'interrupted',
        spentCosts: [],
        unpricedCalls: 0,
      },
    ]);
  });

  it('publishes a pair judged side by side, naming the winner by its run, with both readings and the hunks each reason cites on either side', () => {
    expect(
      published(
        new PairJudged(
          RunId.of('replay_1'),
          RunId.of('replay_2'),
          WorkspaceId.of('ws_1'),
          'tie',
          'some/model',
          [
            {
              runShownFirst: true,
              winner: 'against',
              reasons: [
                PairReason.of({
                  text: 'The baseline drains in order.',
                  runHunks: ['api/q.ts#1'],
                  againstHunks: ['api/q.ts#2'],
                }),
              ],
            },
            { runShownFirst: false, winner: 'run', reasons: [] },
          ],
          ModelUsage.none(),
          AT,
        ),
      ),
    ).toEqual([
      {
        kind: 'outcomes.pair-judged.v1',
        runId: 'replay_1',
        againstRunId: 'replay_2',
        workspaceId: 'ws_1',
        winner: 'tie',
        model: 'some/model',
        readings: [
          {
            runShownFirst: true,
            winner: 'against',
            reasons: [
              {
                text: 'The baseline drains in order.',
                runHunks: ['api/q.ts#1'],
                againstHunks: ['api/q.ts#2'],
              },
            ],
          },
          { runShownFirst: false, winner: 'run', reasons: [] },
        ],
        spentCosts: [],
        unpricedCalls: 0,
        at: AT.toISOString(),
      },
    ]);
  });

  it('publishes a pair that could not be judged, and why', () => {
    expect(
      published(
        new PairJudgingFailed(
          RunId.of('replay_1'),
          RunId.of('replay_2'),
          WorkspaceId.of('ws_1'),
          JudgingFailure.of('no-evidence', AT),
          ModelUsage.none(),
        ),
      ),
    ).toEqual([
      {
        kind: 'outcomes.pair-judging-failed.v1',
        runId: 'replay_1',
        againstRunId: 'replay_2',
        workspaceId: 'ws_1',
        failure: 'no-evidence',
        spentCosts: [],
        unpricedCalls: 0,
      },
    ]);
  });
});
