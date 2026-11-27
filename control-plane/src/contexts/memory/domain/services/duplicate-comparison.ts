import { DuplicateCheck } from '@memory/domain/aggregates/duplicate-check.aggregate';
import type { MemoryProposalSet } from '@memory/domain/aggregates/memory-proposal-set.aggregate';
import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type { MemoryProposal } from '@memory/domain/entities/memory-proposal.entity';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import {
  type AskedMemory,
  type AskedProposal,
  DuplicateQuestion,
} from '@memory/domain/value-objects/duplicate-question.vo';
import { DuplicateVerdict } from '@memory/domain/value-objects/duplicate-verdict.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import type { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

/** The most memories one proposal is compared with: the most specific to where it applies, then the newest. */
export const MAX_CANDIDATES = 10;

/** The most proposals one check asks about. */
export const MAX_ASKED = 20;

/** The most memories one check shows the model, across its proposals. */
export const MAX_SHOWN = 60;

/** What a model said about one proposal of the question: its ref, the handle of the memory it repeats or null, and why. */
export interface ReportedVerdict {
  readonly proposal: string;
  readonly sameAs: string | null;
  readonly reason: string;
}

/** The memory a proposal repeats, as the check found it and as it stands now. */
export interface Repeat {
  readonly memory: Memory;
  readonly reason: string;
}

const handleOf = (raw: string): MemoryHandle | null => {
  try {
    return MemoryHandle.parse(raw);
  } catch (error) {
    if (error instanceof InvalidMemoryError) {
      return null;
    }
    throw error;
  }
};

/**
 * Whether the proposal is compared with the memory to see whether it repeats it: the proposal is still proposed and
 * retires nothing, and the memory is an active memory of its team that applies where it applies, other than the
 * proposal itself and the memory it supersedes.
 */
export const isCandidate = (
  proposal: MemoryProposal,
  memory: Memory,
): boolean =>
  proposal.comparable &&
  memory.isActive &&
  !memory.id.equals(proposal.id) &&
  !(proposal.supersedes && memory.id.equals(proposal.supersedes)) &&
  memory.scope.overlaps(proposal.scope);

/** The memories the proposal is compared with, at most `MAX_CANDIDATES`: the most specific first, then the newest. */
export const candidatesOf = (
  proposal: MemoryProposal,
  memories: readonly Memory[],
): readonly Memory[] =>
  memories
    .filter((each) => isCandidate(proposal, each))
    .sort(
      (one, other) =>
        other.scope.specificity - one.scope.specificity ||
        other.approval.at.getTime() - one.approval.at.getTime(),
    )
    .slice(0, MAX_CANDIDATES);

/** The due check of a run that proposed a memory to compare; none when the run proposed nothing to compare. */
export const checkFor = (input: {
  set: MemoryProposalSet;
  runId: RunId;
  now: Date;
}): DuplicateCheck | null => {
  const [first] = input.set.comparableIn(input.runId);

  return first
    ? DuplicateCheck.due({
        runId: input.runId,
        workspaceId: input.set.workspaceId,
        teamId: first.scope.teamId,
        taskId: input.set.taskId,
        setId: input.set.id,
        now: input.now,
      })
    : null;
};

/**
 * What a check asks the model about its run's proposals: each proposal still compared that has a candidate, with its
 * candidates, within `MAX_ASKED` proposals and `MAX_SHOWN` memories. Null when no proposal has a candidate.
 */
export const questionFor = (input: {
  set: MemoryProposalSet;
  runId: RunId;
  memories: readonly Memory[];
  whereOf: (scope: MemoryScope) => string;
}): DuplicateQuestion | null => {
  const shown = new Map<string, AskedMemory>();
  const proposals: Omit<AskedProposal, 'ref'>[] = [];

  for (const proposal of input.set.comparableIn(input.runId)) {
    if (proposals.length >= MAX_ASKED) {
      break;
    }

    const candidates = candidatesOf(proposal, input.memories).filter(
      (each) => shown.has(each.id.value) || shown.size < MAX_SHOWN,
    );

    if (candidates.length === 0) {
      continue;
    }

    for (const memory of candidates) {
      if (!shown.has(memory.id.value)) {
        shown.set(memory.id.value, {
          memory: memory.id,
          handle: memory.handle,
          kind: memory.kind,
          body: memory.body.value,
          where: input.whereOf(memory.scope),
        });
      }
    }

    proposals.push({
      proposal: proposal.id,
      kind: proposal.kind,
      body: proposal.body.value,
      where: input.whereOf(proposal.scope),
      candidates: candidates.map((each) => each.id),
    });
  }

  return proposals.length > 0
    ? DuplicateQuestion.asking({ proposals, memories: [...shown.values()] })
    : null;
};

/**
 * The verdicts a model gave, read against the question it was asked. A verdict counts only for a proposal the question
 * names by its ref, once, with a reason, and may name only a memory the question compared that proposal with: any other
 * verdict is dropped, never trusted.
 */
export const verdictsFrom = (
  question: DuplicateQuestion,
  reported: readonly ReportedVerdict[],
): readonly DuplicateVerdict[] => {
  const verdicts: DuplicateVerdict[] = [];

  for (const each of reported) {
    const asked = question.proposalNamed(each.proposal);

    if (
      !asked ||
      each.reason.trim().length === 0 ||
      verdicts.some((one) => one.isAbout(asked.proposal))
    ) {
      continue;
    }

    const handle = each.sameAs === null ? null : handleOf(each.sameAs);
    const repeats = handle ? question.candidateOf(asked, handle) : null;

    if (each.sameAs !== null && !repeats) {
      continue;
    }

    verdicts.push(
      DuplicateVerdict.of({
        proposal: asked.proposal,
        repeats,
        reason: each.reason,
      }),
    );
  }

  return verdicts;
};

/**
 * The memory the check found the proposal repeats, among the team's current memories: only while the proposal is
 * still proposed, and that memory is still active and still one the proposal is compared with.
 */
export const repeatShown = (
  check: DuplicateCheck | null,
  proposal: MemoryProposal,
  memories: readonly Memory[],
): Repeat | null => {
  const verdict = check?.verdictFor(proposal.id);
  const repeats = verdict?.repeats;
  const memory = repeats && memories.find((each) => each.id.equals(repeats));

  return verdict && memory && isCandidate(proposal, memory)
    ? { memory, reason: verdict.reason }
    : null;
};
