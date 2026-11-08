export const WEB_PUSH = Symbol('WEB_PUSH');

export interface WebPushTarget {
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
}

export type WebPushOutcome = 'delivered' | 'gone' | 'refused';

export interface WebPushPort {
  readonly publicKey: string | null;

  send(target: WebPushTarget, payload: string): Promise<WebPushOutcome>;
}
