import { InvalidRunConnectionError } from '@work/domain/exceptions/invalid-run-connection.error';

export const CONNECTION_OUTCOMES = [
  'passthrough',
  'injected',
  'blocked',
  'failed',
] as const;

export type ConnectionOutcome = (typeof CONNECTION_OUTCOMES)[number];

export const CONNECTION_REASONS = [
  'not-allowed',
  'address-refused',
  'not-bound',
  'no-such-host',
  'timed-out',
  'tls-failed',
  'unreachable',
] as const;

export type ConnectionReason = (typeof CONNECTION_REASONS)[number];

export const STOPPED_OUTCOMES = ['blocked', 'failed'] as const;

export const AUTH_FAILED_STATUSES = [401, 403] as const;

export const SERVER_ERROR = 500;

export const CONNECTION_ERRORS = [
  ...STOPPED_OUTCOMES,
  'auth-failed',
  'server-error',
] as const;

export type ConnectionError = (typeof CONNECTION_ERRORS)[number];

const REASONS_OF: Record<ConnectionOutcome, readonly ConnectionReason[]> = {
  passthrough: [],
  injected: [],
  blocked: ['not-allowed', 'address-refused', 'not-bound'],
  failed: ['no-such-host', 'timed-out', 'tls-failed', 'unreachable'],
};

const LONGEST_HOST = 253;

const EARLIEST_BEFORE_MS = 60 * 60_000;

const LATEST_AFTER_MS = 60_000;

const HOST = /^[a-z0-9.:[\]-]+$/;

interface Parts {
  readonly host: string;
  readonly port: number;
  readonly bytesOut: number;
  readonly bytesIn: number;
  readonly ms: number;
  readonly outcome: string;
  readonly status: number | null;
  readonly reason: string | null;
  readonly at: Date;
}

const isStopped = (
  outcome: ConnectionOutcome,
): outcome is (typeof STOPPED_OUTCOMES)[number] =>
  (STOPPED_OUTCOMES as readonly string[]).includes(outcome);

const counted = (field: string, value: number): number => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new InvalidRunConnectionError(
      field,
      'must be a whole number, 0 or more',
    );
  }

  return value;
};

export class RunConnection {
  private constructor(
    readonly host: string,
    readonly port: number,
    readonly bytesOut: number,
    readonly bytesIn: number,
    readonly ms: number,
    readonly outcome: ConnectionOutcome,
    readonly status: number | null,
    readonly reason: ConnectionReason | null,
    readonly at: Date,
  ) {}

  get error(): ConnectionError | null {
    if (isStopped(this.outcome)) {
      return this.outcome;
    }

    if (this.status === null) {
      return null;
    }

    if ((AUTH_FAILED_STATUSES as readonly number[]).includes(this.status)) {
      return 'auth-failed';
    }

    return this.status >= SERVER_ERROR ? 'server-error' : null;
  }

  get isError(): boolean {
    return this.error !== null;
  }

  static record(parts: Parts, now: Date): RunConnection {
    const told = parts.at.getTime();
    const near =
      told >= now.getTime() - EARLIEST_BEFORE_MS &&
      told <= now.getTime() + LATEST_AFTER_MS;

    return RunConnection.of({ ...parts, at: near ? parts.at : now });
  }

  static of(parts: Parts): RunConnection {
    const host = parts.host.trim().toLowerCase();

    if (host.length === 0 || host.length > LONGEST_HOST || !HOST.test(host)) {
      throw new InvalidRunConnectionError(
        'host',
        `must be a host name or an address, at most ${LONGEST_HOST} characters`,
      );
    }

    if (
      !Number.isInteger(parts.port) ||
      parts.port < 1 ||
      parts.port > 65_535
    ) {
      throw new InvalidRunConnectionError('port', 'must be from 1 to 65535');
    }

    if (!CONNECTION_OUTCOMES.includes(parts.outcome as ConnectionOutcome)) {
      throw new InvalidRunConnectionError(
        'outcome',
        `must be one of ${CONNECTION_OUTCOMES.join(', ')}`,
      );
    }

    if (
      parts.status !== null &&
      (!Number.isInteger(parts.status) ||
        parts.status < 100 ||
        parts.status > 599)
    ) {
      throw new InvalidRunConnectionError('status', 'must be from 100 to 599');
    }

    const outcome = parts.outcome as ConnectionOutcome;

    if (parts.status !== null && outcome !== 'injected') {
      throw new InvalidRunConnectionError(
        'status',
        'can be given only for an injected request',
      );
    }

    if (
      parts.reason !== null &&
      !(REASONS_OF[outcome] as readonly string[]).includes(parts.reason)
    ) {
      throw new InvalidRunConnectionError(
        'reason',
        REASONS_OF[outcome].length > 0
          ? `of a ${outcome} connection must be one of ${REASONS_OF[outcome].join(', ')}`
          : `can be given only for a blocked or failed connection`,
      );
    }

    if (Number.isNaN(parts.at.getTime())) {
      throw new InvalidRunConnectionError('at', 'must be a time');
    }

    return new RunConnection(
      host,
      parts.port,
      counted('bytesOut', parts.bytesOut),
      counted('bytesIn', parts.bytesIn),
      counted('ms', parts.ms),
      outcome,
      parts.status,
      parts.reason as ConnectionReason | null,
      parts.at,
    );
  }
}
