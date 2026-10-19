import { ChangeJudging } from '@insights/domain/aggregates/change-judging.aggregate';
import type { ChangeJudged } from '@insights/domain/events/change-judged.event';
import { claimsCriteria } from '@insights/domain/judging.fake-spec';
import { JudgeEvidence } from '@insights/domain/services/judge-evidence';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-02T10:05:00.000Z');

const RUN = RunId.of('replay_1');

const EVIDENCE = JudgeEvidence.of({
  runId: RUN,
  title: 'Retry uploads',
  description: null,
  steps: [
    {
      index: 2,
      kind: 'said',
      tool: null,
      text: 'Retrying.',
      input: null,
      output: null,
    },
  ],
  hunks: [],
});

const requested = () =>
  ChangeJudging.requested({
    runId: RUN,
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    criteria: claimsCriteria(),
    reference: null,
    now: NOW,
  });

const judgedOnce = (guidance: string | null): ChangeJudging =>
  requested()
    .leaseJob(NOW)
    .recordVerdict({
      verdict: {
        claims: [0, 1, 2].map((index) => ({
          index,
          met: index === 0,
          reasons: [{ text: 'It retries.', steps: [2], hunks: [] }],
        })),
      },
      guidance,
      usage: null,
      evidence: EVIDENCE,
      model: 'some/model',
      now: NOW,
    });

const changeJudgedEvent = (guidance: string | null): ChangeJudged =>
  judgedOnce(guidance).pullEvents()[0] as ChangeJudged;

describe('ChangeJudging', () => {
  it('requests guidance only on the first attempt, not when the change is judged again', () => {
    expect(requested().guidanceRequested).toBe(true);
    expect(judgedOnce(null).requeued(NOW).guidanceRequested).toBe(false);
  });

  it('hands on what the judge says to improve beside its reasons', () => {
    const event = changeJudgedEvent(
      '  Cover the retry path with its own test.  ',
    );

    expect(event.guidance).toBe('Cover the retry path with its own test.');
    expect(event.reasons).toHaveLength(3);
  });

  it('hands on nothing to improve from a second attempt, whatever the judge says', () => {
    const again = judgedOnce(null).requeued(NOW);
    again.pullEvents();

    const [event] = again
      .leaseJob(NOW)
      .recordVerdict({
        verdict: {
          claims: [0, 1, 2].map((index) => ({
            index,
            met: false,
            reasons: [{ text: 'It retries.', steps: [2], hunks: [] }],
          })),
        },
        guidance: 'Cover the retry path with its own test.',
        usage: null,
        evidence: EVIDENCE,
        model: 'some/model',
        now: NOW,
      })
      .pullEvents() as ChangeJudged[];

    expect(event?.attempt).toBe(2);
    expect(event?.guidance).toBeNull();
  });

  it('hands on nothing to improve when the guidance names a claim, by its words or its number', () => {
    expect(
      changeJudgedEvent('Make sure it adds a test for the retry.').guidance,
    ).toBe(null);
    expect(changeJudgedEvent('Claim 1 is still unmet.').guidance).toBeNull();
    expect(changeJudgedEvent(null).guidance).toBeNull();
  });
});
