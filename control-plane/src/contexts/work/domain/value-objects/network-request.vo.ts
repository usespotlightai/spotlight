import { InvalidNetworkCallError } from '@work/domain/exceptions/invalid-network-call.error';

const METHOD = /^[A-Z]{1,16}$/;

const MOST_TIMEOUT_MS = 60_000;

const MOST_BODY_BYTES = 1024 * 1024;

export class NetworkRequest {
  private constructor(
    readonly method: string,
    readonly url: string,
    readonly headers: Readonly<Record<string, string>>,
    readonly body: Uint8Array,
    readonly timeoutMs: number,
  ) {}

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

    if (!reachable(input.url)) {
      throw new InvalidNetworkCallError('is sent to an http or https address');
    }

    if (
      !Number.isInteger(input.timeoutMs) ||
      input.timeoutMs < 1 ||
      input.timeoutMs > MOST_TIMEOUT_MS
    ) {
      throw new InvalidNetworkCallError(
        `waits between 1 and ${MOST_TIMEOUT_MS} milliseconds for its answer`,
      );
    }

    if (input.body.byteLength > MOST_BODY_BYTES) {
      throw new InvalidNetworkCallError(
        `carries at most ${MOST_BODY_BYTES} bytes`,
      );
    }

    return new NetworkRequest(
      method,
      input.url,
      { ...input.headers },
      input.body,
      input.timeoutMs,
    );
  }

  get isSpent(): boolean {
    return Object.keys(this.headers).length === 0 && this.body.byteLength === 0;
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
}

const reachable = (url: string): boolean => {
  try {
    const { protocol } = new URL(url);

    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
};
