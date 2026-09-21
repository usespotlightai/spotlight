import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

interface WorkedRepositories {
  readonly reviewed: Repository | null;
  repositoryNamed(name: string): Repository | null;
}

export const repositoryNamedIn = (
  name: string,
  worked: {
    reviewed: Repository | null;
    line: Pick<WorkedRepositories, 'repositoryNamed'> | null;
  },
): Repository | null =>
  worked.reviewed
    ? worked.reviewed.name === name
      ? worked.reviewed
      : null
    : (worked.line?.repositoryNamed(name) ?? null);
