import type {
  Delivered,
  WebhookProviderPort,
} from '@integrations/application/ports/webhook-provider.port';
import { ProviderForDelivery } from '@integrations/application/services/provider-for-delivery.service';
import { WebhookProviders } from '@integrations/application/services/webhook-providers.service';
import { WebhookGuard } from '@integrations/presentation/http/guards/webhook.guard';
import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

const RAW = new Uint8Array([1, 2, 3]);

const provider = (verifies: (delivered: Delivered) => boolean) =>
  ({
    key: 'github',
    happenings: [],
    verifies: vi.fn(async (delivered: Delivered) => verifies(delivered)),
    delivery: () => 'delivery_1',
    routes: async () => null,
    read: async () => [],
  }) satisfies WebhookProviderPort;

const guarding = (
  request: Record<string, unknown>,
  providers: WebhookProviderPort[],
  declared: WebhookProviderPort[] = [],
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
      new ProviderForDelivery(WebhookProviders.of(providers), {
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
  params: { integration: 'github' },
  headers: { 'x-hub-signature-256': 'sha256=whatever' },
  body: { action: 'closed' },
  rawBody: RAW,
  ...over,
});

describe('WebhookGuard', () => {
  it('lets through what the provider says its service signed', async () => {
    const github = provider(() => true);
    const { guard, context } = guarding(delivered(), [github]);

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('hands the provider the body as it arrived, byte for byte', async () => {
    const github = provider(() => true);
    const { guard, context } = guarding(delivered(), [github]);

    await guard.canActivate(context);

    expect(github.verifies).toHaveBeenCalledWith({
      headers: { 'x-hub-signature-256': 'sha256=whatever' },
      body: { action: 'closed' },
      raw: RAW,
    });
  });

  it('turns away what the provider will not vouch for', async () => {
    const { guard, context } = guarding(delivered(), [provider(() => false)]);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('turns away a provider nobody registered, the same way', async () => {
    const { guard, context } = guarding(
      delivered({ params: { integration: 'sentry' } }),
      [provider(() => true)],
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('turns away a delivery it could not verify, telling only the log why', async () => {
    const github = provider(() => {
      throw new Error(
        'Secret GITHUB_SECRET not found. Please create it first.',
      );
    });
    const { guard, context, logger } = guarding(delivered(), [github]);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(logger.warn).toHaveBeenCalledWith(
      {
        integration: 'github',
        error: 'Secret GITHUB_SECRET not found. Please create it first.',
      },
      'A webhook delivery could not be verified',
    );
  });

  it('turns away a delivery whose body was never stored', async () => {
    const github = provider((each) => each.raw !== null);
    const { guard, context } = guarding(delivered({ rawBody: undefined }), [
      github,
    ]);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
