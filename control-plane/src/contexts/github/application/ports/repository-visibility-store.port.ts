import type { RepositoryVisibility } from '@github/domain/value-objects/repository-visibility.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

export const REPOSITORY_VISIBILITY_STORE = Symbol(
  'REPOSITORY_VISIBILITY_STORE',
);

export interface StoredVisibility {
  readonly visibility: RepositoryVisibility;
  readonly checkedAt: Date;
}

export interface RepositoryVisibilityStorePort {
  find(
    repositories: readonly Repository[],
  ): Promise<ReadonlyMap<string, StoredVisibility>>;

  save(
    repository: Repository,
    visibility: RepositoryVisibility,
    checkedAt: Date,
  ): Promise<void>;
}
