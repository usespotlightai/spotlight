import { API_PREFIX, TEAM_DELIVERIES, WEBHOOKS } from '@platform/http/routes';
import type { DeliveryAddressesPort } from '@work/application/ports/delivery-addresses.port';

export class WebhookDeliveryAddresses implements DeliveryAddressesPort {
  private readonly base: string;

  constructor(base: string) {
    this.base = base.replace(/\/+$/, '');
  }

  of(slug: string, teamKey: string, source: string): string {
    const path = TEAM_DELIVERIES.replace(':slug', slug)
      .replace(':teamKey', teamKey)
      .replace(':source', source);

    return `${this.base}/${API_PREFIX}/${WEBHOOKS}/${path}`;
  }
}
