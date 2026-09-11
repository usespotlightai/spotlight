import type { RepositoryContentsPort } from '@application/ports/repository-contents.port';
import type { ConfigurationRepo } from '@application/services/configuration-target.service';
import { KEPT_UNDER } from '@domain/aggregates/team-configuration.aggregate';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import type { Repository } from '@domain/value-objects/repository.vo';

export interface Holding {
  readonly repository: Repository;
  readonly sha: string;
  readonly files: readonly ConfigurationFile[];
}

/**
 * Asked one way, so "already holds configuration" means the same thing to
 * reading, seeding and moving.
 */
export class HeldConfiguration {
  constructor(private readonly contents: RepositoryContentsPort) {}

  /** Null where the repository has no branch to read at. */
  async at(target: ConfigurationRepo): Promise<Holding | null> {
    const sha = await this.contents.headOf(
      target.installation,
      target.repository,
    );

    if (!sha) {
      return null;
    }

    const files = await this.contents.under({
      installation: target.installation,
      repository: target.repository,
      ref: sha,
      path: KEPT_UNDER,
    });

    return {
      repository: target.repository,
      sha,
      files: files.map((each) => ConfigurationFile.of(each.path, each.text)),
    };
  }
}
