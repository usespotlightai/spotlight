import {
  repositoryNameKey,
  sameRepositoryName,
} from '@shared-kernel/domain/services/repository-names';

export interface RepositoryStack {
  readonly repository: string | null;
  readonly stackStartedAt: Date;
}

export const keepsOneStackEach = (
  stacks: readonly RepositoryStack[],
): boolean => {
  const names = stacks.map((each) => repositoryNameKey(each.repository));

  return new Set(names).size === names.length;
};

export const withLatestStack = <Stack extends RepositoryStack>(
  stacks: readonly Stack[],
  next: Stack,
  breaksTie: (next: Stack, kept: Stack) => boolean,
): readonly Stack[] => {
  const kept = stacks.find((each) =>
    sameRepositoryName(each.repository, next.repository),
  );

  if (kept) {
    const newer = next.stackStartedAt.getTime() - kept.stackStartedAt.getTime();

    if (newer < 0 || (newer === 0 && !breaksTie(next, kept))) {
      return stacks;
    }
  }

  return [...stacks.filter((each) => each !== kept), next];
};
