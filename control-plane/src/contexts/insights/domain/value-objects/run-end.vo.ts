import { InvalidOutcomeError } from '@insights/domain/exceptions/invalid-outcome.error';
import { ConfigFingerprint } from '@insights/domain/value-objects/config-fingerprint.vo';
import type { RunAgentConfig } from '@insights/domain/value-objects/run-agent-config.vo';
import type { RunEnding } from '@insights/domain/value-objects/run-ending';
import type { RunLocation } from '@insights/domain/value-objects/run-location.vo';

const before = (earlier: Date | null, later: Date | null): boolean =>
  earlier === null || later === null || earlier.getTime() <= later.getTime();

const isDuration = (ms: number): boolean => Number.isInteger(ms) && ms >= 0;

export class RunEnd {
  private constructor(
    readonly location: RunLocation,
    readonly fingerprint: ConfigFingerprint | null,
    readonly agentConfig: RunAgentConfig,
    readonly queuedAt: Date | null,
    readonly startedAt: Date | null,
    readonly endedAt: Date,
    private readonly spentQueuedMs: number,
    private readonly spentRunningMs: number,
    readonly ending: RunEnding,
    readonly failure: string | null,
    readonly runNumber: number,
  ) {}

  static of(input: {
    location: RunLocation;
    fingerprint: string | null;
    agentConfig: RunAgentConfig;
    queuedAt: Date | null;
    startedAt: Date | null;
    endedAt: Date;
    queuedMs: number;
    runningMs: number;
    ending: RunEnding;
    failure: string | null;
    runNumber: number;
  }): RunEnd {
    if (!Number.isInteger(input.runNumber) || input.runNumber < 1) {
      throw new InvalidOutcomeError('run number must be 1 or later');
    }
    if (
      !before(input.queuedAt, input.startedAt) ||
      !before(input.startedAt, input.endedAt)
    ) {
      throw new InvalidOutcomeError(
        'must be queued, started and ended in order',
      );
    }
    if (!isDuration(input.queuedMs) || !isDuration(input.runningMs)) {
      throw new InvalidOutcomeError(
        'must spend a whole number of milliseconds queued and running',
      );
    }
    if (input.startedAt === null && input.runningMs > 0) {
      throw new InvalidOutcomeError('cannot run without starting');
    }

    return new RunEnd(
      input.location,
      ConfigFingerprint.optional(input.fingerprint),
      input.agentConfig,
      input.queuedAt,
      input.startedAt,
      input.endedAt,
      input.queuedMs,
      input.runningMs,
      input.ending,
      input.failure,
      input.runNumber,
    );
  }

  get ran(): boolean {
    return this.ending !== 'cancelled';
  }

  get ranItsConfig(): boolean {
    return this.ran && this.startedAt !== null;
  }

  get ranAConfig(): boolean {
    return this.ranItsConfig && this.fingerprint !== null;
  }

  get beganAt(): Date {
    return this.startedAt ?? this.endedAt;
  }

  get queuedMs(): number | null {
    return this.startedAt ? this.spentQueuedMs : null;
  }

  get runningMs(): number | null {
    return this.startedAt ? this.spentRunningMs : null;
  }
}
