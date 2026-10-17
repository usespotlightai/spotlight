import {
  SECRET,
  type Secret,
} from '@shared-kernel/domain/value-objects/secret';
import { InvalidNetworkCallError } from '@work/domain/exceptions/invalid-network-call.error';

const METHOD = /^[A-Z]{1,16}$/;

const MAX_TIMEOUT_MS = 60_000;

const MAX_BODY_BYTES = 1024 * 1024;

const sameHeaders = (
  one: Readonly<Record<string, string>>,
  other: Readonly<Record<string, string>>,
): boolean => {
  const names = Object.keys(one);

  return (
    names.length === Object.keys(other).length &&
    names.every((name) => one[name] === other[name])
  );
};

const sameBytes = (one: Uint8Array, other: Uint8Array): boolean =>
  one.byteLength === other.byteLength &&
  one.every((byte, at) => byte === other[at]);

export class NetworkRequest implements Secret {
  private constructor(
    readonly method: string,
    readonly url: string,
    private readonly signed: Readonly<Record<string, string>>,
    private readonly bytes: Uint8Array,
    readonly timeoutMs: number,
  ) {}

  get [SECRET](): true {
    return true;
  }

  get headers(): Readonly<Record<string, string>> {
    return { ...this.signed };
  }

  get body(): Uint8Array {
    return this.bytes.slice();
  }

  static of(input: {
    method: string;
    url: string;
    headers: Readonly<Record<string, string>>;
    body: Uint8Array;
    timeoutMs: number;
  }): NetworkRequest {
    const method = input.method.trim().toUpperCase();

    if (!METHOD.test(method)) {
      throw new InvalidNetworkCallError(`cannot be sent with ${input.method}`);
    }

    if (!isHttpUrl(input.url)) {
      throw new InvalidNetworkCallError('must go to an http or https address');
    }

    if (
      !Number.isInteger(input.timeoutMs) ||
      input.timeoutMs < 1 ||
      input.timeoutMs > MAX_TIMEOUT_MS
    ) {
      throw new InvalidNetworkCallError(
        `timeout must be 1 to ${MAX_TIMEOUT_MS} milliseconds`,
      );
    }

    if (input.body.byteLength > MAX_BODY_BYTES) {
      throw new InvalidNetworkCallError(
        `body can be at most ${MAX_BODY_BYTES} bytes`,
      );
    }

    return new NetworkRequest(
      method,
      input.url,
      Object.freeze({ ...input.headers }),
      input.body.slice(),
      input.timeoutMs,
    );
  }

  get isSpent(): boolean {
    return Object.keys(this.signed).length === 0 && this.bytes.byteLength === 0;
  }

  spent(): NetworkRequest {
    return new NetworkRequest(
      this.method,
      this.url,
      {},
      new Uint8Array(),
      this.timeoutMs,
    );
  }

  equals(other: NetworkRequest): boolean {
    return (
      this.method === other.method &&
      this.url === other.url &&
      this.timeoutMs === other.timeoutMs &&
      sameHeaders(this.signed, other.signed) &&
      sameBytes(this.bytes, other.bytes)
    );
  }
}

const isHttpUrl = (url: string): boolean => {
  try {
    const { protocol } = new URL(url);

    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
};
