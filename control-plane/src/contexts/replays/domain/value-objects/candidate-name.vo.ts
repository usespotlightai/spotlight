import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';

const MOST_LENGTH = 100;

const LIVE_PREFIX = 'Live config';

const PLANNED_PREFIX = 'Planned change';

const SANITY_PREFIX = 'Stronger model';

const SEPARATOR = '/';

const SEARCHED = /^[a-z0-9][a-z0-9-]{0,62}$/;

export const SEED_NAME = 'seed';

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
    if (raw.toLowerCase().startsWith(PLANNED_PREFIX.toLowerCase())) {
      throw new InvalidCandidateError(
        `is named other than ${PLANNED_PREFIX}, which names the changes Spotlight replays to check them`,
      );
    }
    if (raw.toLowerCase().startsWith(SANITY_PREFIX.toLowerCase())) {
      throw new InvalidCandidateError(
        `is named other than ${SANITY_PREFIX}, which names the replays that check a set rewards a stronger model`,
      );
    }

    return CandidateName.of(raw);
  }

  static searched(raw: string): CandidateName {
    if (!SEARCHED.test(raw)) {
      throw new InvalidCandidateError(
        'found by a search is named in lowercase letters, digits and hyphens, starting with a letter or digit, in at most 63 characters',
      );
    }
    if (raw === SEED_NAME) {
      throw new InvalidCandidateError(
        `found by a search is named other than ${SEED_NAME}, which names the live config the search started from`,
      );
    }

    return new CandidateName(raw);
  }

  static planned(label: string | null, at: Date): CandidateName {
    return new CandidateName(
      `${PLANNED_PREFIX}, ${label ?? at.toISOString().slice(0, 10)}`,
    );
  }

  static sanity(at: Date): CandidateName {
    return new CandidateName(
      `${SANITY_PREFIX}, ${at.toISOString().slice(0, 10)}`,
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
