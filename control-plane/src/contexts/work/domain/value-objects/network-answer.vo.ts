import { InvalidNetworkCallError } from '@work/domain/exceptions/invalid-network-call.error';

const MOST_BODY_BYTES = 16 * 1024;

const MOST_ERROR = 1_000;

export class NetworkAnswer {
  private constructor(
    readonly status: number,
    readonly headers: Readonly<Record<string, string>>,
    readonly body: Uint8Array,
    readonly ms: number,
    readonly error: string | null,
  ) {}

  static of(input: {
    status: number;
    headers?: Readonly<Record<string, string>>;
    body?: Uint8Array;
    ms: number;
    error?: string | null;
  }): NetworkAnswer {
    if (
      !Number.isInteger(input.status) ||
      input.status < 0 ||
      input.status > 599
    ) {
      throw new InvalidNetworkCallError(
        `is answered with an HTTP status, or 0 when nothing answered, not ${input.status}`,
      );
    }

    if (!Number.isInteger(input.ms) || input.ms < 0) {
      throw new InvalidNetworkCallError(
        `is answered in a whole number of milliseconds, not ${input.ms}`,
      );
    }

    const error = input.error?.trim().slice(0, MOST_ERROR) || null;

    if (input.status === 0 && !error) {
      throw new InvalidNetworkCallError(
        'that nothing answered says why nothing did',
      );
    }

    return new NetworkAnswer(
      input.status,
      { ...(input.headers ?? {}) },
      (input.body ?? new Uint8Array()).slice(0, MOST_BODY_BYTES),
      input.ms,
      error,
    );
  }
}
