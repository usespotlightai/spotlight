import { InvalidNetworkCallError } from '@work/domain/exceptions/invalid-network-call.error';

const MAX_BODY_BYTES = 16 * 1024;

const MAX_ERROR = 1_000;

export class NetworkResponse {
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
  }): NetworkResponse {
    if (
      !Number.isInteger(input.status) ||
      input.status < 0 ||
      input.status > 599
    ) {
      throw new InvalidNetworkCallError(
        `status must be an HTTP status, or 0 for no response, not ${input.status}`,
      );
    }

    if (!Number.isInteger(input.ms) || input.ms < 0) {
      throw new InvalidNetworkCallError(
        `duration must be a whole number of milliseconds, not ${input.ms}`,
      );
    }

    const error = input.error?.trim().slice(0, MAX_ERROR) || null;

    if (input.status === 0 && !error) {
      throw new InvalidNetworkCallError('with no response must say why');
    }

    return new NetworkResponse(
      input.status,
      { ...(input.headers ?? {}) },
      (input.body ?? new Uint8Array()).slice(0, MAX_BODY_BYTES),
      input.ms,
      error,
    );
  }
}
