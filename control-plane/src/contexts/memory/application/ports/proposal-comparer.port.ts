import type { SettledSession } from '@memory/application/ports/memory-consolidator.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const PROPOSAL_COMPARER = Symbol('MEMORY_PROPOSAL_COMPARER');

interface ComparedProposal {
  /** A short name for the proposal in this request, like `P-1`. */
  readonly ref: string;
  readonly kind: string;
  readonly body: string;
  readonly where: string;
  /** The handles of the memories it is compared with. */
  readonly candidates: readonly string[];
}

interface CandidateMemory {
  readonly handle: string;
  readonly kind: string;
  readonly body: string;
  readonly where: string;
}

export interface ProposalComparisonRequest {
  readonly workspaceId: string;
  /** The run that proposed the memories: the session takes its harness, model and working copy, and is keyed by it. */
  readonly run: RunId;
  readonly proposals: readonly ComparedProposal[];
  readonly memories: readonly CandidateMemory[];
}

/** What the session said about one proposal: the handle of the memory it repeats, or null, and why. */
interface ProposalVerdict {
  readonly proposal: string;
  readonly sameAs: string | null;
  readonly reason: string;
}

/** What the session found, or that it has not settled yet, or that it never will. */
export type ProposalComparison =
  | {
      readonly status: 'compared';
      readonly verdicts: readonly ProposalVerdict[];
    }
  | { readonly status: 'waiting' }
  | { readonly status: 'failed'; readonly reason: string };

export interface ProposalComparerPort {
  /** Orders the session that compares the run's proposals the first time, and afterwards reports what it came to. */
  compare(request: ProposalComparisonRequest): Promise<ProposalComparison>;

  /** The run a settled session compared the proposals of, or null when memory did not order it to compare. */
  runOf(session: SettledSession): RunId | null;
}
