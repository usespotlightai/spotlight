import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';

const MAX_LENGTH = 100;

const LIVE_PREFIX = 'Live config';

const PLANNED_PREFIX = 'Planned change';

const ORACLE_PREFIX = 'With the answer';

const SEPARATOR = '/';

const SEARCHED = /^[a-z0-9][a-z0-9-]{0,62}$/;

export const SEED_NAME = 'seed';

const CANDIDATE_NAME_SAYS = `name must be 1 to ${MAX_LENGTH} characters`;

const refusalOf = (raw: string): string | null => {
  if (raw.length === 0 || raw.length > MAX_LENGTH) {
    return CANDIDATE_NAME_SAYS;
  }
  if (raw.trim() !== raw) {
    return 'name cannot start or end with a space';
  }
  if (raw.includes(SEPARATOR)) {
    return `name cannot contain ${SEPARATOR}`;
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
        `name cannot start with the reserved prefix “${LIVE_PREFIX}”`,
      );
    }
    if (raw.toLowerCase().startsWith(PLANNED_PREFIX.toLowerCase())) {
      throw new InvalidCandidateError(
        `name cannot start with the reserved prefix “${PLANNED_PREFIX}”`,
      );
    }
    if (raw.toLowerCase().startsWith(ORACLE_PREFIX.toLowerCase())) {
      throw new InvalidCandidateError(
        `name cannot start with the reserved prefix “${ORACLE_PREFIX}”`,
      );
    }

    return CandidateName.of(raw);
  }

  static searched(raw: string): CandidateName {
    if (!SEARCHED.test(raw)) {
      throw new InvalidCandidateError(
        'name must be up to 63 lowercase letters, digits and hyphens, not starting with a hyphen',
      );
    }
    if (raw === SEED_NAME) {
      throw new InvalidCandidateError(
        `name cannot be reserved name ${SEED_NAME}`,
      );
    }

    return new CandidateName(raw);
  }

  static planned(label: string | null, at: Date): CandidateName {
    return new CandidateName(
      `${PLANNED_PREFIX}, ${label ?? at.toISOString().slice(0, 10)}`,
    );
  }

  static oracle(at: Date): CandidateName {
    return new CandidateName(
      `${ORACLE_PREFIX}, ${at.toISOString().slice(0, 10)}`,
    );
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
