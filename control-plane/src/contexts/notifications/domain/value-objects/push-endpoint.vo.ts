import { InvalidPushEndpointError } from '@notifications/domain/exceptions/invalid-push-endpoint.error';

const MAX_LENGTH = 2048;

export const PUSH_SERVICE_HOSTS: readonly string[] = [
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
  '*.push.apple.com',
  '*.notify.windows.com',
];

const served = (host: string): boolean =>
  PUSH_SERVICE_HOSTS.some((each) =>
    each.startsWith('*.') ? host.endsWith(each.slice(1)) : host === each,
  );

export class PushEndpoint {
  private constructor(readonly url: string) {}

  static of(value: string): PushEndpoint {
    if (value.length === 0 || value.length > MAX_LENGTH) {
      throw new InvalidPushEndpointError();
    }

    let parsed: URL;

    try {
      parsed = new URL(value);
    } catch {
      throw new InvalidPushEndpointError();
    }

    if (
      parsed.protocol !== 'https:' ||
      parsed.username !== '' ||
      parsed.password !== '' ||
      parsed.port !== '' ||
      !served(parsed.hostname.toLowerCase())
    ) {
      throw new InvalidPushEndpointError();
    }

    return new PushEndpoint(parsed.toString());
  }

  static rehydrate(url: string): PushEndpoint {
    return new PushEndpoint(url);
  }

  get isServed(): boolean {
    try {
      return served(new URL(this.url).hostname.toLowerCase());
    } catch {
      return false;
    }
  }

  equals(other: PushEndpoint): boolean {
    return this.url === other.url;
  }
}
