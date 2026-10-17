import type {
  Heard,
  TranslatedDelivery,
} from '@github/application/ports/webhook-translation.port';
import { GitHubWebhooks } from '@github/application/services/github-webhooks.service';
import type { RecordPullRequests } from '@github/application/services/record-pull-requests.service';
import { GitHubConnection } from '@github/domain/aggregates/github-connection.aggregate';
import { PullRequestClosed } from '@github/domain/events/pull-request-closed.event';
import { PullRequestReviewed } from '@github/domain/events/pull-request-reviewed.event';
import { ReviewCommentReceived } from '@github/domain/events/review-comment-received.event';
import type { GitHubConnectionRepository } from '@github/domain/repositories/github-connection.repository';
import { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const INSTALLED = GitHubInstallation.of('158876513');

const DELIVERY = { headers: {}, body: {}, raw: Buffer.from('{}') };

const COMMENT = {
  id: 300,
  url: 'https://github.com/acme/api/pull/7#discussion_r300',
  path: 'src/a.ts',
  subject: 'line' as const,
  side: 'new' as const,
  line: 12,
  startLine: 9,
  body: 'Why not a constant?',
  answers: 200,
  login: 'octocat',
  byBot: false,
  writtenAt: new Date('2026-09-16T09:00:00Z'),
};

const MERGED: Heard = {
  kind: 'pull-request-activity',
  activity: {
    activity: 'merged',
    branch: 'spotlight/task_1',
    pullRequest: 'https://github.com/acme/api/pull/7',
    label: null,
    about: null,
    remark: null,
    byBot: false,
  },
};

const CLOSED: Heard = {
  kind: 'pull-request-closed',
  pullRequest: 'https://github.com/acme/api/pull/7',
  repository: 'acme/api',
  merge: null,
  closedAt: null,
};

const hooks = (
  translated: TranslatedDelivery,
  over: {
    claimed?: boolean;
    signs?: boolean;
    dispatch?: () => Promise<void>;
  } = {},
) => {
  const claimed = over.claimed ?? true;
  const connections = {
    claimantOf: vi.fn(async () => (claimed ? WORKSPACE : null)),
    of: vi.fn(async (id: WorkspaceId) =>
      claimed
        ? GitHubConnection.rehydrate({
            workspaceId: id,
            installation: INSTALLED,
            version: 1,
          })
        : GitHubConnection.none(id),
    ),
    lockedClaimantOf: vi.fn(async () => (claimed ? WORKSPACE : null)),
    save: vi.fn(async (_: GitHubConnection) => {}),
  } satisfies GitHubConnectionRepository;
  const events = {
    dispatch: vi.fn(over.dispatch ?? (async (_: readonly DomainEvent[]) => {})),
  };
  const signature = { signs: vi.fn(() => over.signs ?? true) };
  const logger = { error: vi.fn() } as unknown as LoggerPort;
  const recording = {
    described: vi.fn(async () => {}),
    reviewed: vi.fn(async () => {}),
    reviewDismissed: vi.fn(async () => {}),
    commented: vi.fn(async () => {}),
    threadResolved: vi.fn(async () => {}),
    uninstalled: vi.fn(async () => 0),
  };

  return {
    service: new GitHubWebhooks(
      {
        idOf: () => 'd_1',
        signatureOf: () => 'sha256=abc',
        translated: () => translated,
      },
      signature,
      connections,
      events,
      recording as unknown as RecordPullRequests,
      logger,
    ),
    connections,
    events,
    recording,
    signature,
    logger,
  };
};

describe('GitHubWebhooks', () => {
  describe('verifying a delivery', () => {
    it('checks the signature over the bytes as received', () => {
      const { service, signature } = hooks({ installation: null, heard: [] });

      expect(service.verifies(DELIVERY)).toBe(true);
      expect(signature.signs).toHaveBeenCalledWith(DELIVERY.raw, 'sha256=abc');
    });

    it('rejects a delivery without its bytes, or with a bad signature', () => {
      expect(
        hooks({ installation: null, heard: [] }).service.verifies({
          ...DELIVERY,
          raw: null,
        }),
      ).toBe(false);
      expect(
        hooks(
          { installation: null, heard: [] },
          { signs: false },
        ).service.verifies(DELIVERY),
      ).toBe(false);
    });
  });

  describe('routing to a workspace', () => {
    it('asks whose the installation the delivery names is', async () => {
      const { service, connections } = hooks({
        installation: '158876513',
        heard: [],
      });

      expect(await service.workspaceOf(DELIVERY)).toEqual(WORKSPACE);
      expect(connections.claimantOf).toHaveBeenCalledWith(INSTALLED);
    });

    it('routes a delivery that names no installation nowhere', async () => {
      const { service, connections } = hooks({ installation: null, heard: [] });

      expect(await service.workspaceOf(DELIVERY)).toBeNull();
      expect(connections.claimantOf).not.toHaveBeenCalled();
    });
  });

  it('hands over only the pull request activity it heard', () => {
    const { service } = hooks({
      installation: '158876513',
      heard: [{ kind: 'installation-removed' }, MERGED],
    });

    expect(service.activityIn(DELIVERY)).toEqual([
      MERGED.kind === 'pull-request-activity' ? MERGED.activity : null,
    ]);
  });

  describe('receiving', () => {
    it('lets go of an installation GitHub removed, saying so', async () => {
      const { service, connections } = hooks({
        installation: '158876513',
        heard: [{ kind: 'installation-removed' }],
      });

      await service.receive(DELIVERY);

      const [saved] = connections.save.mock.calls[0] as [GitHubConnection];
      expect(saved.installation).toBeNull();
      expect(saved.pullEvents().map((each) => each.kind)).toEqual([
        'workspace.disconnected',
      ]);
    });

    it('leaves forgetting the pull requests of a removed installation to the disconnection it says', async () => {
      const { service, recording } = hooks({
        installation: '158876513',
        heard: [{ kind: 'installation-removed' }],
      });

      await service.receive(DELIVERY);

      expect(recording.uninstalled).not.toHaveBeenCalled();
    });

    it('records that a review was dismissed', async () => {
      const { service, recording } = hooks({
        installation: '42',
        heard: [
          {
            kind: 'pull-request-review-dismissed',
            pullRequest: 'https://github.com/acme/api/pull/7',
            id: 900,
            facts: null,
          },
        ],
      });

      await service.receive(DELIVERY);

      expect(recording.reviewDismissed).toHaveBeenCalledWith(
        { installation: GitHubInstallation.of('42'), workspaceId: WORKSPACE },
        'https://github.com/acme/api/pull/7',
        null,
        900,
      );
    });

    it('saves nothing where nobody claimed that installation', async () => {
      const { service, connections } = hooks(
        {
          installation: '158876513',
          heard: [{ kind: 'installation-removed' }],
        },
        { claimed: false },
      );

      await service.receive(DELIVERY);

      expect(connections.save).not.toHaveBeenCalled();
    });

    it('says a review comment was received in the workspace', async () => {
      const { service, events } = hooks({
        installation: '42',
        heard: [
          {
            kind: 'review-comment',
            action: 'created',
            pullRequest: 'https://github.com/acme/api/pull/7',
            comment: COMMENT,
            facts: null,
          },
        ],
      });

      await service.receive(DELIVERY);

      expect(events.dispatch).toHaveBeenCalledWith([
        new ReviewCommentReceived(
          WORKSPACE,
          'created',
          'https://github.com/acme/api/pull/7',
          COMMENT,
        ),
      ]);
    });

    it('says a pull request closed in the workspace', async () => {
      const closedAt = new Date('2026-09-21T09:30:00Z');
      const { service, events } = hooks({
        installation: '42',
        heard: [
          {
            kind: 'pull-request-closed',
            pullRequest: 'https://github.com/acme/api/pull/7',
            repository: 'acme/api',
            merge: { commit: 'c'.repeat(40) },
            closedAt,
          },
        ],
      });

      await service.receive(DELIVERY);

      expect(events.dispatch).toHaveBeenCalledWith([
        new PullRequestClosed(
          WORKSPACE,
          'https://github.com/acme/api/pull/7',
          'acme/api',
          { commit: 'c'.repeat(40) },
          closedAt,
        ),
      ]);
    });

    it('says a pull request was reviewed in the workspace', async () => {
      const submittedAt = new Date('2026-09-21T09:30:00Z');
      const { service, events } = hooks({
        installation: '42',
        heard: [
          {
            kind: 'pull-request-reviewed',
            pullRequest: 'https://github.com/acme/api/pull/7',
            id: 900,
            facts: null,
            state: 'changes-requested',
            login: 'ada',
            byBot: false,
            submittedAt,
          },
        ],
      });

      await service.receive(DELIVERY);

      expect(events.dispatch).toHaveBeenCalledWith([
        new PullRequestReviewed(
          WORKSPACE,
          'https://github.com/acme/api/pull/7',
          'changes-requested',
          'ada',
          false,
          submittedAt,
        ),
      ]);
    });

    it('records every pull request it hears of, whether or not a task owns it', async () => {
      const facts = {
        url: PullRequestUrl.of('https://github.com/acme/api/pull/8'),
        repository: Repository.of('acme/api'),
        number: 8,
        title: 'Tidy the router',
        body: null,
        author: 'ada',
        authorIsBot: false,
        branch: 'tidy-router',
        size: { additions: 10, deletions: 2, changedFiles: 1 },
        openedAt: new Date('2026-09-21T08:00:00Z'),
        draft: false,
        markedReadyAt: null,
        markedDraftAt: null,
        state: 'open' as const,
        closedAt: null,
        updatedAt: new Date('2026-09-21T08:30:00Z'),
      };
      const { service, recording } = hooks({
        installation: '42',
        heard: [{ kind: 'pull-request', facts }],
      });

      await service.receive(DELIVERY);

      expect(recording.described).toHaveBeenCalledWith(
        { installation: GitHubInstallation.of('42'), workspaceId: WORKSPACE },
        facts,
      );
    });

    it('records a review on the pull request it was given to', async () => {
      const submittedAt = new Date('2026-09-21T09:30:00Z');
      const { service, recording } = hooks({
        installation: '42',
        heard: [
          {
            kind: 'pull-request-reviewed',
            pullRequest: 'https://github.com/acme/api/pull/7',
            id: 900,
            facts: null,
            state: 'approved',
            login: 'ada',
            byBot: false,
            submittedAt,
          },
        ],
      });

      await service.receive(DELIVERY);

      expect(recording.reviewed).toHaveBeenCalledWith(
        { installation: GitHubInstallation.of('42'), workspaceId: WORKSPACE },
        'https://github.com/acme/api/pull/7',
        null,
        {
          id: 900,
          state: 'approved',
          login: 'ada',
          byBot: false,
          at: submittedAt,
        },
      );
    });

    it('records a review comment on the pull request it was left on', async () => {
      const { service, recording } = hooks({
        installation: '42',
        heard: [
          {
            kind: 'review-comment',
            action: 'deleted',
            pullRequest: 'https://github.com/acme/api/pull/7',
            comment: COMMENT,
            facts: null,
          },
        ],
      });

      await service.receive(DELIVERY);

      expect(recording.commented).toHaveBeenCalledWith(
        { installation: GitHubInstallation.of('42'), workspaceId: WORKSPACE },
        'https://github.com/acme/api/pull/7',
        null,
        {
          id: 300,
          on: 'line',
          action: 'deleted',
          login: 'octocat',
          answers: 200,
          byBot: false,
        },
      );
    });

    it('records a conversation comment on the pull request it was left on', async () => {
      const { service, recording } = hooks({
        installation: '42',
        heard: [
          {
            kind: 'conversation-comment',
            action: 'created',
            pullRequest: 'https://github.com/acme/api/pull/7',
            comment: { id: 400, login: 'coderabbitai[bot]', byBot: true },
          },
        ],
      });

      await service.receive(DELIVERY);

      expect(recording.commented).toHaveBeenCalledWith(
        { installation: GitHubInstallation.of('42'), workspaceId: WORKSPACE },
        'https://github.com/acme/api/pull/7',
        null,
        {
          id: 400,
          on: 'conversation',
          action: 'created',
          login: 'coderabbitai[bot]',
          answers: null,
          byBot: true,
        },
      );
    });

    it('records a review thread resolved on the pull request it is on', async () => {
      const thread = {
        id: 'PRRT_1',
        opener: 300,
        login: 'coderabbitai[bot]',
        byBot: true,
        resolved: true,
      };
      const { service, recording } = hooks({
        installation: '42',
        heard: [
          {
            kind: 'review-thread',
            pullRequest: 'https://github.com/acme/api/pull/7',
            thread,
            facts: null,
          },
        ],
      });

      await service.receive(DELIVERY);

      expect(recording.threadResolved).toHaveBeenCalledWith(
        { installation: GitHubInstallation.of('42'), workspaceId: WORKSPACE },
        'https://github.com/acme/api/pull/7',
        null,
        thread,
      );
    });

    it('says nothing of a delivery through an installation nobody claimed', async () => {
      const { service, events } = hooks(
        {
          installation: '42',
          heard: [CLOSED],
        },
        { claimed: false },
      );

      await service.receive(DELIVERY);

      expect(events.dispatch).not.toHaveBeenCalled();
    });

    it('says nothing where the delivery came through no installation', async () => {
      const { service, events, connections } = hooks({
        installation: null,
        heard: [CLOSED],
      });

      await service.receive(DELIVERY);

      expect(connections.claimantOf).not.toHaveBeenCalled();
      expect(events.dispatch).not.toHaveBeenCalled();
    });

    it('leaves pull request activity to whoever reads it', async () => {
      const { service, connections, events } = hooks({
        installation: '42',
        heard: [MERGED],
      });

      await service.receive(DELIVERY);

      expect(connections.claimantOf).not.toHaveBeenCalled();
      expect(events.dispatch).not.toHaveBeenCalled();
    });

    it('fails the delivery when attending goes wrong, so it is tried again', async () => {
      const { service, events, logger } = hooks(
        {
          installation: '42',
          heard: [CLOSED],
        },
        {
          dispatch: async () => {
            throw new Error('the outbox is down');
          },
        },
      );

      await expect(service.receive(DELIVERY)).rejects.toThrow(
        'the outbox is down',
      );
      expect(events.dispatch).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });

    it('attends to everything a delivery said before failing it for what went wrong', async () => {
      const facts = {
        url: PullRequestUrl.of('https://github.com/acme/api/pull/8'),
        repository: Repository.of('acme/api'),
        number: 8,
        title: 'Tidy the router',
        body: null,
        author: 'ada',
        authorIsBot: false,
        branch: null,
        size: null,
        openedAt: new Date('2026-09-21T08:00:00Z'),
        draft: false,
        markedReadyAt: null,
        markedDraftAt: null,
        state: 'open' as const,
        closedAt: null,
        updatedAt: new Date('2026-09-21T08:30:00Z'),
      };
      const { service, recording } = hooks({
        installation: '42',
        heard: [
          { kind: 'pull-request', facts },
          { kind: 'pull-request', facts: { ...facts, number: 9 } },
        ],
      });
      recording.described.mockRejectedValueOnce(
        new Error('Database went away'),
      );

      await expect(service.receive(DELIVERY)).rejects.toThrow(
        'Database went away',
      );
      expect(recording.described).toHaveBeenCalledTimes(2);
    });
  });
});
