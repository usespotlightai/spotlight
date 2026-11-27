import { MergeabilityUnknownError } from '@github/application/errors/mergeability-unknown.error';
import type {
  PullRequestMergeabilityDto,
  PullRequestPort,
} from '@github/application/ports/pull-request.port';
import { PullRequestMergeability } from '@github/application/services/pull-request-mergeability.service';
import { PullRequest } from '@github/domain/aggregates/pull-request.aggregate';
import { PullRequestBaseMoved } from '@github/domain/events/pull-request-base-moved.event';
import type { GitHubConnectionRepository } from '@github/domain/repositories/github-connection.repository';
import type { PullRequestRepository } from '@github/domain/repositories/pull-request.repository';
import { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const INSTALLATION = GitHubInstallation.of('42');
const FROM = { installation: INSTALLATION, workspaceId: WORKSPACE };
const REPOSITORY = Repository.of('acme/api');
const NOW = new Date('2026-11-20T00:00:00Z');

const urlOf = (number: number) =>
  PullRequestUrl.of(`https://github.com/acme/api/pull/${number}`);

const recorded = (
  number: number,
  state: 'open' | 'merged' = 'open',
): PullRequest => {
  const first = PullRequest.fromWebhook(
    WORKSPACE,
    {
      url: urlOf(number),
      repository: REPOSITORY,
      number,
      title: `Change ${number}`,
      body: null,
      author: 'spotlight[bot]',
      authorIsBot: true,
      branch: `spotlight/task_${number}`,
      size: null,
      openedAt: new Date('2026-11-19T08:00:00Z'),
      draft: false,
      markedReadyAt: null,
      markedDraftAt: null,
      state,
      closedAt: state === 'open' ? null : new Date('2026-11-19T09:00:00Z'),
      updatedAt: null,
    },
    NOW,
  );

  if (!first) {
    throw new Error('Expected a pull request');
  }

  first.pullEvents();

  return first;
};

const MERGES: PullRequestMergeabilityDto = {
  state: 'open',
  mergeable: true,
  branch: 'spotlight/task_18',
  base: 'main',
};

const mergeabilityOver = (
  stored: readonly PullRequest[],
  answers: readonly PullRequestMergeabilityDto[] = [MERGES],
  connected = true,
) => {
  const rows = new Map(stored.map((each) => [each.url.value, each]));
  const dispatched: DomainEvent[] = [];
  const pullRequests = {
    openIn: async () =>
      [...rows.values()].filter((each) => each.state === 'open'),
    lockedAt: async (_: WorkspaceId, url: PullRequestUrl) =>
      rows.get(url.value) ?? null,
    save: async (saved: PullRequest) => {
      dispatched.push(...saved.pullEvents());
      rows.set(saved.url.value, saved);
    },
  } as unknown as PullRequestRepository;
  const connections = {
    connectedWorkspaceOf: async () => (connected ? WORKSPACE : null),
  } as unknown as GitHubConnectionRepository;
  let asked = 0;
  const github = {
    mergeabilityOf: vi.fn<PullRequestPort['mergeabilityOf']>(
      async () => answers[Math.min(asked++, answers.length - 1)] ?? MERGES,
    ),
  };

  return {
    service: new PullRequestMergeability(pullRequests, connections, github, {
      inTransaction: (work) => work(),
    }),
    dispatched,
    github,
    rows,
  };
};

const moved = (number: number) =>
  new PullRequestBaseMoved(
    WORKSPACE,
    urlOf(number),
    REPOSITORY,
    number,
    'main',
  );

describe('PullRequestMergeability', () => {
  describe('when the default branch moves', () => {
    it('records that the base of each open pull request moved, without asking GitHub', async () => {
      const { service, dispatched, github } = mergeabilityOver([
        recorded(17),
        recorded(18),
        recorded(16, 'merged'),
      ]);

      await service.baseMoved(FROM, REPOSITORY, 'main');

      expect(dispatched).toEqual([moved(17), moved(18)]);
      expect(github.mergeabilityOf).not.toHaveBeenCalled();
    });

    it('records nothing for an installation the workspace no longer has', async () => {
      const { service, dispatched } = mergeabilityOver(
        [recorded(18)],
        [MERGES],
        false,
      );

      await service.baseMoved(FROM, REPOSITORY, 'main');

      expect(dispatched).toEqual([]);
    });
  });

  describe('checking a pull request whose base moved', () => {
    it('says it conflicts with the base GitHub names', async () => {
      const { service, dispatched, github } = mergeabilityOver(
        [recorded(18)],
        [{ ...MERGES, mergeable: false }],
      );

      await service.check(moved(18));

      expect(github.mergeabilityOf).toHaveBeenCalledWith({
        workspaceId: WORKSPACE,
        repository: REPOSITORY,
        number: 18,
      });
      expect(dispatched).toEqual([
        expect.objectContaining({
          kind: 'pull-request.conflicted',
          pullRequest: urlOf(18),
          branch: 'spotlight/task_18',
          base: 'main',
        }),
      ]);
    });

    it('says it once while the pull request keeps conflicting', async () => {
      const { service, dispatched } = mergeabilityOver(
        [recorded(18)],
        [{ ...MERGES, mergeable: false }],
      );

      await service.check(moved(18));
      await service.check(moved(18));

      expect(dispatched.map((each) => each.kind)).toEqual([
        'pull-request.conflicted',
      ]);
    });

    it('fails, to be tried again, while GitHub still computes it', async () => {
      const { service, dispatched } = mergeabilityOver(
        [recorded(18)],
        [{ ...MERGES, mergeable: null }],
      );

      await expect(service.check(moved(18))).rejects.toBeInstanceOf(
        MergeabilityUnknownError,
      );
      expect(dispatched).toEqual([]);
    });

    it('leaves a pull request GitHub says is no longer open', async () => {
      const { service, dispatched } = mergeabilityOver(
        [recorded(18)],
        [{ ...MERGES, state: 'merged', mergeable: null }],
      );

      await service.check(moved(18));

      expect(dispatched).toEqual([]);
    });
  });
});
