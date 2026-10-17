import { PullRequestsNotForgottenError } from '@github/application/errors/pull-requests-not-forgotten.error';
import { RecordPullRequests } from '@github/application/services/record-pull-requests.service';
import { GitHubConnection } from '@github/domain/aggregates/github-connection.aggregate';
import {
  PullRequest,
  type PullRequestFacts,
} from '@github/domain/aggregates/pull-request.aggregate';
import { PullRequestRevertMerged } from '@github/domain/events/pull-request-revert-merged.event';
import { PullRequestVersionConflictError } from '@github/domain/exceptions/pull-request-version-conflict.error';
import type { GitHubConnectionRepository } from '@github/domain/repositories/github-connection.repository';
import type { PullRequestRepository } from '@github/domain/repositories/pull-request.repository';
import { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const INSTALLATION = GitHubInstallation.of('42');
const FROM = { installation: INSTALLATION, workspaceId: WORKSPACE };
const NOW = new Date('2027-06-01T00:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

const urlOf = (number: number) =>
  PullRequestUrl.of(`https://github.com/acme/api/pull/${number}`);

const factsOf = (
  number: number,
  over: Partial<PullRequestFacts> = {},
): PullRequestFacts => ({
  url: urlOf(number),
  repository: Repository.of('acme/api'),
  number,
  title: `Change ${number}`,
  body: null,
  author: 'ada',
  authorIsBot: false,
  branch: null,
  size: null,
  openedAt: new Date('2026-09-20T08:00:00Z'),
  draft: false,
  markedReadyAt: null,
  markedDraftAt: null,
  state: 'open',
  closedAt: null,
  updatedAt: new Date(NOW.getTime() - DAY),
  ...over,
});

class PullRequestsInMemory implements PullRequestRepository {
  readonly held = new Map<string, PullRequest>();
  readonly dispatched: DomainEvent[] = [];
  collisions = 0;

  async at(_: WorkspaceId, url: PullRequestUrl) {
    return this.held.get(url.value) ?? null;
  }

  async numbered(_: WorkspaceId, __: Repository, number: number) {
    return (
      [...this.held.values()].find((each) => each.number === number) ?? null
    );
  }

  async lastMergedTitled(_: WorkspaceId, __: Repository, title: string) {
    return (
      [...this.held.values()].find(
        (each) => each.merged && each.title === title,
      ) ?? null
    );
  }

  async lastHeardBefore(before: Date, after: PullRequest | null, max: number) {
    return [...this.held.values()]
      .filter(
        (each) =>
          (each.closedAt ?? each.updatedAt).getTime() < before.getTime(),
      )
      .sort(
        (a, b) =>
          a.updatedAt.getTime() - b.updatedAt.getTime() ||
          a.url.value.localeCompare(b.url.value),
      )
      .filter(
        (each) =>
          !after ||
          each.updatedAt.getTime() > after.updatedAt.getTime() ||
          (each.updatedAt.getTime() === after.updatedAt.getTime() &&
            each.url.value > after.url.value),
      )
      .slice(0, max);
  }

  async ofWorkspace(
    workspaceId: WorkspaceId,
    after: PullRequestUrl | null,
    max: number,
  ) {
    return [...this.held.values()]
      .filter((each) => each.workspaceId.equals(workspaceId))
      .sort((a, b) => a.url.value.localeCompare(b.url.value))
      .filter((each) => !after || each.url.value > after.value)
      .slice(0, max);
  }

  async removeForWorkspace(workspaceId: WorkspaceId) {
    for (const [url, each] of this.held) {
      if (each.workspaceId.equals(workspaceId)) {
        this.held.delete(url);
      }
    }
  }

  async lockedAt(workspaceId: WorkspaceId, url: PullRequestUrl) {
    return this.at(workspaceId, url);
  }

  async lockedUnlessBusy(workspaceId: WorkspaceId, url: PullRequestUrl) {
    return this.at(workspaceId, url);
  }

  async add(pullRequest: PullRequest) {
    if (this.held.has(pullRequest.url.value)) {
      throw new PullRequestVersionConflictError(pullRequest.url.value);
    }
    this.stored(pullRequest);
  }

  async save(pullRequest: PullRequest) {
    if (this.collisions > 0) {
      this.collisions -= 1;
      throw new PullRequestVersionConflictError(pullRequest.url.value);
    }
    if (this.held.get(pullRequest.url.value)?.version !== pullRequest.version) {
      throw new PullRequestVersionConflictError(pullRequest.url.value);
    }
    this.stored(pullRequest);
  }

  async remove(pullRequest: PullRequest) {
    this.held.delete(pullRequest.url.value);
    this.dispatched.push(...pullRequest.pullEvents());
  }

  private stored(pullRequest: PullRequest) {
    this.dispatched.push(...pullRequest.pullEvents());
    this.held.set(
      pullRequest.url.value,
      PullRequest.rehydrate({
        workspaceId: pullRequest.workspaceId,
        url: pullRequest.url,
        repository: pullRequest.repository,
        number: pullRequest.number,
        title: pullRequest.title,
        author: pullRequest.author,
        authorIsBot: pullRequest.authorIsBot,
        branch: pullRequest.branch,
        size: pullRequest.size,
        openedAt: pullRequest.openedAt,
        draft: pullRequest.draft,
        readyForReviewAt: pullRequest.readyForReviewAt,
        draftSpells: pullRequest.draftSpells,
        state: pullRequest.state,
        closedAt: pullRequest.closedAt,
        updatedAt: pullRequest.updatedAt,
        reverts: pullRequest.reverts,
        reviews: pullRequest.reviews,
        dismissedReviews: pullRequest.dismissedReviews,
        comments: pullRequest.comments,
        deletedComments: pullRequest.deletedComments,
        botComments: pullRequest.botComments,
        threads: pullRequest.threads,
        revertedBy: pullRequest.revertedBy,
        version: pullRequest.version + 1,
      }),
    );
  }
}

class ConnectionsInMemory implements GitHubConnectionRepository {
  connection = GitHubConnection.rehydrate({
    workspaceId: WORKSPACE,
    installation: INSTALLATION,
    version: 1,
  });
  readonly dispatched: DomainEvent[] = [];

  async of(_: WorkspaceId) {
    return this.connection;
  }

  async claimantOf(installation: GitHubInstallation) {
    return this.connection.installation?.equals(installation)
      ? this.connection.workspaceId
      : null;
  }

  async heldClaimantOf(installation: GitHubInstallation) {
    return this.claimantOf(installation);
  }

  async save(connection: GitHubConnection) {
    this.dispatched.push(...connection.pullEvents());
    this.connection = connection;
  }
}

const recordingAt = (
  now: Date,
  pullRequests = new PullRequestsInMemory(),
  connections = new ConnectionsInMemory(),
) => {
  const logged: string[] = [];

  return {
    pullRequests,
    connections,
    logged,
    service: new RecordPullRequests(
      pullRequests,
      connections,
      { inTransaction: (work) => work() },
      { now: () => now, sleep: async () => {} },
      {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: (_, message) => logged.push(message),
      },
    ),
  };
};

const recording = () => recordingAt(NOW);

describe('RecordPullRequests', () => {
  it('records a pull request no task owns the first time it hears of it', async () => {
    const { service, pullRequests } = recording();

    await service.described(FROM, factsOf(7));

    expect(pullRequests.held.get(urlOf(7).value)?.title).toBe('Change 7');
    expect(pullRequests.dispatched.map((each) => each.kind)).toEqual([
      'pull-request.recorded',
    ]);
  });

  it('records a pull request first heard of through a review on it', async () => {
    const { service, pullRequests } = recording();

    await service.reviewed(FROM, urlOf(7).value, factsOf(7), {
      id: 1,
      state: 'approved',
      login: 'grace',
      byBot: false,
      at: new Date('2026-09-20T09:00:00Z'),
    });

    expect(pullRequests.held.get(urlOf(7).value)?.reviewRounds).toBe(1);
  });

  it('waits to hear what a pull request is before recording a review comment on it', async () => {
    const { service, pullRequests } = recording();

    await service.commented(FROM, urlOf(7).value, null, {
      id: 1,
      on: 'line',
      action: 'created',
      login: 'grace',
      answers: null,
      byBot: false,
    });

    expect(pullRequests.held.size).toBe(0);
  });

  it('tries again where the record changed under it', async () => {
    const { service, pullRequests } = recording();
    await service.described(FROM, factsOf(7));
    pullRequests.collisions = 1;

    await service.commented(FROM, urlOf(7).value, null, {
      id: 1,
      on: 'line',
      action: 'created',
      login: 'grace',
      answers: null,
      byBot: false,
    });

    expect(pullRequests.held.get(urlOf(7).value)?.comments).toEqual([1]);
  });

  it('records a review thread resolved on a pull request it holds', async () => {
    const { service, pullRequests } = recording();
    await service.described(FROM, factsOf(7));

    await service.threadResolved(FROM, urlOf(7).value, factsOf(7), {
      id: 'PRRT_1',
      opener: 10,
      login: 'coderabbitai[bot]',
      byBot: true,
      resolved: true,
    });

    expect(pullRequests.held.get(urlOf(7).value)?.threads).toEqual([
      {
        id: 'PRRT_1',
        opener: 10,
        login: 'coderabbitai[bot]',
        byBot: true,
        resolved: true,
      },
    ]);
  });

  it('marks the pull request a merged revert names by number reverted', async () => {
    const { service, pullRequests } = recording();
    await service.described(
      FROM,
      factsOf(7, { state: 'merged', closedAt: new Date('2027-05-30Z') }),
    );

    await service.revertMerged(
      new PullRequestRevertMerged(
        WORKSPACE,
        urlOf(9).value,
        'acme/api',
        { kind: 'number', number: 7 },
        null,
      ),
    );

    expect(pullRequests.held.get(urlOf(7).value)?.revertedBy).toEqual(urlOf(9));
  });

  it('marks the last merged pull request of a reverted title reverted', async () => {
    const { service, pullRequests } = recording();
    await service.described(
      FROM,
      factsOf(7, { state: 'merged', closedAt: new Date('2027-05-30Z') }),
    );

    await service.revertMerged(
      new PullRequestRevertMerged(
        WORKSPACE,
        urlOf(9).value,
        'acme/api',
        { kind: 'title', title: 'Change 7' },
        null,
      ),
    );

    expect(pullRequests.held.get(urlOf(7).value)?.revertedBy).toEqual(urlOf(9));
  });

  it('forgets pull requests past retention, and keeps the rest', async () => {
    const { service, pullRequests } = recording();
    await service.described(
      FROM,
      factsOf(7, {
        state: 'merged',
        closedAt: new Date(NOW.getTime() - 170 * DAY),
      }),
    );
    await service.described(
      FROM,
      factsOf(8, {
        state: 'closed',
        closedAt: new Date(NOW.getTime() - 160 * DAY),
      }),
    );
    await service.described(FROM, factsOf(9));
    const later = recordingAt(
      new Date(NOW.getTime() + 11 * DAY),
      pullRequests,
    ).service;

    expect(await later.pastRetention()).toBe(1);
    expect([...pullRequests.held.keys()]).toEqual([
      urlOf(8).value,
      urlOf(9).value,
    ]);
    expect(
      pullRequests.dispatched[pullRequests.dispatched.length - 1],
    ).toMatchObject({
      kind: 'pull-request.forgotten',
      pullRequest: urlOf(7).value,
    });
  });

  it('does not record what GitHub says of a pull request already past retention', async () => {
    const { service, pullRequests } = recording();

    await service.described(
      FROM,
      factsOf(7, {
        state: 'merged',
        closedAt: new Date(NOW.getTime() - 181 * DAY),
        updatedAt: NOW,
      }),
    );

    expect(pullRequests.held.size).toBe(0);
  });

  it('forgets every pull request of a workspace whose GitHub App was uninstalled', async () => {
    const { service, pullRequests } = recording();
    await service.described(FROM, factsOf(7));
    await service.described(FROM, factsOf(8));

    expect(await service.uninstalled(WORKSPACE)).toBe(2);
    expect(pullRequests.held.size).toBe(0);
    expect(
      pullRequests.dispatched.filter(
        (each) => each.kind === 'pull-request.forgotten',
      ),
    ).toHaveLength(2);
  });

  it('keeps forgetting the rest where one pull request cannot be forgotten', async () => {
    const { service, pullRequests } = recording();
    await service.described(
      FROM,
      factsOf(7, { updatedAt: new Date(NOW.getTime() - 170 * DAY) }),
    );
    await service.described(
      FROM,
      factsOf(8, { updatedAt: new Date(NOW.getTime() - 170 * DAY) }),
    );
    const failing = Object.assign(pullRequests, {
      remove: async (pullRequest: PullRequest) => {
        if (pullRequest.number === 7) {
          throw new Error('Database went away');
        }
        pullRequests.held.delete(pullRequest.url.value);
      },
    });
    const { service: later, logged } = recordingAt(
      new Date(NOW.getTime() + 11 * DAY),
      failing,
    );

    expect(await later.pastRetention()).toBe(1);
    expect([...pullRequests.held.keys()]).toEqual([urlOf(7).value]);
    expect(logged).toHaveLength(1);
  });

  it('applies what a review says of its pull request along with the review', async () => {
    const { service, pullRequests } = recording();
    await service.described(FROM, factsOf(7));

    await service.reviewed(
      FROM,
      urlOf(7).value,
      factsOf(7, { title: 'Renamed', updatedAt: NOW }),
      { id: 1, state: 'approved', login: 'grace', byBot: false, at: NOW },
    );

    expect(pullRequests.held.get(urlOf(7).value)).toMatchObject({
      title: 'Renamed',
      reviewRounds: 1,
    });
  });

  it('leaves a dismissed review out of the rounds', async () => {
    const { service, pullRequests } = recording();
    await service.reviewed(FROM, urlOf(7).value, factsOf(7), {
      id: 1,
      state: 'changes-requested',
      login: 'grace',
      byBot: false,
      at: NOW,
    });

    await service.reviewDismissed(FROM, urlOf(7).value, factsOf(7), 1);

    expect(pullRequests.held.get(urlOf(7).value)?.reviewRounds).toBe(0);
  });
  it("fails forgetting a removed installation's pull requests where one could not be forgotten, after forgetting the rest", async () => {
    const { service, pullRequests } = recording();
    await service.described(FROM, factsOf(7));
    await service.described(FROM, factsOf(8));
    Object.assign(pullRequests, {
      remove: async (pullRequest: PullRequest) => {
        if (pullRequest.number === 7) {
          throw new Error('Database went away');
        }
        pullRequests.held.delete(pullRequest.url.value);
      },
    });

    await expect(service.uninstalled(WORKSPACE)).rejects.toBeInstanceOf(
      PullRequestsNotForgottenError,
    );
    expect([...pullRequests.held.keys()]).toEqual([urlOf(7).value]);
  });

  it('forgets past retention beyond a full batch that could not be forgotten', async () => {
    const pullRequests = new PullRequestsInMemory();
    const { service } = recordingAt(NOW, pullRequests);
    for (let number = 1; number <= 201; number += 1) {
      await service.described(
        FROM,
        factsOf(number, {
          updatedAt: new Date(NOW.getTime() - 170 * DAY + number),
        }),
      );
    }
    Object.assign(pullRequests, {
      remove: async (pullRequest: PullRequest) => {
        if (pullRequest.number <= 200) {
          throw new Error('Database went away');
        }
        pullRequests.held.delete(pullRequest.url.value);
      },
    });

    const later = recordingAt(
      new Date(NOW.getTime() + 11 * DAY),
      pullRequests,
    ).service;

    expect(await later.pastRetention()).toBe(1);
    expect(pullRequests.held.has(urlOf(201).value)).toBe(false);
  });

  it('records nothing once the workspace no longer holds the installation the delivery came through', async () => {
    const { service, pullRequests, connections } = recording();
    await connections.save(connections.connection.disconnectFrom(INSTALLATION));

    await service.described(FROM, factsOf(7));

    expect(pullRequests.held.size).toBe(0);
  });

  it("lets go of a closed workspace's installation before forgetting its pull requests", async () => {
    const { service, pullRequests, connections } = recording();
    await service.described(FROM, factsOf(7));

    await service.workspaceClosed(WORKSPACE);

    expect(connections.connection.isConnected).toBe(false);
    expect(connections.dispatched.map((each) => each.kind)).toEqual([
      'workspace.disconnected',
    ]);
    expect(pullRequests.held.size).toBe(0);
  });
});
