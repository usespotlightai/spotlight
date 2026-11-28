import type { InstallationPermissionsDto } from '@github/application/ports/installation-permissions.port';
import { AppGrants } from '@work/domain/value-objects/app-grants.vo';

export const AppGrantsMapper = {
  toDomain(read: InstallationPermissionsDto | null): AppGrants {
    return read
      ? AppGrants.of({ workflows: read.workflows, variables: read.variables })
      : AppGrants.unread();
  },
};
