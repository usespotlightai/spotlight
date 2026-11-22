import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { UpkeepProposal } from '@memory/domain/entities/upkeep-proposal.entity';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import type { HeldBack } from '@memory/domain/services/held-back';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import type { UpkeepChange } from '@memory/domain/value-objects/upkeep-change';
import type { UpkeepProposalId } from '@memory/domain/value-objects/upkeep-proposal-id.vo';

export interface UpkeepSuggestion {
  readonly change: UpkeepChange;
  readonly handles: readonly string[];
  readonly body: string | null;
  readonly reason: string;
}

const handleOf = (raw: string): number | null => {
  try {
    return MemoryHandle.parse(raw).number;
  } catch (error) {
    if (error instanceof InvalidMemoryError) {
      return null;
    }
    throw error;
  }
};

const bodyOf = (raw: string | null): MemoryBody | null => {
  try {
    return raw ? MemoryBody.of(raw) : null;
  } catch (error) {
    if (error instanceof InvalidMemoryError) {
      return null;
    }
    throw error;
  }
};

const proposalOf = (
  suggestion: UpkeepSuggestion,
  named: readonly Memory[],
  newId: () => UpkeepProposalId,
): UpkeepProposal | null => {
  const [first] = named;

  if (!first || suggestion.reason.trim().length === 0) {
    return null;
  }

  switch (suggestion.change) {
    case 'retire':
      return named.length === 1
        ? UpkeepProposal.retiring({
            id: newId(),
            memory: first.id,
            finding: 'wrong',
            reason: suggestion.reason,
          })
        : null;
    case 'merge': {
      const body = bodyOf(suggestion.body);

      return body &&
        named.length > 1 &&
        named.every(
          (each) => each.kind === first.kind && each.scope.equals(first.scope),
        )
        ? UpkeepProposal.merging({
            id: newId(),
            memories: named.map((each) => each.id),
            body,
            reason: suggestion.reason,
          })
        : null;
    }
  }
};

export const consolidatedForUpkeep = (input: {
  readonly suggestions: readonly UpkeepSuggestion[];
  readonly memories: readonly Memory[];
  readonly heldBack: HeldBack;
  readonly newId: () => UpkeepProposalId;
}): UpkeepProposal[] => {
  const byHandle = new Map(
    input.memories
      .filter((each) => each.isActive && !input.heldBack.isOpen(each.id))
      .map((each) => [each.handle.number, each]),
  );
  const used = new Set<string>();
  const proposals: UpkeepProposal[] = [];

  for (const suggestion of input.suggestions) {
    const numbers = [
      ...new Set(
        suggestion.handles.map(handleOf).filter((each) => each !== null),
      ),
    ];
    const named = numbers.flatMap((each) => {
      const memory = byHandle.get(each);
      return memory && !used.has(memory.id.value) ? [memory] : [];
    });

    if (named.length !== numbers.length || named.length === 0) {
      continue;
    }

    const proposal = proposalOf(suggestion, named, input.newId);

    if (
      proposal &&
      !named.some((each) => input.heldBack.holds(each.id, proposal.finding))
    ) {
      proposals.push(proposal);
      named.forEach((each) => used.add(each.id.value));
    }
  }

  return proposals;
};

export const MAX_CONSOLIDATED = 200;

const mergeableWith = (memory: Memory): string => {
  const { lineId, stationId, repository, paths } = memory.scope;
  return JSON.stringify([
    memory.kind,
    lineId?.value,
    stationId?.value,
    repository?.value,
    paths.map((each) => each.value),
  ]);
};

export const consolidationGroupsOf = (
  active: readonly Memory[],
  heldBack: HeldBack,
): readonly (readonly Memory[])[] => {
  const grouped = new Map<string, Memory[]>();

  for (const each of active
    .filter((memory) => memory.isActive && !heldBack.isOpen(memory.id))
    .slice(0, MAX_CONSOLIDATED)) {
    const key = mergeableWith(each);
    grouped.set(key, [...(grouped.get(key) ?? []), each]);
  }

  return [...grouped.values()];
};
