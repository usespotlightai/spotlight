import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

export const lineRepositoryOf = (
  repositories: readonly Repository[],
  name: string | null,
): Repository => {
  const wanted = RepositoryName.optional(name);
  const [only] = repositories;
  const found = wanted
    ? repositories.find((each) => wanted.names(each))
    : repositories.length === 1
      ? only
      : undefined;

  if (!found) {
    throw InvalidChangeStackError.because(
      wanted
        ? `names ${wanted.value}, which the line does not have`
        : 'names no repository, and the line does not have exactly one',
    );
  }

  return found;
};
