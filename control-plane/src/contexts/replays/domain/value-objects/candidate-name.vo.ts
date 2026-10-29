import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';

const LIVE_PREFIX = 'Live config';

const PLANNED_PREFIX = 'Planned change';

const ORACLE_PREFIX = 'With the answer';

const SEARCHED = /^[a-z0-9][a-z0-9-]{0,62}$/;

export const SEED_NAME = 'seed';

export class CandidateName {
  private constructor(readonly value: string) {}

  static rehydrate(raw: string): CandidateName {
    return new CandidateName(raw);
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
