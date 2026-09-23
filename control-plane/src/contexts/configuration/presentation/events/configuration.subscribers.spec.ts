import type { IntegrationLinksPort } from '@configuration/application/ports/integration-links.port';
import { configurationSubscribers } from '@configuration/presentation/events/configuration.subscribers';
import type { HostConnectedIntegrationEvent } from '@shared-kernel/application/integration-events/host-connected.integration-event';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it, vi } from 'vitest';

describe('configuration hearing a host connect', () => {
  const connected = (handle: string | null): HostConnectedIntegrationEvent => ({
    kind: 'integrations.host-connected.v1',
    teamId: 'acme',
    source: 'linear',
    handle,
  });

  const tracking = () => {
    const linked = vi.fn(async () => {});
    const subscriber = configurationSubscribers({
      linked,
    } as unknown as IntegrationLinksPort).find(
      (each) => each.name === 'configuration.track-integration-link',
    );

    if (!subscriber) {
      throw new Error('nobody tracks a link');
    }

    return { subscriber, linked };
  };

  it('keeps the link a team now holds', async () => {
    const { subscriber, linked } = tracking();

    await subscriber.handle(connected('acme-eng'));

    expect(linked).toHaveBeenCalledWith(TeamId.of('acme'), {
      source: 'linear',
      handle: 'acme-eng',
    });
  });

  it('keeps a link that came without a handle', async () => {
    const { subscriber, linked } = tracking();

    await subscriber.handle(connected(null));

    expect(linked).toHaveBeenCalledWith(TeamId.of('acme'), {
      source: 'linear',
      handle: null,
    });
  });
});
