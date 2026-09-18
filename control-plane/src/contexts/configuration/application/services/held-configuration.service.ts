import { KEPT_UNDER } from '@configuration/application/contracts/configuration-layout.contract';
import type { ConfigurationRepo } from '@configuration/application/services/configuration-target.service';
import type { RepositoryContentsPort } from '@github/application/ports/repository-contents.port';
import { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

export interface Holding {
  readonly repository: Repository;
  readonly sha: string;
  readonly files: readonly ConfigurationFile[];
}

export class HeldConfiguration {
  constructor(private readonly contents: RepositoryContentsPort) {}

  async at(target: ConfigurationRepo): Promise<Holding | null> {
    const sha = await this.contents.headOf(
      target.workspaceId,
      target.repository,
    );

    if (!sha) {
      return null;
    }

    const files = await this.contents.under({
      workspaceId: target.workspaceId,
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
