import { InvalidOutcomeError } from '@outcomes/domain/exceptions/invalid-outcome.error';
import type { RunEnding } from '@outcomes/domain/value-objects/run-ending';
import type { RunPlace } from '@outcomes/domain/value-objects/run-place.vo';

const FINGERPRINT = /^[0-9a-f]{64}$/;

export class RunEnd {
  private constructor(
    readonly place: RunPlace,
    readonly fingerprint: string | null,
    readonly endedAt: Date,
    readonly ending: RunEnding,
    readonly failure: string | null,
    readonly round: number,
  ) {}

  static of(input: {
    place: RunPlace;
    fingerprint: string | null;
    endedAt: Date;
    ending: RunEnding;
    failure: string | null;
    round: number;
  }): RunEnd {
    if (input.fingerprint !== null && !FINGERPRINT.test(input.fingerprint)) {
      throw new InvalidOutcomeError(
        'names its station config by a 64-character hex fingerprint',
      );
    }
    if (!Number.isInteger(input.round) || input.round < 1) {
      throw new InvalidOutcomeError('is its station’s first round or later');
    }

    return new RunEnd(
      input.place,
      input.fingerprint,
      input.endedAt,
      input.ending,
      input.failure,
      input.round,
    );
  }

  get ran(): boolean {
    return this.ending !== 'withdrawn';
  }
}
