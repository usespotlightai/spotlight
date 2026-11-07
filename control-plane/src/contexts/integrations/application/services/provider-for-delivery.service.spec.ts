import type { ConfiguredWebhookProvidersPort } from '@integrations/application/ports/configured-webhook-providers.port';
import type { WebhookProviderPort } from '@integrations/application/ports/webhook-provider.port';
import { ProviderForDelivery } from '@integrations/application/services/provider-for-delivery.service';
import { WebhookProviders } from '@integrations/application/services/webhook-providers.service';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const provider = (key: string): WebhookProviderPort => ({
  key,
  happenings: [],
  verifies: async () => true,
  delivery: () => 'delivery_1',
  routes: async () => null,
  read: async () => [],
});

const finding = (
  registered: readonly string[],
  declared: readonly string[] = [],
) => {
  const find = vi.fn(async (_team: unknown, key: string) =>
    declared.includes(key) ? provider(key) : null,
  );

  return {
    find,
    providers: new ProviderForDelivery(
      WebhookProviders.of(registered.map((each) => provider(each))),
      {
        find,
        all: async () => declared.map((each) => provider(each)),
      } as unknown as ConfiguredWebhookProvidersPort,
    ),
  };
};

describe('ProviderForDelivery', () => {
  describe('at the shared door', () => {
    it('answers with the built-in provider', async () => {
      const { providers } = finding(['github']);

      expect(
        (
          await providers.find({
            to: null,
            integration: IntegrationKey.of('github'),
          })
        )?.key,
      ).toBe('github');
    });

    it('answers with nothing for a provider nobody registered', async () => {
      const { providers } = finding(['github']);

      expect(
        await providers.find({
          to: null,
          integration: IntegrationKey.of('sentry'),
        }),
      ).toBeNull();
    });

    it('does not look up the providers of a team', async () => {
      const { providers, find } = finding(['github'], ['linear']);

      expect(
        await providers.find({
          to: null,
          integration: IntegrationKey.of('linear'),
        }),
      ).toBeNull();
      expect(find).not.toHaveBeenCalled();
    });
  });

  describe('at a team’s own door', () => {
    it('answers with the provider that team declared', async () => {
      const { providers } = finding(['github'], ['linear']);

      expect(
        (
          await providers.find({
            to: {
              workspaceId: WorkspaceId.of('ws_1'),
              teamId: TeamId.of('team_1'),
              teamKey: 'platform',
            },
            integration: IntegrationKey.of('linear'),
          })
        )?.key,
      ).toBe('linear');
    });

    it('looks it up as that team’s, not as anybody’s', async () => {
      const { providers, find } = finding(['github'], ['linear']);

      await providers.find({
        to: {
          workspaceId: WorkspaceId.of('ws_1'),
          teamId: TeamId.of('team_1'),
          teamKey: 'platform',
        },
        integration: IntegrationKey.of('linear'),
      });

      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({
          teamId: expect.objectContaining({ value: 'team_1' }),
        }),
        'linear',
      );
    });

    it('answers with nothing where that team declared no such provider', async () => {
      const { providers } = finding(['github'], ['linear']);

      expect(
        await providers.find({
          to: {
            workspaceId: WorkspaceId.of('ws_1'),
            teamId: TeamId.of('team_1'),
            teamKey: 'platform',
          },
          integration: IntegrationKey.of('sentry'),
        }),
      ).toBeNull();
    });

    it('rejects a file claiming the name of a built-in provider', async () => {
      const { providers, find } = finding(['github'], ['github']);

      expect(
        await providers.find({
          to: {
            workspaceId: WorkspaceId.of('ws_1'),
            teamId: TeamId.of('team_1'),
            teamKey: 'platform',
          },
          integration: IntegrationKey.of('github'),
        }),
      ).toBeNull();
      expect(find).not.toHaveBeenCalled();
    });
  });
});
