import { InvalidOutcomeError } from '@outcomes/domain/exceptions/invalid-outcome.error';
import type { RunEnding } from '@outcomes/domain/value-objects/run-ending';
import type { RunPlace } from '@outcomes/domain/value-objects/run-place.vo';
import type { RunSetup } from '@outcomes/domain/value-objects/run-setup.vo';

const FINGERPRINT = /^[0-9a-f]{64}$/;

export const configFingerprintOf = (raw: string | null): string | null =>
  raw !== null && FINGERPRINT.test(raw) ? raw : null;

const before = (earlier: Date | null, later: Date | null): boolean =>
  earlier === null || later === null || earlier.getTime() <= later.getTime();

export class RunEnd {
  private constructor(
    readonly place: RunPlace,
    readonly fingerprint: string | null,
    readonly setup: RunSetup,
    readonly queuedAt: Date | null,
    readonly startedAt: Date | null,
    readonly endedAt: Date,
    readonly ending: RunEnding,
    readonly failure: string | null,
    readonly round: number,
    readonly asked: boolean,
  ) {}

  static of(input: {
    place: RunPlace;
    fingerprint: string | null;
    setup: RunSetup;
    queuedAt: Date | null;
    startedAt: Date | null;
    endedAt: Date;
    ending: RunEnding;
    failure: string | null;
    round: number;
    asked: boolean;
  }): RunEnd {
    if (input.fingerprint !== null && !FINGERPRINT.test(input.fingerprint)) {
      throw new InvalidOutcomeError(
        'station config fingerprint must be 64 hex characters',
      );
    }
    if (!Number.isInteger(input.round) || input.round < 1) {
      throw new InvalidOutcomeError('round must be 1 or later');
    }
    if (
      !before(input.queuedAt, input.startedAt) ||
      !before(input.startedAt, input.endedAt)
    ) {
      throw new InvalidOutcomeError(
        'must be queued, started and ended in order',
      );
    }

    return new RunEnd(
      input.place,
      input.fingerprint,
      input.setup,
      input.queuedAt,
      input.startedAt,
      input.endedAt,
      input.ending,
      input.failure,
      input.round,
      input.asked,
    );
  }

  get ran(): boolean {
    return this.ending !== 'withdrawn';
  }

  get ranItsConfig(): boolean {
    return this.ran && this.startedAt !== null;
  }

  get beganAt(): Date {
    return this.startedAt ?? this.endedAt;
  }

  get queuedMs(): number | null {
    return this.queuedAt && this.startedAt
      ? this.startedAt.getTime() - this.queuedAt.getTime()
      : null;
  }

  get runningMs(): number | null {
    return this.startedAt
      ? this.endedAt.getTime() - this.startedAt.getTime()
      : null;
  }
}
