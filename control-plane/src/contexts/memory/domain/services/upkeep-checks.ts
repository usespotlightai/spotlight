import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { UpkeepProposal } from '@memory/domain/entities/upkeep-proposal.entity';
import type { HeldBack } from '@memory/domain/services/held-back';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { UpkeepProposalId } from '@memory/domain/value-objects/upkeep-proposal-id.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

const UNUSED_FOR_MS = 90 * 24 * 60 * 60 * 1000;

export interface UpkeepEvidence {
  readonly now: Date;
  readonly memories: readonly Memory[];
  readonly repositories: readonly Repository[];
  readonly treeOf: (repository: Repository) => ReadonlySet<string> | null;
  readonly lastUsedOf: (memory: MemoryId) => Date | null;
  readonly heldBack: HeldBack;
}

const exists = (paths: ReadonlySet<string>, path: string): boolean => {
  if (paths.has(path)) {
    return true;
  }

  const folder = `${path}/`;
  for (const each of paths) {
    if (each.startsWith(folder)) {
      return true;
    }
  }

  return false;
};

const quoted = (paths: readonly string[]): string =>
  paths.map((each) => `\`${each}\``).join(', ');

const findingOf = (
  memory: Memory,
  evidence: UpkeepEvidence,
): Pick<UpkeepProposal, 'finding' | 'reason'> | null => {
  const { repository, paths } = memory.scope;

  if (
    repository &&
    evidence.repositories.length > 0 &&
    !evidence.repositories.some((each) => each.equals(repository))
  ) {
    return {
      finding: 'repository-gone',
      reason: `${repository.value} is no longer a repository of any of the team's lines.`,
    };
  }

  const tree = repository ? evidence.treeOf(repository) : null;
  const gone = tree
    ? paths.map((each) => each.value).filter((each) => !exists(tree, each))
    : [];

  if (repository && paths.length > 0 && gone.length === paths.length) {
    return {
      finding: 'path-gone',
      reason: `${quoted(gone)} no longer ${gone.length === 1 ? 'exists' : 'exist'} on the default branch of ${repository.value}.`,
    };
  }

  const since = evidence.now.getTime() - UNUSED_FOR_MS;
  const used = evidence.lastUsedOf(memory.id);

  if (
    memory.approval.at.getTime() <= since &&
    (!used || used.getTime() <= since)
  ) {
    return {
      finding: 'unused',
      reason:
        'No run was briefed with it, read it, recalled it or was shown it in 90 days.',
    };
  }

  return null;
};

export const checkedForUpkeep = (
  evidence: UpkeepEvidence,
  newId: () => UpkeepProposalId,
): UpkeepProposal[] =>
  evidence.memories.flatMap((memory) => {
    if (!memory.isActive) {
      return [];
    }

    const found = findingOf(memory, evidence);

    return found && !evidence.heldBack.holds(memory.id, found.finding)
      ? [
          UpkeepProposal.retiring({
            id: newId(),
            memory: memory.id,
            finding: found.finding,
            reason: found.reason,
          }),
        ]
      : [];
  });
