import { HumanAction } from '@insights/domain/value-objects/human-action.vo';
import { RunTools } from '@insights/domain/value-objects/run-tools.vo';
import { StationPass } from '@insights/domain/value-objects/station-pass.vo';
import {
  costedRecord,
  endedRecord,
  factOf,
  usageOf,
} from '@insights/runs.fake-spec';
import { LatencyHistogram } from '@shared-kernel/domain/value-objects/latency-histogram.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { describe, expect, it } from 'vitest';

const EARLIER = new Date('2026-09-30T10:00:00.000Z');
const AT = new Date('2026-09-30T11:00:00.000Z');
const LATER = new Date('2026-09-30T12:00:00.000Z');

const PULL_REQUEST = {
  pullRequest: PullRequestUrl.of('https://github.com/acme/api/pull/7'),
  state: 'merged' as const,
  openedAt: EARLIER,
  closedAt: LATER,
};

describe('RunFact', () => {
  it('ends as superseded, ran and is sized by the rules of its run', () => {
    const superseded = factOf(
      costedRecord('run_1', {
        ending: 'failed',
        changedLines: 51,
      }).supersededByItsTask(AT),
    );
    const cancelled = factOf(
      endedRecord('run_2', { ending: 'cancelled' }).supersededByItsTask(AT),
    );

    expect(superseded.ending).toBe('superseded');
    expect(superseded.end.ending).toBe('failed');
    expect(superseded.ran).toBe(true);
    expect(superseded.size).toBe('medium');
    expect(cancelled.ending).toBe('cancelled');
    expect(cancelled.ran).toBe(false);
    expect(cancelled.size).toBeNull();
  });

  it('turned out as its run did', () => {
    const accepted = endedRecord('run_1', { ending: 'failed' }).recordAction(
      HumanAction.of('accepted', AT),
    );

    expect(factOf(accepted).disposition).toBe(accepted.disposition);
    expect(factOf(accepted).disposition).toBe('accepted');
  });

  it('knows what was known of it at a moment, its task’s pull request too', () => {
    const fact = endedRecord('run_1', { endedAt: EARLIER })
      .supersededByItsTask(LATER)
      .recordCheck('passed', AT)
      .recordAction(HumanAction.of('approved', LATER))
      .recordAction(HumanAction.of('accepted', LATER))
      .passTo(StationPass.of(StationId.of('station_2'), LATER))
      .factWith(null, PULL_REQUEST);
    const known = fact?.asOf(AT);

    expect(known?.ending).toBe('completed');
    expect(known?.checks).toBe('passed');
    expect(known?.approvalAnsweredAt).toBeNull();
    expect(known?.firstHumanAction).toBeNull();
    expect(known?.passed).toBeNull();
    expect(known?.pullRequest).toEqual({
      ...PULL_REQUEST,
      state: 'open',
      closedAt: null,
    });
    expect(fact?.asOf(LATER)?.ending).toBe('superseded');
    expect(fact?.asOf(LATER)?.approvalAnsweredAt).toEqual(LATER);
    expect(fact?.asOf(LATER)?.pullRequest).toEqual(PULL_REQUEST);
    expect(fact?.asOf(new Date(EARLIER.getTime() - 1))).toBeNull();
  });

  it('keeps the memories its run used when looked at as of an earlier time', () => {
    const fact = factOf(
      endedRecord('run_1').recordMemories('briefed', ['mem_1']),
    );

    expect(fact.asOf(LATER)?.memories).toBe(fact.memories);
  });

  it('failed after calling a server only when it failed and its last call there failed', () => {
    const timed = LatencyHistogram.timing([100, 200]);
    const used = RunTools.of({
      servers: [
        {
          server: 'linear',
          calls: 2,
          failed: 1,
          latency: timed,
          lastCallFailed: true,
        },
        {
          server: 'sentry',
          calls: 2,
          failed: 1,
          latency: timed,
          lastCallFailed: false,
        },
      ],
      skillsRead: [],
    });
    const failed = factOf(
      endedRecord('run_1', { ending: 'failed' }).recordUsage(usageOf(), used),
    );
    const completed = factOf(endedRecord('run_2').recordUsage(usageOf(), used));

    expect(failed.failedAfterCallingTo('linear')).toBe(true);
    expect(failed.failedAfterCallingTo('sentry')).toBe(false);
    expect(failed.failedAfterCallingTo('wiki')).toBe(false);
    expect(completed.failedAfterCallingTo('linear')).toBe(false);
  });
});
