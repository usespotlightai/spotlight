import { InvalidJournalEntryError } from '@runs/domain/exceptions/invalid-journal-entry.error';

const FIRST_CONTROL_PLANE = -1_000_000;

export class JournalSeq {
  private constructor(readonly value: number) {}

  static fromRunner(value: number): JournalSeq {
    if (!Number.isInteger(value) || value < 1) {
      throw new InvalidJournalEntryError(`seq ${value} is not a runner place`);
    }

    return new JournalSeq(value);
  }

  static controlPlaneBelow(lowest: number | null): JournalSeq {
    return new JournalSeq(lowest === null ? FIRST_CONTROL_PLANE : lowest - 1);
  }

  static isControlPlane(value: number): boolean {
    return value <= FIRST_CONTROL_PLANE;
  }

  static get firstControlPlane(): number {
    return FIRST_CONTROL_PLANE;
  }
}
