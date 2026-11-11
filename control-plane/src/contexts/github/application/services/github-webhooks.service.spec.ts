import type {
  CheckRunsPort,
  FailedCheckDto,
} from '@github/application/ports/check-runs.port';
import type {
  ParsedDelivery,
  WebhookEvent,
} from '@github/application/ports/webhook-parser.port';
import { GitHubWebhooks } from '@github/application/services/github-webhooks.service';
import type { PullRequestSync } from '@github/application/services/pull-request-sync.service';
import { GitHubConnection } from '@github/domain/aggregates/github-connection.aggregate';
import type { GitHubConnectionRepository } from '@github/domain/repositories/github-connection.repository';
import { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import { PullRequestThread } from '@github/domain/value-objects/pull-request-thread.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
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
  inReplyToId: 200,
  login: 'octocat',
  byBot: false,
  writtenAt: new Date('2026-09-16T09:00:00Z'),
};

const MERGED: WebhookEvent = {
  kind: 'pull-request-activity',
  activity: {
    activity: 'merged',
    branch: 'spotlight/task_1',
    pullRequest: 'https://github.com/acme/api/pull/7',
    label: null,
    details: null,
    reviewComment: null,
    ignoredAsBot: false,
    checkSuite: null,
    failedChecks: [],
  },
};

const CLOSED: WebhookEvent = {
  kind: 'pull-request-closed',
  pullRequest: 'https://github.com/acme/api/pull/7',
  repository: 'acme/api',
  gitHubId: 707,
  merge: null,
  closedAt: null,
};

const BUILD_FAILED: FailedCheckDto = {
  name: 'web / build',
  conclusion: 'failure',
  url: 'https://github.com/acme/api/actions/runs/1/job/11',
  step: 'Build',
  summary: null,
  log: 'src/app.ts(3,1): error TS2322',
};

const hooks = (
  parsed: ParsedDelivery,
  over: {
    connected?: boolean;
    signs?: boolean;
    closed?: () => Promise<void>;
    failedInSuite?: () => Promise<readonly FailedCheckDto[]>;
  } = {},
) => {
  const connected = over.connected ?? true;
  const connections = {
    connectedWorkspaceOf: vi.fn(async () => (connected ? WORKSPACE : null)),
    of: vi.fn(async (id: WorkspaceId) =>
      connected
        ? GitHubConnection.rehydrate({
            workspaceId: id,
            installation: INSTALLED,
            version: 1,
          })
        : GitHubConnection.none(id),
    ),
    lockedConnectedWorkspaceOf: vi.fn(async () =>
      connected ? WORKSPACE : null,
    ),
    save: vi.fn(async (_: GitHubConnection) => {}),
  } satisfies GitHubConnectionRepository;
  const signature = { signs: vi.fn(() => over.signs ?? true) };
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as LoggerPort;
  const checkRuns = {
    failedOn: vi.fn(),
    failedInSuite: vi.fn(over.failedInSuite ?? (async () => [BUILD_FAILED])),
  } satisfies CheckRunsPort;
  const sync = {
    updateDetails: vi.fn(async () => {}),
    reviewed: vi.fn(async () => {}),
    reviewDismissed: vi.fn(async () => {}),
    commented: vi.fn(async () => {}),
    threadResolved: vi.fn(async () => {}),
    closed: vi.fn(over.closed ?? (async () => {})),
    reopened: vi.fn(async () => {}),
    uninstalled: vi.fn(async () => 0),
  };

  return {
    service: new GitHubWebhooks(
      {
        idOf: () => 'd_1',
        signatureOf: () => 'sha256=abc',
        parse: () => parsed,
      },
      signature,
      connections,
      sync as unknown as PullRequestSync,
      logger,
      checkRuns,
    ),
    checkRuns,
    connections,
    sync,
    signature,
    logger,
  };
};

describe('GitHubWebhooks', () => {
  describe('verifying a delivery', () => {
    it('checks the signature over the bytes as received', () => {
      const { service, signature } = hooks({ installation: null, events: [] });

      expect(service.verifies(DELIVERY)).toBe(true);
      expect(signature.signs).toHaveBeenCalledWith(DELIVERY.raw, 'sha256=abc');
    });

    it('rejects a delivery without its bytes, or with a bad signature', () => {
      expect(
        hooks({ installation: null, events: [] }).service.verifies({
          ...DELIVERY,
          raw: null,
        }),
      ).toBe(false);
      expect(
        hooks(
          { installation: null, events: [] },
          { signs: false },
        ).service.verifies(DELIVERY),
      ).toBe(false);
    });
  });

  describe('routing to a workspace', () => {
    it('reads whose the installation the delivery names is', async () => {
      const { service, connections } = hooks({
        installation: '158876513',
        events: [],
      });

      expect(await service.workspaceOf(DELIVERY)).toEqual(WORKSPACE);
      expect(connections.connectedWorkspaceOf).toHaveBeenCalledWith(INSTALLED);
    });

    it('routes a delivery that names no installation nowhere', async () => {
      const { service, connections } = hooks({
        installation: null,
        events: [],
      });

      expect(await service.workspaceOf(DELIVERY)).toBeNull();
      expect(connections.connectedWorkspaceOf).not.toHaveBeenCalled();
    });
  });

  it('hands over only the pull request activity it received', async () => {
    const { service } = hooks({
      installation: '158876513',
      events: [{ kind: 'installation-removed' }, MERGED],
    });

    expect(await service.activityIn(DELIVERY)).toEqual([
      MERGED.kind === 'pull-request-activity' ? MERGED.activity : null,
    ]);
  });

  describe('naming the checks that failed', () => {
    const FAILED: WebhookEvent = {
      kind: 'pull-request-activity',
      activity: {
        ...(MERGED.kind === 'pull-request-activity'
          ? MERGED.activity
          : ({} as never)),
        activity: 'checks-failed',
        checkSuite: { id: 42, repository: 'acme/api' },
      },
    };

    it('asks GitHub which checks of the suite failed, at which step, and how their logs end', async () => {
      const { service, checkRuns } = hooks({
        installation: '158876513',
        events: [FAILED],
      });

      const [read] = await service.activityIn(DELIVERY);

      expect(read?.failedChecks).toEqual([
        {
          name: 'web / build',
          step: 'Build',
          summary: null,
          log: 'src/app.ts(3,1): error TS2322',
        },
      ]);
      expect(checkRuns.failedInSuite).toHaveBeenCalledWith(
        WORKSPACE,
        Repository.of('acme/api'),
        42,
      );
    });

    it('still hands over the failure when GitHub would not name the checks', async () => {
      const { service, logger } = hooks(
        { installation: '158876513', events: [FAILED] },
        {
          failedInSuite: async () => {
            throw new Error('Resource not accessible by integration');
          },
        },
      );

      const [read] = await service.activityIn(DELIVERY);

      expect(read?.activity).toBe('checks-failed');
      expect(read?.failedChecks).toEqual([]);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('asks nothing of GitHub for other activity', async () => {
      const { service, checkRuns } = hooks({
        installation: '158876513',
        events: [MERGED],
      });

      await service.activityIn(DELIVERY);

      expect(checkRuns.failedInSuite).not.toHaveBeenCalled();
    });
  });

  describe('receiving', () => {
    it('lets go of an installation GitHub removed, saying so', async () => {
      const { service, connections } = hooks({
        installation: '158876513',
        events: [{ kind: 'installation-removed' }],
      });

      await service.receive(DELIVERY);

      const [saved] = connections.save.mock.calls[0] as [GitHubConnection];
      expect(saved.installation).toBeNull();
      expect(saved.pullEvents().map((each) => each.kind)).toEqual([
        'workspace.disconnected',
      ]);
    });

    it('leaves purging the pull requests of a removed installation to the disconnection it says', async () => {
      const { service, sync } = hooks({
        installation: '158876513',
        events: [{ kind: 'installation-removed' }],
      });

      await service.receive(DELIVERY);

      expect(sync.uninstalled).not.toHaveBeenCalled();
    });

    it('records that a review was dismissed', async () => {
      const { service, sync } = hooks({
        installation: '42',
        events: [
          {
            kind: 'pull-request-review-dismissed',
            pullRequest: 'https://github.com/acme/api/pull/7',
            id: 900,
            snapshot: null,
          },
        ],
      });

      await service.receive(DELIVERY);

      expect(sync.reviewDismissed).toHaveBeenCalledWith(
        { installation: GitHubInstallation.of('42'), workspaceId: WORKSPACE },
        'https://github.com/acme/api/pull/7',
        null,
        900,
      );
    });

    it('saves nothing where no workspace connected that installation', async () => {
      const { service, connections } = hooks(
        {
          installation: '158876513',
          events: [{ kind: 'installation-removed' }],
        },
        { connected: false },
      );

      await service.receive(DELIVERY);

      expect(connections.save).not.toHaveBeenCalled();
    });

    it('records a review comment with what it says, for the pull request to say it was received', async () => {
      const { service, sync } = hooks({
        installation: '42',
        events: [
          {
            kind: 'review-comment',
            action: 'created',
            pullRequest: 'https://github.com/acme/api/pull/7',
            comment: COMMENT,
            snapshot: null,
          },
        ],
      });

      await service.receive(DELIVERY);

      const { id, inReplyToId, login, byBot, ...details } = COMMENT;
      expect(sync.commented).toHaveBeenCalledWith(
        { installation: GitHubInstallation.of('42'), workspaceId: WORKSPACE },
        'https://github.com/acme/api/pull/7',
        null,
        {
          id,
          on: 'line',
          action: 'created',
          login,
          inReplyToId,
          byBot,
          details,
        },
      );
    });

    it('records that a pull request closed, for the pull request to say so', async () => {
      const closedAt = new Date('2026-09-21T09:30:00Z');
      const { service, sync } = hooks({
        installation: '42',
        events: [
          {
            kind: 'pull-request-closed',
            pullRequest: 'https://github.com/acme/api/pull/7',
            repository: 'acme/api',
            gitHubId: 707,
            merge: { commit: 'c'.repeat(40) },
            closedAt,
          },
        ],
      });

      await service.receive(DELIVERY);

      expect(sync.closed).toHaveBeenCalledWith(
        { installation: GitHubInstallation.of('42'), workspaceId: WORKSPACE },
        'https://github.com/acme/api/pull/7',
        {
          repository: Repository.of('acme/api'),
          gitHubId: 707,
          merge: { commit: 'c'.repeat(40) },
          closedAt,
        },
      );
    });

    it('records that a pull request reopened, for the pull request to say so', async () => {
      const reopenedAt = new Date('2026-09-22T09:30:00Z');
      const { service, sync } = hooks({
        installation: '42',
        events: [
          {
            kind: 'pull-request-reopened',
            pullRequest: 'https://github.com/acme/api/pull/7',
            repository: 'acme/api',
            gitHubId: 707,
            reopenedAt,
          },
        ],
      });

      await service.receive(DELIVERY);

      expect(sync.reopened).toHaveBeenCalledWith(
        { installation: GitHubInstallation.of('42'), workspaceId: WORKSPACE },
        'https://github.com/acme/api/pull/7',
        { repository: Repository.of('acme/api'), gitHubId: 707, reopenedAt },
      );
    });

    it('records every pull request it receives, whether or not a task owns it', async () => {
      const snapshot = {
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
      const { service, sync } = hooks({
        installation: '42',
        events: [{ kind: 'pull-request', snapshot }],
      });

      await service.receive(DELIVERY);

      expect(sync.updateDetails).toHaveBeenCalledWith(
        { installation: GitHubInstallation.of('42'), workspaceId: WORKSPACE },
        snapshot,
      );
    });

    it('records a review on the pull request it belongs to', async () => {
      const submittedAt = new Date('2026-09-21T09:30:00Z');
      const { service, sync } = hooks({
        installation: '42',
        events: [
          {
            kind: 'pull-request-reviewed',
            pullRequest: 'https://github.com/acme/api/pull/7',
            id: 900,
            snapshot: null,
            state: 'approved',
            login: 'ada',
            byBot: false,
            submittedAt,
          },
        ],
      });

      await service.receive(DELIVERY);

      expect(sync.reviewed).toHaveBeenCalledWith(
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
      const { service, sync } = hooks({
        installation: '42',
        events: [
          {
            kind: 'review-comment',
            action: 'deleted',
            pullRequest: 'https://github.com/acme/api/pull/7',
            comment: COMMENT,
            snapshot: null,
          },
        ],
      });

      await service.receive(DELIVERY);

      expect(sync.commented).toHaveBeenCalledWith(
        { installation: GitHubInstallation.of('42'), workspaceId: WORKSPACE },
        'https://github.com/acme/api/pull/7',
        null,
        {
          id: 300,
          on: 'line',
          action: 'deleted',
          login: 'octocat',
          inReplyToId: 200,
          byBot: false,
          details: {
            url: COMMENT.url,
            path: COMMENT.path,
            subject: 'line',
            side: 'new',
            line: 12,
            startLine: 9,
            body: COMMENT.body,
            writtenAt: COMMENT.writtenAt,
          },
        },
      );
    });

    it('records a conversation comment on the pull request it was left on', async () => {
      const { service, sync } = hooks({
        installation: '42',
        events: [
          {
            kind: 'conversation-comment',
            action: 'created',
            pullRequest: 'https://github.com/acme/api/pull/7',
            comment: { id: 400, login: 'coderabbitai[bot]', byBot: true },
          },
        ],
      });

      await service.receive(DELIVERY);

      expect(sync.commented).toHaveBeenCalledWith(
        { installation: GitHubInstallation.of('42'), workspaceId: WORKSPACE },
        'https://github.com/acme/api/pull/7',
        null,
        {
          id: 400,
          on: 'conversation',
          action: 'created',
          login: 'coderabbitai[bot]',
          inReplyToId: null,
          byBot: true,
          details: null,
        },
      );
    });

    it('records a review thread resolved on the pull request it is on', async () => {
      const thread = PullRequestThread.of({
        id: 'PRRT_1',
        firstCommentId: 300,
        login: 'coderabbitai[bot]',
        byBot: true,
        resolved: true,
      });
      const { service, sync } = hooks({
        installation: '42',
        events: [
          {
            kind: 'review-thread',
            pullRequest: 'https://github.com/acme/api/pull/7',
            thread,
            snapshot: null,
          },
        ],
      });

      await service.receive(DELIVERY);

      expect(sync.threadResolved).toHaveBeenCalledWith(
        { installation: GitHubInstallation.of('42'), workspaceId: WORKSPACE },
        'https://github.com/acme/api/pull/7',
        null,
        thread,
      );
    });

    it('records nothing of a delivery through an installation that no workspace connected', async () => {
      const { service, sync } = hooks(
        {
          installation: '42',
          events: [CLOSED],
        },
        { connected: false },
      );

      await service.receive(DELIVERY);

      expect(sync.closed).not.toHaveBeenCalled();
    });

    it('records nothing where the delivery came through no installation', async () => {
      const { service, sync, connections } = hooks({
        installation: null,
        events: [CLOSED],
      });

      await service.receive(DELIVERY);

      expect(connections.connectedWorkspaceOf).not.toHaveBeenCalled();
      expect(sync.closed).not.toHaveBeenCalled();
    });

    it('leaves pull request activity to whoever reads it', async () => {
      const { service, connections, sync } = hooks({
        installation: '42',
        events: [MERGED],
      });

      await service.receive(DELIVERY);

      expect(connections.connectedWorkspaceOf).not.toHaveBeenCalled();
      expect(sync.closed).not.toHaveBeenCalled();
    });

    it('fails the delivery when attending goes wrong, so it is tried again', async () => {
      const { service, sync, logger } = hooks(
        {
          installation: '42',
          events: [CLOSED],
        },
        {
          closed: async () => {
            throw new Error('the outbox is down');
          },
        },
      );

      await expect(service.receive(DELIVERY)).rejects.toThrow(
        'the outbox is down',
      );
      expect(sync.closed).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });

    it('attends to everything a delivery said before failing it for what went wrong', async () => {
      const snapshot = {
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
      const { service, sync } = hooks({
        installation: '42',
        events: [
          { kind: 'pull-request', snapshot },
          { kind: 'pull-request', snapshot: { ...snapshot, number: 9 } },
        ],
      });
      sync.updateDetails.mockRejectedValueOnce(new Error('Database went away'));

      await expect(service.receive(DELIVERY)).rejects.toThrow(
        'Database went away',
      );
      expect(sync.updateDetails).toHaveBeenCalledTimes(2);
    });
  });
});
