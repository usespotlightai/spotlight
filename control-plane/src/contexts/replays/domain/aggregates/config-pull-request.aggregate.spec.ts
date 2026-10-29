import {
  ConfigPullRequest,
  MAX_RETRIES,
} from '@replays/domain/aggregates/config-pull-request.aggregate';
import { ConfigPullRequestClosed } from '@replays/domain/events/config-pull-request-closed.event';
import { ConfigPullRequestFailed } from '@replays/domain/events/config-pull-request-failed.event';
import { ConfigPullRequestMerged } from '@replays/domain/events/config-pull-request-merged.event';
import { ConfigPullRequestOpened } from '@replays/domain/events/config-pull-request-opened.event';
import { ConfigPullRequestReopened } from '@replays/domain/events/config-pull-request-reopened.event';
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

const BASED_ON = StationFingerprint.of('d'.repeat(64));

const ELSEWHERE = StationFingerprint.of('c'.repeat(64));

const LINK = PullRequestUrl.of('https://github.com/acme/platform/pull/7');

const OPENED = {
  url: LINK,
  number: 7,
  gitHubId: 707,
  repository: Repository.of('Acme/Platform'),
  basedOn: BASED_ON,
  proposing: PROPOSED,
};

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

    const opened = opening.open(OPENED, later(5));
    const [event] = opened.pullEvents();

    expect(opened.url).toBe('https://github.com/acme/platform/pull/7');
    expect(opened.gitHubPullRequest).toEqual({
      repository: Repository.of('Acme/Platform'),
      number: 7,
    });
    expect(opened).toMatchObject({
      repository: 'Acme/Platform',
      gitHubId: 707,
      basedOn: BASED_ON,
      checkedAt: later(5),
    });
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

  describe('once it opened', () => {
    const opened = () => {
      const pullRequest = picked().open(OPENED, later(5));

      pullRequest.pullEvents();

      return pullRequest;
    };

    const closing = () => {
      const pullRequest = opened().closeIfStale(ELSEWHERE, later(6));

      pullRequest.pullEvents();

      return pullRequest;
    };

    const closedEvent = (because: 'stale' | 'by-person', at: Date) =>
      new ConfigPullRequestClosed(
        ConfigPullRequestId.of('pr_1'),
        STATION.workspaceId,
        STATION.teamId,
        STATION.stationId,
        because,
        BASED_ON,
        PROPOSED,
        at,
      );

    it('stays open while the live config is the one it was based on, or the one it proposes', () => {
      const pullRequest = opened();

      expect(pullRequest.closeIfStale(BASED_ON, later(6))).toBe(pullRequest);
      expect(pullRequest.closeIfStale(PROPOSED, later(6))).toBe(pullRequest);
    });

    it('is due to close as stale, and still open for its station, when the live config changed to another one or the station is gone', () => {
      for (const live of [ELSEWHERE, null]) {
        const stale = opened().closeIfStale(live, later(6));

        expect(stale).toMatchObject({
          current: 'closing',
          closedBecause: 'stale',
          isOpen: true,
        });
        expect(stale.isDue(later(6))).toBe(true);
        expect(stale.pullEvents()).toEqual([]);
      }
    });

    it('retries a failed close later, and closes as stale once GitHub closed it', () => {
      const tried = closing().closeTried('GitHub is down', later(7));

      expect(tried.current).toBe('closing');
      expect(tried.isDue(later(7))).toBe(false);
      expect(tried.isDue(later(7 + 30_000))).toBe(true);

      const closed = tried.closed(later(8));

      expect(closed).toMatchObject({
        current: 'closed',
        closedBecause: 'stale',
        closeFailure: null,
        dueAt: null,
      });
      expect(closed.pullEvents()).toEqual([closedEvent('stale', later(8))]);
    });

    it('closes as stale with the failure recorded after the last failed try', () => {
      let pullRequest = closing();

      for (let retries = 0; retries < MAX_RETRIES; retries += 1) {
        pullRequest = pullRequest.closeTried('GitHub is down', later(7));
      }

      expect(pullRequest).toMatchObject({
        current: 'closed',
        closedBecause: 'stale',
        dueAt: null,
      });
      expect(pullRequest.closeFailure).toMatchObject({
        code: 'github-error',
        message: 'GitHub is down',
      });
    });

    it('closes as stale with the failure recorded when GitHub refuses the close for good', () => {
      const failed = closing().closeFailed(
        ConfigPullRequestReason.of({
          code: 'repository-unreachable',
          message: 'not installed',
        }),
        later(7),
      );

      expect(failed).toMatchObject({
        current: 'closed',
        closedBecause: 'stale',
      });
      expect(failed.closeFailure?.code).toBe('repository-unreachable');
    });

    it('records a close on GitHub during closing as stale', () => {
      const closed = closing().recordGitHubClose({
        merged: false,
        at: later(9),
      });

      expect(closed).toMatchObject({
        current: 'closed',
        closedBecause: 'stale',
      });
      expect(closed.pullEvents()).toEqual([closedEvent('stale', later(9))]);
    });

    it('records a close on GitHub while it is open as by a person', () => {
      const closed = opened().recordGitHubClose({
        merged: false,
        at: later(9),
      });

      expect(closed).toMatchObject({
        current: 'closed',
        closedBecause: 'by-person',
      });
      expect(closed.pullEvents()).toEqual([closedEvent('by-person', later(9))]);
    });

    it('records a merge on GitHub while open, while closing, and after it closed for any reason', () => {
      const closedStale = closing().closeFailed(
        ConfigPullRequestReason.of({ code: 'github-error', message: '422' }),
        later(8),
      );
      const closedByPerson = opened().recordGitHubClose({
        merged: false,
        at: later(8),
      });

      for (const pullRequest of [
        opened(),
        closing(),
        closedStale,
        closedByPerson,
      ]) {
        pullRequest.pullEvents();

        const merged = pullRequest.recordGitHubClose({
          merged: true,
          at: later(9),
        });

        expect(merged).toMatchObject({
          current: 'merged',
          closedBecause: null,
          closeFailure: null,
          dueAt: null,
        });
        expect(merged.pullEvents()).toEqual([
          new ConfigPullRequestMerged(
            ConfigPullRequestId.of('pr_1'),
            STATION.workspaceId,
            STATION.teamId,
            STATION.stationId,
            later(9),
          ),
        ]);
      }
    });

    it('ignores a close on GitHub once it merged or closed, and is never stale after it merged', () => {
      const merged = opened().recordGitHubClose({ merged: true, at: later(9) });
      const closed = opened().recordGitHubClose({
        merged: false,
        at: later(9),
      });

      merged.pullEvents();
      closed.pullEvents();

      expect(merged.recordGitHubClose({ merged: false, at: later(10) })).toBe(
        merged,
      );
      expect(closed.recordGitHubClose({ merged: false, at: later(10) })).toBe(
        closed,
      );
      expect(merged.closeIfStale(ELSEWHERE, later(10))).toBe(merged);
    });

    it('reopens once it closed, saying why it had closed, and ignores a reopen otherwise', () => {
      const closed = opened().recordGitHubClose({
        merged: false,
        at: later(9),
      });

      closed.pullEvents();

      const reopened = closed.reopened(later(10));

      expect(reopened).toMatchObject({
        current: 'opened',
        closedBecause: null,
        checkedAt: later(10),
      });
      expect(reopened.pullEvents()).toEqual([
        new ConfigPullRequestReopened(
          ConfigPullRequestId.of('pr_1'),
          STATION.workspaceId,
          STATION.teamId,
          STATION.stationId,
          'by-person',
          PROPOSED,
          later(10),
        ),
      ]);
      expect(reopened.reopened(later(11))).toBe(reopened);
    });

    it('records when it was last checked against GitHub', () => {
      expect(opened().checked(later(20)).checkedAt).toEqual(later(20));
    });

    it('cannot be closed by Spotlight unless it is closing', () => {
      expect(() => opened().closed(later(9))).toThrow(/opened, not closing/);
    });
  });
});
