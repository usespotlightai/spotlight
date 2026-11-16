import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RepositoryName } from '@work/domain/value-objects/repository-name.vo';

const FETCH = 'git-upload-pack';

export const ReviewGitAccess = {
  mayCall(service: string): boolean {
    return service === FETCH;
  },

  mayRead(leased: string | null, found: Repository): boolean {
    return (
      leased === null || (RepositoryName.parsed(leased)?.names(found) ?? false)
    );
  },
};
