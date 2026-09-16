import { KEPT_UNDER } from '@application/contracts/configuration-layout.contract';
import type { RepositoryContentsPort } from '@application/ports/repository-contents.port';
import type { ConfigurationRepo } from '@application/services/configuration-target.service';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import type { Repository } from '@domain/value-objects/repository.vo';

export interface Holding {
  readonly repository: Repository;
  readonly sha: string;
  readonly files: readonly ConfigurationFile[];
}

export class HeldConfiguration {
  constructor(private readonly contents: RepositoryContentsPort) {}

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
