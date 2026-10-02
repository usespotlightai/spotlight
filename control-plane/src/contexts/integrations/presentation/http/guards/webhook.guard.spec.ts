import type {
  Delivered,
  WebhookSourcePort,
} from '@integrations/application/ports/webhook-source.port';
import { SourceForDelivery } from '@integrations/application/services/source-for-delivery.service';
import { WebhookSources } from '@integrations/application/services/webhook-sources.service';
import { WebhookGuard } from '@integrations/presentation/http/guards/webhook.guard';
import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

const RAW = new Uint8Array([1, 2, 3]);

const source = (verifies: (delivered: Delivered) => boolean) =>
  ({
    key: 'github',
    happenings: [],
    verifies: vi.fn(async (delivered: Delivered) => verifies(delivered)),
    delivery: () => 'delivery_1',
    routes: async () => null,
    read: async () => [],
  }) satisfies WebhookSourcePort;

const asking = (
  request: Record<string, unknown>,
  sources: WebhookSourcePort[],
  declared: WebhookSourcePort[] = [],
) => {
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const logger = {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  return {
    guard: new WebhookGuard(
      new SourceForDelivery(WebhookSources.of(sources), {
        find: async (_team, key) =>
          declared.find((each) => each.key === key) ?? null,
        all: async () => declared,
      }),
      {
        identify: async () => 'ws_1',
        slugOf: async () => 'acme',
        profileOf: async () => null,
        isOpen: async () => true,
        identifyTeam: async (_slug: string, teamKey: string) =>
          teamKey === 'platform'
            ? { workspaceId: 'ws_1', teamId: 'team_1' }
            : null,
        findTeamForMember: async () => ({
          workspaceId: 'ws_1',
          teamId: 'team_1',
          teamKey: 'platform',
          slug: 'acme',
        }),
        listForMember: async () => [],
        findForMember: async () => null,
      },
      logger,
    ),
    context,
    logger,
  };
};

const delivered = (over: Record<string, unknown> = {}) => ({
  params: { source: 'github' },
  headers: { 'x-hub-signature-256': 'sha256=whatever' },
  body: { action: 'closed' },
  rawBody: RAW,
  ...over,
});

describe('WebhookGuard', () => {
  it('lets through what the source says its host signed', async () => {
    const github = source(() => true);
    const { guard, context } = asking(delivered(), [github]);

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('hands the source the body as it arrived, byte for byte', async () => {
    const github = source(() => true);
    const { guard, context } = asking(delivered(), [github]);

    await guard.canActivate(context);

    expect(github.verifies).toHaveBeenCalledWith({
      headers: { 'x-hub-signature-256': 'sha256=whatever' },
      body: { action: 'closed' },
      raw: RAW,
    });
  });

  it('turns away what the source will not vouch for', async () => {
    const { guard, context } = asking(delivered(), [source(() => false)]);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('turns away a source nobody registered, the same way', async () => {
    const { guard, context } = asking(
      delivered({ params: { source: 'sentry' } }),
      [source(() => true)],
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('turns away a delivery it could not verify, telling only the log why', async () => {
    const github = source(() => {
      throw new Error('The workspace holds no secret named GITHUB_SECRET');
    });
    const { guard, context, logger } = asking(delivered(), [github]);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(logger.warn).toHaveBeenCalledWith(
      {
        source: 'github',
        error: 'The workspace holds no secret named GITHUB_SECRET',
      },
      'A webhook delivery could not be verified',
    );
  });

  it('turns away a delivery whose body was never kept', async () => {
    const github = source((each) => each.raw !== null);
    const { guard, context } = asking(delivered({ rawBody: undefined }), [
      github,
    ]);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
