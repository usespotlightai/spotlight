import { InvalidPushKeysError } from '@notifications/domain/exceptions/invalid-push-keys.error';

const P256DH = /^[A-Za-z0-9_-]{86,88}={0,2}$/;
const AUTH = /^[A-Za-z0-9_-]{21,24}={0,2}$/;

export class PushKeys {
  private constructor(
    readonly p256dh: string,
    readonly auth: string,
  ) {}

  static of(input: { p256dh: string; auth: string }): PushKeys {
    if (!P256DH.test(input.p256dh) || !AUTH.test(input.auth)) {
      throw new InvalidPushKeysError();
    }

    return new PushKeys(input.p256dh, input.auth);
  }

  equals(other: PushKeys): boolean {
    return this.p256dh === other.p256dh && this.auth === other.auth;
  }
}
