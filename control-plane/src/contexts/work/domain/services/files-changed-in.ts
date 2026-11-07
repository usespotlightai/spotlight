import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

const SEPARATOR = '/';

export interface RepositoryFile {
  readonly repository: Repository;
  readonly path: string;
}

export const filesChangedIn = (
  workspacePaths: readonly string[],
  repositories: readonly Repository[],
): RepositoryFile[] =>
  workspacePaths.flatMap((within) => {
    const [folder, ...rest] = within.split(SEPARATOR);
    const repository = repositories.find((each) => each.name === folder);

    return repository && rest.length > 0
      ? [{ repository, path: rest.join(SEPARATOR) }]
      : [];
  });
