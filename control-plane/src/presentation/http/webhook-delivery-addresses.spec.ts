import { WebhookDeliveryAddresses } from '@presentation/http/webhook-delivery-addresses';
import { describe, expect, it } from 'vitest';

describe('WebhookDeliveryAddresses', () => {
  it('addresses a team’s host at the public webhook host', () => {
    expect(
      new WebhookDeliveryAddresses('https://hooks.example.com/').of(
        'acme',
        'platform',
        'linear',
      ),
    ).toBe('https://hooks.example.com/api/webhooks/w/acme/t/platform/linear');
  });
});
