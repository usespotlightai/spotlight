import { ChangeJudging } from '@replays/domain/aggregates/change-judging.aggregate';
import { ChangeJudged } from '@replays/domain/events/change-judged.event';
import { ChangeJudgingFailed } from '@replays/domain/events/change-judging-failed.event';
import { InvalidJudgingError } from '@replays/domain/exceptions/invalid-judging.error';
import type { JudgedChange } from '@replays/domain/value-objects/change-judgment';
import { instanceOf } from '@shared-kernel/domain/instance-of.fake-spec';
import { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import { WAIT_MS } from '@shared-kernel/domain/value-objects/pending-job.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-02T10:05:00.000Z');

const RUN = RunId.of('replay_1');

const CLAIMS = ['It retries.', 'It logs.', 'It has a test.'];

const requested = () =>
  ChangeJudging.requested({
    runId: RUN,
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    criteria: JudgeCriteria.of({ claims: CLAIMS }),
    reference: null,
    now: NOW,
  });

const judged = (guidance: string | null, met = [true, false, false]) =>
  ({
    judged: true,
    claimResults: met,
    reasons: met.map((_, claim) => ({
      text: 'It retries.',
      steps: [2],
      hunks: [],
      claim,
    })),
    guidance,
    referenced: false,
    model: 'some/model',
  }) satisfies JudgedChange;

const judgedOnce = (guidance: string | null): ChangeJudging =>
  requested().leaseJob(NOW).recordJudgment(judged(guidance), NOW);

describe('ChangeJudging', () => {
  it('refuses to compare a change with its own run', () => {
    expect(() =>
      ChangeJudging.requested({
        runId: RUN,
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: TeamId.of('team_1'),
        criteria: JudgeCriteria.of({ claims: CLAIMS }),
        reference: RUN,
        now: NOW,
      }),
    ).toThrow(InvalidJudgingError);
  });

  it('records the verdict on its own criteria', () => {
    const judging = judgedOnce('Cover the retry path with its own test.');
    const event = instanceOf(ChangeJudged, judging.pullEvents()[0]);

    expect(judging.hasPendingJob).toBe(false);
    expect(event.verdict.claims).toEqual(CLAIMS);
    expect(event.verdict.guidance).toBe(
      'Cover the retry path with its own test.',
    );
  });

  it('requests guidance only on the first attempt, and hands on none from the second', () => {
    const again = judgedOnce(null).requeued(NOW);
    again.pullEvents();

    expect(requested().guidanceRequested).toBe(true);
    expect(again.guidanceRequested).toBe(false);

    const event = instanceOf(
      ChangeJudged,
      again
        .leaseJob(NOW)
        .recordJudgment(
          judged('Cover the retry path.', [false, false, false]),
          NOW,
        )
        .pullEvents()[0],
    );

    expect(event.attempt).toBe(2);
    expect(event.verdict.guidance).toBeNull();
  });

  it('retries an unreadable answer later, then gives up', () => {
    const unreadable = {
      judged: false,
      failure: 'unreadable',
    } as const;
    const once = requested().leaseJob(NOW).recordJudgment(unreadable, NOW);

    expect(once.hasPendingJob).toBe(true);
    expect(once.pullEvents()).toEqual([]);

    const due = once.job?.nextAttemptAt ?? NOW;
    const twice = once.leaseJob(due).recordJudgment(unreadable, due);
    const later = twice.job?.nextAttemptAt ?? NOW;
    const event = instanceOf(
      ChangeJudgingFailed,
      twice.leaseJob(later).recordJudgment(unreadable, later).pullEvents()[0],
    );

    expect(event.failure.code).toBe('unreadable');
  });

  it('waits for its assist session without spending the attempt it leased', () => {
    const at = new Date(NOW.getTime() + 15_000);
    const waiting = requested().leaseJob(NOW).waitJob(at);

    expect(waiting.hasPendingJob).toBe(true);
    expect(waiting.job?.attempts).toBe(0);
    expect(waiting.job?.nextAttemptAt).toEqual(
      new Date(at.getTime() + WAIT_MS),
    );
    expect(waiting.job?.waitingSince).toEqual(at);
  });

  it('fails at once, without retrying, when the judge has insufficient credits', () => {
    const broke = {
      judged: false,
      failure: 'insufficient-credits',
    } as const;
    const failed = requested().leaseJob(NOW).recordJudgment(broke, NOW);
    const event = instanceOf(ChangeJudgingFailed, failed.pullEvents()[0]);

    expect(failed.hasPendingJob).toBe(false);
    expect(event.failure.code).toBe('insufficient-credits');
  });

  it('can be judged again only once it was judged', () => {
    expect(() => requested().requeued(NOW)).toThrow(InvalidJudgingError);
  });

  it('is deleted by itself, keeping its version for the versioned removal', () => {
    const judging = requested();
    const deleted = judging.delete();

    expect(judging.isDeleted).toBe(false);
    expect(deleted.isDeleted).toBe(true);
    expect(deleted.version).toBe(judging.version);
  });

  it('judges in rounds: a calibration judging and a retried try each are a new round, a wait is not', () => {
    const leased = requested().leaseJob(NOW);
    const resumed = leased
      .waitJob(NOW)
      .leaseJob(new Date(NOW.getTime() + WAIT_MS));
    const calibration = judgedOnce(null).requeued(NOW).leaseJob(NOW);

    expect(leased.round).toMatchObject({ runId: RUN, judging: 1, attempt: 1 });
    expect(resumed.round.equals(leased.round)).toBe(true);
    expect(calibration.round).toMatchObject({ judging: 2, attempt: 1 });
    expect(calibration.round.equals(leased.round)).toBe(false);
  });

  it('wakes when the session of the round it waits on settles, and only then', () => {
    const leased = requested().leaseJob(NOW);
    const waiting = leased.waitJob(NOW);
    const at = new Date(NOW.getTime() + 1_000);
    const woken = waiting.wake(leased.round, at);

    expect(woken.job?.nextAttemptAt).toEqual(at);
    expect(woken.wake(leased.round, at)).toBe(woken);
    expect(leased.wake(leased.round, at)).toBe(leased);
    expect(
      waiting.wake(judgedOnce(null).requeued(NOW).leaseJob(NOW).round, at),
    ).toBe(waiting);
  });
});
