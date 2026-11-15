import {
  ClaimsRevision,
  PULL_REQUEST_DEADLINE_MS,
} from '@insights/domain/aggregates/claims-revision.aggregate';
import { InvalidClaimsRevisionError } from '@insights/domain/exceptions/invalid-claims-revision.error';
import { MAX_REVISION_JUDGE_CALLS } from '@insights/domain/services/revision-pick';
import { REVISION_COOLDOWN_MS } from '@insights/domain/services/revision-trigger';
import { ClaimsRevisionId } from '@insights/domain/value-objects/claims-revision-id.vo';
import {
  OPENED_AT,
  REVISED_STATION,
  startedRevision,
} from '@insights/judge-repair.fake-spec';
import { rubricOf } from '@insights/judging.fake-spec';
import { describe, expect, it } from 'vitest';

const AGREEMENT = {
  searched: { before: 0.1, after: 0.5, runs: 30 },
  heldOut: { before: 0.2, after: 0.6, runs: 12 },
};

const PICK = { claims: ['It retries the upload once.'], agreement: AGREEMENT };

const later = (ms: number) => new Date(OPENED_AT.getTime() + ms);

describe('ClaimsRevision', () => {
  it('starts with a pending job and says so', () => {
    const revision = startedRevision();

    expect(revision.hasPendingJob).toBe(true);
    expect(revision.pullEvents().map((each) => each.kind)).toEqual([
      'claims-revision.started',
    ]);
  });

  it('may start where the station has no revision yet', () => {
    expect(ClaimsRevision.mayStart(null, OPENED_AT)).toBe(true);
  });

  it('may not start while another revision of the station is open', () => {
    expect(ClaimsRevision.mayStart(startedRevision(), later(1))).toBe(false);
  });

  it('may start again only 7 days after the last one ended', () => {
    const ended = startedRevision().ended({
      reason: 'no-gain',
      now: OPENED_AT,
    });

    expect(
      ClaimsRevision.mayStart(ended, later(REVISION_COOLDOWN_MS - 1)),
    ).toBe(false);
    expect(ClaimsRevision.mayStart(ended, later(REVISION_COOLDOWN_MS))).toBe(
      true,
    );
  });

  it('refuses to start in the cooldown', () => {
    expect(() =>
      ClaimsRevision.started({
        id: ClaimsRevisionId.of('revision_2'),
        station: REVISED_STATION,
        rubric: rubricOf(),
        trigger: 'claim-missing',
        latest: startedRevision(),
        now: later(1),
      }),
    ).toThrow(InvalidClaimsRevisionError);
  });

  it('keeps the picked candidate and its agreement, and stops judging before it asks for the pull request', () => {
    const revision = startedRevision();
    revision.pullEvents();

    const picked = revision.picked({ pick: PICK, now: later(1) });

    expect(picked.hasPendingJob).toBe(false);
    expect(picked.awaitsPullRequest).toBe(true);
    expect(picked.pick).toEqual(PICK);
    expect(picked.pickedAt).toEqual(later(1));
    expect(picked.endedAt).toBeNull();
    expect(picked.pullEvents().map((each) => each.kind)).toEqual([
      'claims-revision.picked',
    ]);
    expect(ClaimsRevision.mayStart(picked, later(REVISION_COOLDOWN_MS))).toBe(
      false,
    );
  });

  it('ends a pick that got no pull request within a day, so the station may revise again', () => {
    const picked = startedRevision().picked({ pick: PICK, now: later(1) });
    picked.pullEvents();

    expect(picked.pullRequestOverdue(later(PULL_REQUEST_DEADLINE_MS))).toBe(
      picked,
    );

    const overdue = picked.pullRequestOverdue(
      later(PULL_REQUEST_DEADLINE_MS + 2),
    );

    expect(overdue.outcome?.reason).toBe('pull-request-failed');
    expect(overdue.endedAt).toEqual(later(PULL_REQUEST_DEADLINE_MS + 1));
    expect(overdue.outcome?.message).toBe(
      'Spotlight got no pull request within a day of the pick.',
    );
    expect(overdue.pullEvents().map((each) => each.kind)).toEqual([
      'claims-revision.ended',
    ]);
    expect(
      startedRevision().pullRequestOverdue(later(REVISION_COOLDOWN_MS)).endedAt,
    ).toBeNull();
  });

  it('ends with the picked claims, its pull request and the agreement', () => {
    const picked = startedRevision().picked({ pick: PICK, now: later(1) });
    picked.pullEvents();

    const proposed = picked.proposed({
      pullRequest: 'https://github.com/acme/config/pull/7',
      now: later(2),
    });

    expect(proposed.outcome?.kind).toBe('proposed');
    expect(proposed.outcome?.claims).toEqual(PICK.claims);
    expect(proposed.outcome?.agreement).toEqual(AGREEMENT);
    expect(proposed.endedAt).toEqual(later(2));
    expect(proposed.pullEvents().map((each) => each.kind)).toEqual([
      'claims-revision.ended',
    ]);
    expect(
      proposed.proposed({
        pullRequest: 'https://github.com/acme/config/pull/8',
        now: later(3),
      }),
    ).toBe(proposed);
  });

  it('ends with the agreement and the reason when its pull request failed', () => {
    const failed = startedRevision()
      .picked({ pick: PICK, now: later(1) })
      .pullRequestFailed({
        message: 'The station is gone from its line.',
        now: later(2),
      });

    expect(failed.outcome?.reason).toBe('pull-request-failed');
    expect(failed.outcome?.agreement).toEqual(AGREEMENT);
    expect(failed.outcome?.message).toBe('The station is gone from its line.');
  });

  it('takes no pull request before it picked a candidate', () => {
    const revision = startedRevision();

    expect(
      revision.proposed({
        pullRequest: 'https://github.com/acme/config/pull/7',
        now: later(1),
      }),
    ).toBe(revision);
    expect(() =>
      revision
        .ended({ reason: 'no-gain', now: later(1) })
        .picked({ pick: PICK, now: later(2) }),
    ).toThrow(InvalidClaimsRevisionError);
  });

  it('ends with a reason', () => {
    const ended = startedRevision().ended({
      reason: 'too-few-labelled-runs',
      now: later(1),
    });

    expect(ended.outcome?.reason).toBe('too-few-labelled-runs');
  });

  it('counts the judge calls it spends across attempts', () => {
    const spent = startedRevision().spending(100).spending(40);

    expect(spent.judgeCalls).toBe(140);
    expect(spent.judgeCallsLeft).toBe(MAX_REVISION_JUDGE_CALLS - 140);
    expect(spent.ended({ reason: 'no-gain', now: later(1) }).judgeCalls).toBe(
      140,
    );
  });

  it('makes no more judge calls than the ceiling, however often it retries', () => {
    const spent = startedRevision()
      .spending(100)
      .scheduleRetry(later(1))
      .spending(50);

    expect(spent.judgeCallsLeft).toBe(0);
    expect(() => spent.spending(1)).toThrow(InvalidClaimsRevisionError);
    expect(() => startedRevision().spending(-1)).toThrow(
      InvalidClaimsRevisionError,
    );
  });

  it('spends no judge calls once it ended', () => {
    expect(() =>
      startedRevision()
        .ended({ reason: 'no-gain', now: later(1) })
        .spending(1),
    ).toThrow(InvalidClaimsRevisionError);
  });

  it('ends as interrupted when its job keeps failing', () => {
    expect(startedRevision().deadLetter(later(1)).outcome?.reason).toBe(
      'interrupted',
    );
  });

  it('changes nothing once it ended', () => {
    const ended = startedRevision().ended({
      reason: 'no-gain',
      now: later(1),
    });

    expect(ended.ended({ reason: 'interrupted', now: later(2) })).toBe(ended);
  });
});
