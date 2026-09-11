import { InvalidEffortError } from '@domain/exceptions/invalid-effort.error';

/** How hard a harness is told to think, from faster to smarter. */
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;

export type EffortLevel = (typeof EFFORTS)[number];

const isLevel = (raw: string): raw is EffortLevel =>
  (EFFORTS as readonly string[]).includes(raw);

export class Effort {
  private constructor(readonly value: EffortLevel) {}

  static of(raw: string): Effort {
    const trimmed = raw.trim();

    if (!isLevel(trimmed)) {
      throw new InvalidEffortError(`must be one of ${EFFORTS.join(', ')}`);
    }

    return new Effort(trimmed);
  }

  equals(other: Effort): boolean {
    return this.value === other.value;
  }
}
