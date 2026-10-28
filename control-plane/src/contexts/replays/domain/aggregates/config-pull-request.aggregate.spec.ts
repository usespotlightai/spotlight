import {
  ConfigPullRequest,
  MAX_RETRIES,
} from '@replays/domain/aggregates/config-pull-request.aggregate';
import { ConfigPullRequestFailed } from '@replays/domain/events/config-pull-request-failed.event';
import { ConfigPullRequestOpened } from '@replays/domain/events/config-pull-request-opened.event';
import { ConfigPullRequestRequested } from '@replays/domain/events/config-pull-request-requested.event';
import { BY, later, NOW, STATION } from '@replays/domain/replays.fake-spec';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import { ConfigPullRequestReason } from '@replays/domain/value-objects/config-pull-request-reason.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { describe, expect, it } from 'vitest';

const PROPOSED = StationFingerprint.of('e'.repeat(64));

const SOURCE = {
  repository: Repository.of('acme/platform'),
  path: 'teams/core/delivery.tf',
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

describe('ConfigPullRequest', () => {
  it('opens on its own branch, due at once, and records the pick', () => {
    const pullRequest = picked();
    const [wanted] = pullRequest.pullEvents();

    expect(pullRequest.current).toBe('opening');
    expect(pullRequest.branch).toBe('spotlight/search-5d1e2f3a-terse');
    expect(pullRequest.repository).toBe('acme/platform');
    expect(pullRequest.isDue(NOW)).toBe(true);
    expect(wanted).toBeInstanceOf(ConfigPullRequestRequested);
    expect((wanted as ConfigPullRequestRequested).change).toMatchObject({
      resource: 'config-pull-request',
      action: 'created',
      key: 'spotlight/search-5d1e2f3a-terse',
    });
  });

  it('fails at once when the line names no source, and says so', () => {
    const pullRequest = picked(null);

    expect(pullRequest.current).toBe('failed');
    expect(pullRequest.reason?.code).toBe('no-source');
    expect(pullRequest.dueAt).toBeNull();
    expect(pullRequest.pullEvents()).toContainEqual(
      new ConfigPullRequestFailed(
        ConfigPullRequestId.of('pr_1'),
        STATION.workspaceId,
        pullRequest.reason as ConfigPullRequestReason,
      ),
    );
  });

  it('says so when it fails after it was opening', () => {
    const opening = picked();

    opening.pullEvents();

    const reason = ConfigPullRequestReason.of({
      code: 'base-changed',
      message: 'moved on',
    });

    expect(opening.failed(reason, NOW).pullEvents()).toEqual([
      new ConfigPullRequestFailed(
        ConfigPullRequestId.of('pr_1'),
        STATION.workspaceId,
        reason,
      ),
    ]);
  });

  it('retries later after a failure, and fails after the last try', () => {
    let pullRequest = picked();

    pullRequest = pullRequest.tried('GitHub is down', NOW);

    expect(pullRequest.current).toBe('opening');
    expect(pullRequest.isDue(NOW)).toBe(false);
    expect(pullRequest.isDue(later(30_000))).toBe(true);

    for (let retries = 1; retries < MAX_RETRIES; retries += 1) {
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
});
