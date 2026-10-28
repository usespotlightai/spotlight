import { ConfigPullRequest } from '@replays/domain/aggregates/config-pull-request.aggregate';
import { StationSearchSchedule } from '@replays/domain/aggregates/station-search-schedule.aggregate';
import {
  aSet,
  BY,
  later,
  NOW,
  SEARCH_ID,
  STATION,
} from '@replays/domain/replays.fake-spec';
import type { PickingSearch } from '@replays/domain/services/pending-pick';
import {
  type ImprovementFacts,
  improvementOf,
  TRANSIENT_SKIP_REASONS,
} from '@replays/domain/services/station-improvement';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import { ConfigPullRequestReason } from '@replays/domain/value-objects/config-pull-request-reason.vo';
import {
  SEARCH_SKIP_REASONS,
  type SearchSkipReason,
} from '@replays/domain/value-objects/search-skip-reason';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const HOUR_MS = 60 * 60 * 1000;

const SET = aSet(10);

const PERSON_MUST_ACT = SEARCH_SKIP_REASONS.filter(
  (reason) =>
    !(TRANSIENT_SKIP_REASONS as readonly SearchSkipReason[]).includes(reason),
);

const schedule = () =>
  StationSearchSchedule.create({ station: STATION, setId: SET.id, at: NOW });

const started = (at = NOW) =>
  schedule().started({
    searched: [TaskId.of('task_0')],
    inSet: [TaskId.of('task_0')],
    at,
    cooldownMilliseconds: HOUR_MS,
  });

const SOURCE = {
  repository: Repository.of('acme/platform'),
  path: 'teams/core/delivery.tf',
};

const picked = (id: string, number: number, at = NOW) =>
  ConfigPullRequest.pick({
    id: ConfigPullRequestId.of(id),
    searchId: SEARCH_ID,
    candidateId: CandidateId.of(`candidate_${number}`),
    station: STATION,
    stationKey: 'build',
    candidateName: `terse ${number}`,
    lineKey: 'delivery',
    source: SOURCE,
    at,
    by: BY,
  });

const opened = (id: string, number: number, at = NOW) =>
  picked(id, number, at).open(
    {
      url: PullRequestUrl.of(`https://github.com/acme/platform/pull/${number}`),
      number,
      gitHubId: 1_000 + number,
      repository: SOURCE.repository,
      basedOn: StationFingerprint.of('d'.repeat(64)),
      proposing: StationFingerprint.of('e'.repeat(64)),
    },
    at,
  );

const merged = (id: string, number: number, at: Date) =>
  opened(id, number, at).recordGitHubClose({ merged: true, at });

const BASE_CHANGED = ConfigPullRequestReason.of({
  code: 'base-changed',
  message: 'The file changed since the search began.',
});

const failed = (at: Date) =>
  picked('pr_failed', 9, at).failed(BASE_CHANGED, at);

const searchOf = (over: Partial<PickingSearch> = {}): PickingSearch => ({
  id: SEARCH_ID,
  awaitsPick: false,
  pickedCandidate: null,
  ...over,
});

const facts = (over: Partial<ImprovementFacts> = {}): ImprovementFacts => ({
  policyEnabled: true,
  set: SET,
  schedule: schedule(),
  activeSearch: null,
  newestSearch: null,
  pickHasPullRequest: false,
  openPullRequest: null,
  newestMerged: null,
  newestFailed: null,
  ...over,
});

describe('improvementOf', () => {
  it('says a search runs before anything else, even with the policy off', () => {
    expect(
      improvementOf(
        facts({
          activeSearch: { id: SEARCH_ID },
          policyEnabled: false,
          openPullRequest: opened('pr_1', 7),
        }),
      ),
    ).toEqual({ status: 'searching', searchId: SEARCH_ID });
  });

  it('is picking while the newest search has not picked, or picked with no pull request yet', () => {
    expect(
      improvementOf(facts({ newestSearch: searchOf({ awaitsPick: true }) })),
    ).toEqual({ status: 'picking', searchId: SEARCH_ID, phase: 'choosing' });
    expect(
      improvementOf(
        facts({
          newestSearch: searchOf({ pickedCandidate: CandidateId.of('c') }),
        }),
      ),
    ).toEqual({ status: 'picking', searchId: SEARCH_ID, phase: 'opening' });
    expect(
      improvementOf(
        facts({
          newestSearch: searchOf({ pickedCandidate: CandidateId.of('c') }),
          pickHasPullRequest: true,
          schedule: started(),
        }),
      ).status,
    ).toBe('waiting');
  });

  it('names the open config pull request, also while Spotlight still opens it', () => {
    expect(
      improvementOf(facts({ openPullRequest: opened('pr_1', 7) })),
    ).toEqual({
      status: 'pull-request-open',
      url: 'https://github.com/acme/platform/pull/7',
    });
    expect(
      improvementOf(facts({ openPullRequest: picked('pr_2', 8) })),
    ).toEqual({ status: 'pull-request-open', url: null });
  });

  it('counts a stale pull request that Spotlight closes as open until GitHub closes it', () => {
    const closing = opened('pr_1', 7).closeIfStale(null, later(1));

    expect(closing.current).toBe('closing');
    expect(
      improvementOf(facts({ openPullRequest: closing, schedule: started() })),
    ).toEqual({
      status: 'pull-request-open',
      url: 'https://github.com/acme/platform/pull/7',
    });
  });

  it('is off when the search policy of the station is off', () => {
    expect(improvementOf(facts({ policyEnabled: false }))).toEqual({
      status: 'off',
    });
  });

  it('has not started without a set, a schedule or a run in the set', () => {
    expect(improvementOf(facts({ set: null }))).toEqual({
      status: 'not-started',
    });
    expect(improvementOf(facts({ schedule: null }))).toEqual({
      status: 'not-started',
    });
    expect(improvementOf(facts({ set: aSet(0) }))).toEqual({
      status: 'not-started',
    });
  });

  it.each(PERSON_MUST_ACT)(
    'is not improving while a %s skip waits for a person',
    (reason) => {
      expect(
        improvementOf(
          facts({ schedule: schedule().skipped(reason, NOW, later(1)) }),
        ),
      ).toEqual({
        status: 'not-improving',
        block: { kind: 'skip', skip: { reason, at: NOW } },
      });
    },
  );

  it.each([...TRANSIENT_SKIP_REASONS])(
    'waits for the next check after a %s skip',
    (reason) => {
      expect(
        improvementOf(
          facts({ schedule: schedule().skipped(reason, NOW, later(HOUR_MS)) }),
        ),
      ).toEqual({ status: 'waiting', checkAfter: later(HOUR_MS) });
    },
  );

  it('is not improving when the newest config pull request failed after the last start', () => {
    expect(
      improvementOf(
        facts({ schedule: started(), newestFailed: failed(later(1)) }),
      ),
    ).toEqual({
      status: 'not-improving',
      block: { kind: 'pull-request-failed', reason: BASE_CHANGED },
    });
  });

  it('ignores a failed pull request from before the last start or the last improvement', () => {
    expect(
      improvementOf(
        facts({
          schedule: started(later(2 * HOUR_MS)),
          newestFailed: failed(later(HOUR_MS)),
        }),
      ).status,
    ).toBe('waiting');
    expect(
      improvementOf(
        facts({
          schedule: started().improved(later(2 * HOUR_MS)),
          newestFailed: failed(later(HOUR_MS)),
        }),
      ).status,
    ).toBe('improved');
  });

  it('is improved by the newest merged pull request until the next search starts', () => {
    const improved = started().improved(later(2 * HOUR_MS));
    const newestMerged = merged('pr_2', 8, later(2 * HOUR_MS));

    expect(improvementOf(facts({ schedule: improved, newestMerged }))).toEqual({
      status: 'improved',
      at: later(2 * HOUR_MS),
      url: 'https://github.com/acme/platform/pull/8',
    });
    expect(
      improvementOf(
        facts({
          schedule: improved.started({
            searched: [],
            inSet: [],
            at: later(3 * HOUR_MS),
            cooldownMilliseconds: HOUR_MS,
          }),
          newestMerged,
        }),
      ),
    ).toEqual({ status: 'waiting', checkAfter: later(4 * HOUR_MS) });
  });

  it('ignores a skip from before the merge that improved the station', () => {
    const stale = started()
      .skipped('no-scoring', later(HOUR_MS), later(2 * HOUR_MS))
      .improved(later(2 * HOUR_MS));

    expect(improvementOf(facts({ schedule: stale })).status).toBe('improved');
  });

  it('is not improving after a skip that came after the improvement', () => {
    const blocked = started()
      .improved(later(HOUR_MS))
      .skipped('judge-unstable', later(2 * HOUR_MS), later(3 * HOUR_MS));

    expect(improvementOf(facts({ schedule: blocked }))).toEqual({
      status: 'not-improving',
      block: {
        kind: 'skip',
        skip: { reason: 'judge-unstable', at: later(2 * HOUR_MS) },
      },
    });
  });

  it('waits for the next check when nothing else applies', () => {
    expect(improvementOf(facts({ schedule: started() }))).toEqual({
      status: 'waiting',
      checkAfter: later(HOUR_MS),
    });
  });
});
