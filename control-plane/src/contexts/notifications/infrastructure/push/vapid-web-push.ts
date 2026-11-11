import type {
  WebPushOutcome,
  WebPushPort,
  WebPushTarget,
} from '@notifications/application/ports/web-push.port';
import { PUSH_SERVICE_HOSTS } from '@notifications/domain/value-objects/push-endpoint.vo';
import { OutboundGuard } from '@platform/outbound/outbound-guard';
import { HostAllowList } from '@shared-kernel/domain/value-objects/host-allow-list.vo';
import { generateRequestDetails } from 'web-push';

const TTL_SECONDS = 24 * 60 * 60;
const GONE = new Set([404, 410]);
const TRANSIENT = new Set([408, 425, 429]);

export const pushServiceGuard = (): OutboundGuard =>
  new OutboundGuard(HostAllowList.of(PUSH_SERVICE_HOSTS));

export interface VapidDetails {
  readonly subject: string;
  readonly publicKey: string;
  readonly privateKey: string;
}

class WebPushRefusedError extends Error {
  constructor(readonly status: number) {
    super(`The push service answered ${status}`);
    this.name = 'WebPushRefusedError';
  }
}

export class VapidWebPush implements WebPushPort {
  constructor(
    private readonly vapid: VapidDetails | null,
    private readonly guard: OutboundGuard,
  ) {}

  get publicKey(): string | null {
    return this.vapid?.publicKey ?? null;
  }

  async send(target: WebPushTarget, payload: string): Promise<WebPushOutcome> {
    if (!this.vapid) {
      return 'delivered';
    }

    const request = generateRequestDetails(
      {
        endpoint: target.endpoint,
        keys: { p256dh: target.p256dh, auth: target.auth },
      },
      payload,
      {
        vapidDetails: this.vapid,
        TTL: TTL_SECONDS,
        urgency: 'normal',
        contentEncoding: 'aes128gcm',
      },
    );

    const response = await this.guard.fetch(request.endpoint, {
      method: request.method,
      headers: request.headers as Record<string, string>,
      body: request.body ? new Uint8Array(request.body) : undefined,
      redirect: 'error',
    });

    await response.body?.cancel();

    if (GONE.has(response.status)) {
      return 'gone';
    }

    if (TRANSIENT.has(response.status) || response.status >= 500) {
      throw new WebPushRefusedError(response.status);
    }

    if (!response.ok) {
      return 'refused';
    }

    return 'delivered';
  }
}
