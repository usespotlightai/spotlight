import { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import {
  scrubbedRequestSpan,
  withoutOutboundPath,
  withRoutePath,
} from '@platform/telemetry/span-urls';
import { describe, expect, it } from 'vitest';

const spanWith = (attributes: Record<string, unknown>) => ({ attributes });

describe('span URLs', () => {
  it('keeps only the origin of a call that Spotlight makes', () => {
    const span = spanWith({
      'url.full':
        'https://hooks.slack.com/services/T000/B000/secret?token=secret',
      'url.path': '/services/T000/B000/secret',
      'url.query': '?token=secret',
      'server.address': 'hooks.slack.com',
    });

    withoutOutboundPath(span);

    expect(span.attributes).toEqual({
      'url.full': 'https://hooks.slack.com',
      'server.address': 'hooks.slack.com',
    });
  });

  it('removes the path and query of a request to Spotlight until its route is known', () => {
    const span = spanWith({
      'url.path': '/api/invites/secret',
      'url.query': 'a=b',
      'url.scheme': 'https',
    });

    scrubbedRequestSpan(span, new IncomingMessage(new Socket()));

    expect(span.attributes).toEqual({ 'url.scheme': 'https' });
  });

  it('names the route in place of the path, so tokens in a path stay out', () => {
    const routed = spanWith({ 'url.path': '/api/invites/secret-invite-token' });
    const unrouted = spanWith({ 'url.path': '/api/nowhere/secret' });

    withRoutePath(routed, '/api/invites/:token');
    withRoutePath(unrouted, undefined);

    expect(routed.attributes).toEqual({ 'url.path': '/api/invites/:token' });
    expect(unrouted.attributes).toEqual({});
  });
});
