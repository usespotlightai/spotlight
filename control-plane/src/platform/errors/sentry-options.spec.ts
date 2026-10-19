import { sentryOptions } from '@platform/errors/sentry-options';
import type { Breadcrumb, ErrorEvent, EventHint } from '@sentry/nestjs';
import { describe, expect, it } from 'vitest';

const options = sentryOptions({ SENTRY_DSN: 'https://key@sentry.invalid/1' });

describe('sentryOptions', () => {
  it('sends the route of a request, never a token in its path', () => {
    const event = options?.beforeSend?.(
      {
        type: undefined,
        request: {
          url: 'https://app.example/api/invites/Zx81kQ_secret/accept',
        },
        breadcrumbs: [
          {
            category: 'http',
            data: { url: 'https://hooks.slack.com/services/T0/B0/secret' },
          },
        ],
      } as ErrorEvent,
      {} as EventHint,
    ) as ErrorEvent;

    expect(event.request?.url).toBe(
      'https://app.example/api/invites/:id/accept',
    );
    expect(event.breadcrumbs?.[0]?.data?.url).toBe('https://hooks.slack.com');
    expect(JSON.stringify(event)).not.toContain('secret');
  });

  it('keeps only the origin of an outbound breadcrumb', () => {
    const breadcrumb = options?.beforeBreadcrumb?.({
      category: 'fetch',
      data: { url: 'https://api.github.com/repos/acme/app?access_token=x' },
    } as Breadcrumb) as Breadcrumb;

    expect(breadcrumb.data?.url).toBe('https://api.github.com');
  });
});
