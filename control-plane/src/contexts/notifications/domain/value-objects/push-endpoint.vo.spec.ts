import { InvalidPushEndpointError } from '@notifications/domain/exceptions/invalid-push-endpoint.error';
import { PushEndpoint } from '@notifications/domain/value-objects/push-endpoint.vo';
import { describe, expect, it } from 'vitest';

describe('PushEndpoint', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/QGdk',
    'https://db5p.notify.windows.com/w/?token=abc',
  ])('accepts the push service address %s', (url) => {
    expect(PushEndpoint.of(url).url).toBe(url);
  });

  it.each([
    'http://fcm.googleapis.com/fcm/send/abc',
    'https://example.com/push',
    'https://fcm.googleapis.com:8443/fcm/send/abc',
    'https://user:secret@fcm.googleapis.com/fcm/send/abc',
    'https://notify.windows.com.example.com/w',
    'https://169.254.169.254/latest',
    'not a url',
    '',
  ])('refuses %s', (url) => {
    expect(() => PushEndpoint.of(url)).toThrow(InvalidPushEndpointError);
  });

  it('rehydrates a stored address at a push service no longer used, and says it is not served', () => {
    const stored = PushEndpoint.rehydrate('https://push.retired.example/abc');

    expect(stored.url).toBe('https://push.retired.example/abc');
    expect(stored.isServed).toBe(false);
    expect(
      PushEndpoint.rehydrate('https://fcm.googleapis.com/fcm/send/abc')
        .isServed,
    ).toBe(true);
  });
});
