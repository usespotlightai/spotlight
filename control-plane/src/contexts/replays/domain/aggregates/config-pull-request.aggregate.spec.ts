import {
  ConfigPullRequest,
  MAX_TRIES,
} from '@replays/domain/aggregates/config-pull-request.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { ConfigPullRequestOpened } from '@replays/domain/events/config-pull-request-opened.event';
import { ConfigPullRequestWanted } from '@replays/domain/events/config-pull-request-wanted.event';
import { CandidateUnpickableError } from '@replays/domain/exceptions/candidate-unpickable.error';
import { UnknownCandidateError } from '@replays/domain/exceptions/unknown-candidate.error';
import {
  aSearch,
  BY,
  later,
  NOW,
  STATION,
  searchRunIds,
} from '@replays/domain/replays.fake-spec';
import { pickedFrom } from '@replays/domain/services/search-picks';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import { ConfigPullRequestReason } from '@replays/domain/value-objects/config-pull-request-reason.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const charged = { spent: Spend.of(1, 'USD'), unpriced: 0 };

const PROPOSED = StationFingerprint.of('e'.repeat(64));

const SOURCE = {
  repository: Repository.of('acme/platform'),
  path: 'teams/core/delivery.tf',
};

const withCandidates = (finished: boolean): Search => {
  const runIds = searchRunIds();
  const seeded = aSearch().recordReplayEnd(
    ReplayId.of('replay_seed'),
    'finished',
    charged,
    NOW,
    runIds,
    true,
  );
  const admitted = ['terse', 'in-order'].reduce(
    (built, name) =>
      built.admitted(RunId.of('search_run_1'), {
        candidateId: CandidateId.of(`candidate_${name}`),
        name: CandidateName.searched(name),
        replayId: ReplayId.of(`replay_${name}`),
      }),
    seeded,
  );

  return finished
    ? admitted.recordReplayEnd(
        ReplayId.of('replay_terse'),
        'finished',
        charged,
        later(1),
        runIds,
        true,
      )
    : admitted;
};

const picked = (source: typeof SOURCE | null = SOURCE) =>
  ConfigPullRequest.pick({
    id: ConfigPullRequestId.of('pr_1'),
    searchId: SearchId.of('5d1e2f3a-4b5c-4d6e'),
    candidateId: CandidateId.of('candidate_terse'),
    station: STATION,
    stationKey: 'build',
    candidateName: 'terse',
    lineKey: 'delivery',
    source,
    at: NOW,
    by: BY,
  });

describe('picking a search candidate', () => {
  it('takes a proposed candidate whose searched replay finished', () => {
    expect(
      pickedFrom(withCandidates(true), CandidateId.of('candidate_terse')).name
        .value,
    ).toBe('terse');
  });

  it('rejects the seed, a candidate the search never proposed and one still replaying', () => {
    const search = withCandidates(false);

    expect(() => pickedFrom(search, search.seed.candidateId)).toThrow(
      CandidateUnpickableError,
    );
    expect(() => pickedFrom(search, CandidateId.of('candidate_none'))).toThrow(
      UnknownCandidateError,
    );
    expect(() =>
      pickedFrom(search, CandidateId.of('candidate_in-order')),
    ).toThrow(CandidateUnpickableError);
  });
});

describe('ConfigPullRequest', () => {
  it('opens on its own branch, due at once, and records the pick', () => {
    const pullRequest = picked();
    const [wanted] = pullRequest.pullEvents();

    expect(pullRequest.current).toBe('opening');
    expect(pullRequest.branch).toBe('spotlight/search-5d1e2f3a-terse');
    expect(pullRequest.repository).toBe('acme/platform');
    expect(pullRequest.isDue(NOW)).toBe(true);
    expect(wanted).toBeInstanceOf(ConfigPullRequestWanted);
    expect((wanted as ConfigPullRequestWanted).attempt).toBe(1);
    expect((wanted as ConfigPullRequestWanted).change).toMatchObject({
      resource: 'config-pull-request',
      action: 'created',
      key: 'spotlight/search-5d1e2f3a-terse',
    });
  });

  it('fails at once when the line names no source', () => {
    const pullRequest = picked(null);

    expect(pullRequest.current).toBe('failed');
    expect(pullRequest.reason?.code).toBe('no-source');
    expect(pullRequest.dueAt).toBeNull();
  });

  it('retries later after a failure, and fails after the last try', () => {
    let pullRequest = picked();

    pullRequest = pullRequest.tried('GitHub is down', NOW);

    expect(pullRequest.current).toBe('opening');
    expect(pullRequest.isDue(NOW)).toBe(false);
    expect(pullRequest.isDue(later(30_000))).toBe(true);

    for (let tries = 1; tries < MAX_TRIES; tries += 1) {
      pullRequest = pullRequest.tried('GitHub is down', NOW);
    }

    expect(pullRequest.current).toBe('failed');
    expect(pullRequest.reason).toMatchObject({
      code: 'github-error',
      message: 'GitHub is down',
    });
  });

  it('opens with its link, is no longer due, and records the station config it proposes', () => {
    const opening = picked();

    opening.pullEvents();

    const opened = opening.open(
      PullRequestUrl.of('https://github.com/acme/platform/pull/7'),
      PROPOSED,
      later(5),
    );
    const [event] = opened.pullEvents();

    expect(opened.url).toBe('https://github.com/acme/platform/pull/7');
    expect(opened.dueAt).toBeNull();
    expect(opened.isRetryable).toBe(false);
    expect(event).toBeInstanceOf(ConfigPullRequestOpened);
    expect(event).toMatchObject({
      pullRequestId: ConfigPullRequestId.of('pr_1'),
      workspaceId: STATION.workspaceId,
      teamId: STATION.teamId,
      stationId: STATION.stationId,
      proposing: PROPOSED,
      url: PullRequestUrl.of('https://github.com/acme/platform/pull/7'),
      at: later(5),
    });
  });

  it('is tried again only after it failed, as a new attempt', () => {
    const opening = picked();

    opening.pullEvents();

    expect(() =>
      opening.retried({ lineKey: 'delivery', source: SOURCE, at: NOW, by: BY }),
    ).toThrow();

    const failed = opening.failed(
      ConfigPullRequestReason.of({ code: 'base-changed', message: 'moved on' }),
      NOW,
    );
    const retried = failed.retried({
      lineKey: 'delivery',
      source: SOURCE,
      at: later(5),
      by: BY,
    });
    const [wanted] = retried.pullEvents();

    expect(retried.current).toBe('opening');
    expect(retried.attempts).toBe(2);
    expect(retried.reason).toBeNull();
    expect(retried.isOpening(1)).toBe(false);
    expect(retried.isOpening(2)).toBe(true);
    expect((wanted as ConfigPullRequestWanted).change).toMatchObject({
      action: 'updated',
    });
  });
});
