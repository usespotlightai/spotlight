import type {
  Delivered,
  WebhookSourcePort,
} from '@application/ports/webhook-source.port';
import { WebhookSources } from '@application/services/webhook-sources.service';
import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { WebhookGuard } from '@presentation/http/guards/webhook.guard';
import { describe, expect, it, vi } from 'vitest';

const RAW = new Uint8Array([1, 2, 3]);

const source = (verifies: (delivered: Delivered) => boolean) =>
  ({
    key: 'github',
    happenings: [],
    verifies: vi.fn(verifies),
    delivery: () => 'delivery_1',
    routes: async () => null,
    read: () => [],
  }) satisfies WebhookSourcePort;

const asking = (
  request: Record<string, unknown>,
  sources: WebhookSourcePort[],
) => {
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  return {
    guard: new WebhookGuard(new WebhookSources(sources)),
    context,
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
  it('lets through what the source says its host signed', () => {
    const github = source(() => true);
    const { guard, context } = asking(delivered(), [github]);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('hands the source the body as it arrived, byte for byte', () => {
    const github = source(() => true);
    const { guard, context } = asking(delivered(), [github]);

    guard.canActivate(context);

    expect(github.verifies).toHaveBeenCalledWith({
      headers: { 'x-hub-signature-256': 'sha256=whatever' },
      body: { action: 'closed' },
      raw: RAW,
    });
  });

  it('turns away what the source will not vouch for', () => {
    const { guard, context } = asking(delivered(), [source(() => false)]);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  // Told apart from a bad signature nowhere the caller can see, so posting at
  // the door says nothing about what is behind it.
  it('turns away a source nobody registered, the same way', () => {
    const { guard, context } = asking(
      delivered({ params: { source: 'sentry' } }),
      [source(() => true)],
    );

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('turns away a delivery whose body was never kept', () => {
    const github = source((each) => each.raw !== null);
    const { guard, context } = asking(delivered({ rawBody: undefined }), [
      github,
    ]);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
