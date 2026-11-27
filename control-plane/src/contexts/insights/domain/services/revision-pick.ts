import {
  agreementOf,
  type VerdictPair,
} from '@insights/domain/services/judge-agreement';
import {
  MIN_HELD_OUT,
  type RevisionSplit,
} from '@insights/domain/services/revision-split';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const MAX_CANDIDATES = 3;

export const MAX_REVISION_JUDGE_CALLS = 150;

export interface LabelledRun {
  readonly runId: RunId;
  readonly human: boolean;
  readonly live: boolean;
}

export interface CandidateVerdicts {
  readonly claims: readonly string[];
  readonly passes: ReadonlyMap<string, boolean>;
}

interface SplitAgreement {
  readonly before: number | null;
  readonly after: number | null;
  readonly runs: number;
}

export interface RevisionAgreement {
  readonly searched: SplitAgreement;
  readonly heldOut: SplitAgreement;
}

export interface PickedCandidate {
  readonly claims: readonly string[];
  readonly agreement: RevisionAgreement;
}

const kappaOf = (pairs: readonly VerdictPair[]): number | null =>
  agreementOf(pairs).kappa;

const splitAgreementOf = (
  runs: readonly LabelledRun[],
  passes: ReadonlyMap<string, boolean>,
): SplitAgreement => {
  const judged = runs.filter((each) => passes.has(each.runId.value));

  return {
    before: kappaOf(
      judged.map((each) => ({ judge: each.live, human: each.human })),
    ),
    after: kappaOf(
      judged.map((each) => ({
        judge: passes.get(each.runId.value) ?? false,
        human: each.human,
      })),
    ),
    runs: judged.length,
  };
};

const rank = (kappa: number | null): number =>
  kappa ?? Number.NEGATIVE_INFINITY;

export const candidateCountWithin = (
  runs: number,
  drafted: number,
  judgeCallsLeft = MAX_REVISION_JUDGE_CALLS,
): number =>
  runs === 0
    ? 0
    : Math.min(drafted, MAX_CANDIDATES, Math.floor(judgeCallsLeft / runs));

const revisionAgreementOf = (
  split: RevisionSplit<LabelledRun>,
  candidate: CandidateVerdicts,
): RevisionAgreement => ({
  searched: splitAgreementOf(split.searched, candidate.passes),
  heldOut: splitAgreementOf(split.heldOut, candidate.passes),
});

export const bestCandidateOf = (
  split: RevisionSplit<LabelledRun>,
  candidates: readonly CandidateVerdicts[],
): PickedCandidate | null =>
  candidates
    .map((each) => ({
      claims: each.claims,
      agreement: revisionAgreementOf(split, each),
    }))
    .filter((each) => each.agreement.heldOut.runs >= MIN_HELD_OUT)
    .reduce<PickedCandidate | null>(
      (best, each) =>
        best === null ||
        rank(each.agreement.searched.after) >
          rank(best.agreement.searched.after)
          ? each
          : best,
      null,
    );

export const beatsLiveJudge = (agreement: RevisionAgreement): boolean =>
  agreement.heldOut.after !== null &&
  rank(agreement.heldOut.after) > rank(agreement.heldOut.before);
