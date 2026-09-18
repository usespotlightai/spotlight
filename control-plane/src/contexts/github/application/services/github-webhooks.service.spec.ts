import type {
  Heard,
  TranslatedDelivery,
} from '@github/application/ports/webhook-translation.port';
import { GitHubWebhooks } from '@github/application/services/github-webhooks.service';
import { GitHubConnection } from '@github/domain/aggregates/github-connection.aggregate';
import { DefaultBranchPushed } from '@github/domain/events/default-branch-pushed.event';
import { ReviewCommentReceived } from '@github/domain/events/review-comment-received.event';
import type { GitHubConnectionRepository } from '@github/domain/repositories/github-connection.repository';
import { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const INSTALLED = GitHubInstallation.of('158876513');

const DELIVERY = { headers: {}, body: {}, raw: Buffer.from('{}') };

const COMMENT = {
  id: 300,
  url: 'https://github.com/acme/api/pull/7#discussion_r300',
  path: 'src/a.ts',
  side: 'new' as const,
  line: 12,
  startLine: 9,
  body: 'Why not a constant?',
  answers: 200,
  login: 'octocat',
  writtenAt: new Date('2026-09-16T09:00:00Z'),
};

const MERGED: Heard = {
  kind: 'pull-request-activity',
  activity: {
    activity: 'merged',
    branch: 'spotlight/task_1',
    pullRequest: 'https://github.com/acme/api/pull/7',
    about: null,
    remark: null,
    byBot: false,
  },
};

const hooks = (
  translated: TranslatedDelivery,
  over: {
    held?: boolean;
    signs?: boolean;
    dispatch?: () => Promise<void>;
  } = {},
) => {
  const held = over.held ?? true;
  const connections = {
    claimantOf: vi.fn(async () => (held ? WORKSPACE : null)),
    of: vi.fn(async (id: WorkspaceId) =>
      held
        ? GitHubConnection.rehydrate({
            workspaceId: id,
            installation: INSTALLED,
            version: 1,
          })
        : GitHubConnection.none(id),
    ),
    save: vi.fn(async (_: GitHubConnection) => {}),
  } satisfies GitHubConnectionRepository;
  const events = {
    dispatch: vi.fn(over.dispatch ?? (async (_: readonly DomainEvent[]) => {})),
  };
  const signature = { signs: vi.fn(() => over.signs ?? true) };
  const logger = { error: vi.fn() } as unknown as LoggerPort;

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
      logger,
    ),
    connections,
    events,
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

    it('refuses a delivery without its bytes, or with a bad signature', () => {
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

    it('saves nothing where nobody held that installation', async () => {
      const { service, connections } = hooks(
        {
          installation: '158876513',
          heard: [{ kind: 'installation-removed' }],
        },
        { held: false },
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

    it('says the default branch was pushed in the workspace', async () => {
      const { service, events } = hooks({
        installation: '42',
        heard: [
          {
            kind: 'default-branch-pushed',
            repository: 'acme/api',
            paths: ['.spotlight/config.yml'],
          },
        ],
      });

      await service.receive(DELIVERY);

      expect(events.dispatch).toHaveBeenCalledWith([
        new DefaultBranchPushed(WORKSPACE, 'acme/api', [
          '.spotlight/config.yml',
        ]),
      ]);
    });

    it('says nothing of a delivery through an installation nobody claimed', async () => {
      const { service, events } = hooks(
        {
          installation: '42',
          heard: [
            {
              kind: 'default-branch-pushed',
              repository: 'acme/api',
              paths: ['.spotlight/config.yml'],
            },
          ],
        },
        { held: false },
      );

      await service.receive(DELIVERY);

      expect(events.dispatch).not.toHaveBeenCalled();
    });

    it('says nothing where the delivery came through no installation', async () => {
      const { service, events, connections } = hooks({
        installation: null,
        heard: [
          {
            kind: 'default-branch-pushed',
            repository: 'acme/api',
            paths: ['.spotlight/config.yml'],
          },
        ],
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

    it('does not fail the delivery when attending goes wrong', async () => {
      const { service, events, logger } = hooks(
        {
          installation: '42',
          heard: [
            {
              kind: 'default-branch-pushed',
              repository: 'acme/api',
              paths: ['.spotlight/config.yml'],
            },
          ],
        },
        {
          dispatch: async () => {
            throw new Error('the outbox is down');
          },
        },
      );

      await expect(service.receive(DELIVERY)).resolves.toBeUndefined();
      expect(events.dispatch).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
