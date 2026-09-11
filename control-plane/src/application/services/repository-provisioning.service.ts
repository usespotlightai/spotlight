import type { RepositoryCatalogPort } from '@application/ports/repository-catalog.port';
import type { ConfigurationRepo } from '@application/services/configuration-target.service';

export type Provisioned = 'held' | 'made' | 'refused';

/**
 * A name nobody has yet is a repository to create rather than a mistake.
 * Whether the host refusing is a failure is the caller's to decide.
 */
export class RepositoryProvisioning {
  constructor(private readonly catalog: RepositoryCatalogPort) {}

  async ensure(target: ConfigurationRepo): Promise<Provisioned> {
    const held = await this.catalog.list(target.installation);

    if (held.some((each) => each.fullName === target.repository.value)) {
      return 'held';
    }

    return (await this.catalog.create(target.installation, target.repository))
      ? 'made'
      : 'refused';
  }
}
