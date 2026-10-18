import { INSIGHTS_EVENT_MAPPERS } from '@insights/application/integration-events/insights.event-mappers';
import { ChangeJudged } from '@insights/domain/events/change-judged.event';
import { ChangeJudgingFailed } from '@insights/domain/events/change-judging-failed.event';
import { SideBySideJudged } from '@insights/domain/events/side-by-side-judged.event';
import { SideBySideJudgingFailed } from '@insights/domain/events/side-by-side-judging-failed.event';
import { Citation } from '@insights/domain/value-objects/citation.vo';
import { JudgeReason } from '@insights/domain/value-objects/judge-reason.vo';
import { JudgingFailure } from '@insights/domain/value-objects/judging-failure.vo';
import { PairReason } from '@insights/domain/value-objects/pair-reason.vo';
import { ScoreScale } from '@insights/domain/value-objects/score-scale.vo';
import { ModelUsage } from '@shared-kernel/domain/value-objects/model-usage.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-10-02T10:00:00.000Z');

const published = (
  event:
    | ChangeJudged
    | ChangeJudgingFailed
    | SideBySideJudged
    | SideBySideJudgingFailed,
) =>
  INSIGHTS_EVENT_MAPPERS.filter((each) => each.from === event.kind).map(
    (each) => each.map(event, new Date()),
  );

describe('INSIGHTS_EVENT_MAPPERS', () => {
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
        kind: 'insights.change-judged.v1',
        runId: 'replay_1',
        attempt: 1,
        workspaceId: 'ws_1',
        scale: 'number',
        value: 4,
        claimResults: null,
        claims: [],
        passThreshold: 1,
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
        kind: 'insights.change-judging-failed.v1',
        runId: 'replay_1',
        attempt: 2,
        workspaceId: 'ws_1',
        failure: 'interrupted',
        spentCosts: [],
        unpricedCalls: 0,
      },
    ]);
  });

  it('publishes a pair judged side by side, naming the winner by its run, with both passes and the hunks each reason cites on either side', () => {
    expect(
      published(
        new SideBySideJudged(
          RunId.of('replay_1'),
          RunId.of('replay_2'),
          WorkspaceId.of('ws_1'),
          'tie',
          'some/model',
          [
            {
              runShownFirst: true,
              winner: 'other',
              reasons: [
                PairReason.of({
                  text: 'The baseline drains in order.',
                  runHunks: ['api/q.ts#1'],
                  otherHunks: ['api/q.ts#2'],
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
        kind: 'insights.side-by-side-judged.v1',
        runId: 'replay_1',
        otherRunId: 'replay_2',
        workspaceId: 'ws_1',
        winner: 'tie',
        model: 'some/model',
        passes: [
          {
            runShownFirst: true,
            winner: 'other',
            reasons: [
              {
                text: 'The baseline drains in order.',
                runHunks: ['api/q.ts#1'],
                otherHunks: ['api/q.ts#2'],
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
        new SideBySideJudgingFailed(
          RunId.of('replay_1'),
          RunId.of('replay_2'),
          WorkspaceId.of('ws_1'),
          JudgingFailure.of('no-evidence', AT),
          ModelUsage.none(),
        ),
      ),
    ).toEqual([
      {
        kind: 'insights.side-by-side-judging-failed.v1',
        runId: 'replay_1',
        otherRunId: 'replay_2',
        workspaceId: 'ws_1',
        failure: 'no-evidence',
        spentCosts: [],
        unpricedCalls: 0,
      },
    ]);
  });
});
