import { CandidateScoring } from '@replays/domain/value-objects/candidate-scoring.vo';
import { RubricVersion } from '@replays/domain/value-objects/rubric-version.vo';
import { StationHashes } from '@replays/domain/value-objects/station-hashes.vo';
import { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';

export interface StationIdentityFacts {
  readonly fingerprint: string;
  readonly handoverWords: readonly string[];
  readonly ends: boolean;
  readonly check: string | null;
  readonly diffs: boolean;
  readonly judge: {
    readonly rubric: string | null;
    readonly claims: readonly string[];
    readonly passThreshold: number;
  } | null;
  readonly rubricHash: string | null;
}

export type Sha256 = (text: string) => string;

export const stationHashesOf = (
  facts: StationIdentityFacts,
  sha256: Sha256,
): StationHashes => {
  const behaviour = sha256(
    JSON.stringify({
      fingerprint: facts.fingerprint,
      options: facts.handoverWords,
      ends: facts.ends,
    }),
  );

  return StationHashes.of({
    behaviour,
    scoring: sha256(
      JSON.stringify({
        behaviour,
        check: facts.check,
        diffs: facts.diffs,
        judge: facts.rubricHash,
      }),
    ),
  });
};

export const candidateScoringOf = (
  facts: StationIdentityFacts,
): CandidateScoring =>
  CandidateScoring.of({
    checksChanges: facts.diffs && facts.check !== null,
    judge: facts.judge && JudgeCriteria.of(facts.judge),
    rubricVersion: RubricVersion.optional(facts.rubricHash),
  });
