import type { ConfigurationRepo } from '@configuration/application/services/configuration-target.service';
import type { RepositoryCatalogPort } from '@github/application/ports/repository-catalog.port';

export type Provisioned = 'held' | 'made' | 'refused';

export class RepositoryProvisioning {
  constructor(private readonly catalog: RepositoryCatalogPort) {}

  async ensure(target: ConfigurationRepo): Promise<Provisioned> {
    const held = await this.catalog.list(target.workspaceId);

    if (held.some((each) => each.fullName === target.repository.value)) {
      return 'held';
    }

    return (await this.catalog.create(target.workspaceId, target.repository))
      ? 'made'
      : 'refused';
  }
}
