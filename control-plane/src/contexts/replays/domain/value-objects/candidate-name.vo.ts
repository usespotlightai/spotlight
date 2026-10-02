import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';

const MOST_LENGTH = 100;

const LIVE_PREFIX = 'Live config';

const SEPARATOR = '/';

const CANDIDATE_NAME_SAYS = `is named in 1 to ${MOST_LENGTH} characters`;

const refusalOf = (raw: string): string | null => {
  if (raw.length === 0 || raw.length > MOST_LENGTH) {
    return CANDIDATE_NAME_SAYS;
  }
  if (raw.trim() !== raw) {
    return 'is named without spaces before or after';
  }
  if (raw.includes(SEPARATOR)) {
    return `is named without ${SEPARATOR}, since its name ends its address`;
  }

  return null;
};

export class CandidateName {
  private constructor(readonly value: string) {}

  static of(raw: string): CandidateName {
    const refused = refusalOf(raw);

    if (refused) {
      throw new InvalidCandidateError(refused);
    }

    return new CandidateName(raw);
  }

  static proposed(raw: string): CandidateName {
    if (raw.toLowerCase().startsWith(LIVE_PREFIX.toLowerCase())) {
      throw new InvalidCandidateError(
        `is named other than ${LIVE_PREFIX}, which names the snapshots Spotlight takes to replay as a baseline`,
      );
    }

    return CandidateName.of(raw);
  }

  static live(at: Date): CandidateName {
    return new CandidateName(
      `${LIVE_PREFIX}, ${at.toISOString().slice(0, 10)}`,
    );
  }

  equals(other: CandidateName): boolean {
    return this.value === other.value;
  }
}
