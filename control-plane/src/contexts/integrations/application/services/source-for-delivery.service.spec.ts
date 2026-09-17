import type { ConfiguredSourcesPort } from '@integrations/application/ports/configured-sources.port';
import type { WebhookSourcePort } from '@integrations/application/ports/webhook-source.port';
import { SourceForDelivery } from '@integrations/application/services/source-for-delivery.service';
import { WebhookSources } from '@integrations/application/services/webhook-sources.service';
import { describe, expect, it, vi } from 'vitest';

const source = (key: string): WebhookSourcePort => ({
  key,
  happenings: [],
  verifies: async () => true,
  delivery: () => 'delivery_1',
  routes: async () => null,
  read: async () => [],
});

const asking = (
  registered: readonly string[],
  declared: readonly string[] = [],
) => {
  const find = vi.fn(async (_team: unknown, key: string) =>
    declared.includes(key) ? source(key) : null,
  );

  return {
    find,
    sources: new SourceForDelivery(
      WebhookSources.of(registered.map((each) => source(each))),
      {
        find,
        all: async () => declared.map((each) => source(each)),
      } as unknown as ConfiguredSourcesPort,
    ),
  };
};

describe('SourceForDelivery', () => {
  describe('at the shared door', () => {
    it('answers with the host Spotlight was written for', async () => {
      const { sources } = asking(['github']);

      expect(
        (
          await sources.find({
            workspaceId: '',
            teamId: '',
            teamKey: '',
            source: 'github',
          })
        )?.key,
      ).toBe('github');
    });

    it('answers with nothing for a host nobody registered', async () => {
      const { sources } = asking(['github']);

      expect(
        await sources.find({
          workspaceId: '',
          teamId: '',
          teamKey: '',
          source: 'sentry',
        }),
      ).toBeNull();
    });

    it('does not reach a team’s own hosts', async () => {
      const { sources, find } = asking(['github'], ['linear']);

      expect(
        await sources.find({
          workspaceId: '',
          teamId: '',
          teamKey: '',
          source: 'linear',
        }),
      ).toBeNull();
      expect(find).not.toHaveBeenCalled();
    });
  });

  describe('at a team’s own door', () => {
    it('answers with the host that team declared', async () => {
      const { sources } = asking(['github'], ['linear']);

      expect(
        (
          await sources.find({
            workspaceId: 'ws_1',
            teamId: 'team_1',
            teamKey: 'platform',
            source: 'linear',
          })
        )?.key,
      ).toBe('linear');
    });

    it('asks for it as that team’s, not as anybody’s', async () => {
      const { sources, find } = asking(['github'], ['linear']);

      await sources.find({
        workspaceId: 'ws_1',
        teamId: 'team_1',
        teamKey: 'platform',
        source: 'linear',
      });

      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({
          teamId: expect.objectContaining({ value: 'team_1' }),
        }),
        'linear',
      );
    });

    it('answers with nothing where that team declared no such host', async () => {
      const { sources } = asking(['github'], ['linear']);

      expect(
        await sources.find({
          workspaceId: 'ws_1',
          teamId: 'team_1',
          teamKey: 'platform',
          source: 'sentry',
        }),
      ).toBeNull();
    });

    it('refuses a file claiming the name of a host Spotlight has', async () => {
      const { sources, find } = asking(['github'], ['github']);

      expect(
        await sources.find({
          workspaceId: 'ws_1',
          teamId: 'team_1',
          teamKey: 'platform',
          source: 'github',
        }),
      ).toBeNull();
      expect(find).not.toHaveBeenCalled();
    });
  });
});
