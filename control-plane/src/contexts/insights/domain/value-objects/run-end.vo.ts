import { InvalidOutcomeError } from '@insights/domain/exceptions/invalid-outcome.error';
import type { RunAgentConfig } from '@insights/domain/value-objects/run-agent-config.vo';
import type { RunEnding } from '@insights/domain/value-objects/run-ending';
import type { RunLocation } from '@insights/domain/value-objects/run-location.vo';

const FINGERPRINT = /^[0-9a-f]{64}$/;

export const configFingerprintOf = (raw: string | null): string | null =>
  raw !== null && FINGERPRINT.test(raw) ? raw : null;

const before = (earlier: Date | null, later: Date | null): boolean =>
  earlier === null || later === null || earlier.getTime() <= later.getTime();

export class RunEnd {
  private constructor(
    readonly location: RunLocation,
    readonly fingerprint: string | null,
    readonly agentConfig: RunAgentConfig,
    readonly queuedAt: Date | null,
    readonly startedAt: Date | null,
    readonly endedAt: Date,
    readonly ending: RunEnding,
    readonly failure: string | null,
    readonly visit: number,
    readonly asked: boolean,
  ) {}

  static of(input: {
    location: RunLocation;
    fingerprint: string | null;
    agentConfig: RunAgentConfig;
    queuedAt: Date | null;
    startedAt: Date | null;
    endedAt: Date;
    ending: RunEnding;
    failure: string | null;
    visit: number;
    asked: boolean;
  }): RunEnd {
    if (input.fingerprint !== null && !FINGERPRINT.test(input.fingerprint)) {
      throw new InvalidOutcomeError(
        'station config fingerprint must be 64 hex characters',
      );
    }
    if (!Number.isInteger(input.visit) || input.visit < 1) {
      throw new InvalidOutcomeError('visit must be 1 or later');
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
      input.location,
      input.fingerprint,
      input.agentConfig,
      input.queuedAt,
      input.startedAt,
      input.endedAt,
      input.ending,
      input.failure,
      input.visit,
      input.asked,
    );
  }

  get ran(): boolean {
    return this.ending !== 'cancelled';
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
