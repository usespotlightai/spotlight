import type { PullRequestPort } from '@application/ports/pull-request.port';
import type { RepositoryContentsPort } from '@application/ports/repository-contents.port';
import type { ConfigurationRepo } from '@application/services/configuration-target.service';
import { CONFIGURATION_BRANCH } from '@domain/aggregates/team-configuration.aggregate';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';

export interface HeldFiles {
  readonly onBranch: boolean;
  readonly files: readonly ConfigurationFile[];
}

export class PendingConfiguration {
  constructor(
    private readonly contents: RepositoryContentsPort,
    private readonly pullRequests: PullRequestPort,
  ) {}

  async onBranch(
    into: ConfigurationRepo,
    path: string,
  ): Promise<ConfigurationFile | null> {
    const open = await this.pullRequests.openFor(
      into.installation,
      into.repository,
      CONFIGURATION_BRANCH,
    );

    return open ? this.read(into, CONFIGURATION_BRANCH, path) : null;
  }

  async fileAt(
    into: ConfigurationRepo,
    path: string,
  ): Promise<ConfigurationFile | null> {
    const pending = await this.onBranch(into, path);

    if (pending) {
      return pending;
    }

    const head = await this.contents.headOf(into.installation, into.repository);

    return head ? this.read(into, head, path) : null;
  }

  async under(into: ConfigurationRepo, path: string): Promise<HeldFiles> {
    const open = await this.pullRequests.openFor(
      into.installation,
      into.repository,
      CONFIGURATION_BRANCH,
    );
    const ref = open
      ? CONFIGURATION_BRANCH
      : await this.contents.headOf(into.installation, into.repository);

    if (!ref) {
      return { onBranch: false, files: [] };
    }

    const files = await this.contents.under({
      installation: into.installation,
      repository: into.repository,
      ref,
      path,
    });

    return {
      onBranch: open !== null,
      files: files.map((each) => ConfigurationFile.of(each.path, each.text)),
    };
  }

  private async read(
    into: ConfigurationRepo,
    ref: string,
    path: string,
  ): Promise<ConfigurationFile | null> {
    const file = await this.contents.read({
      installation: into.installation,
      repository: into.repository,
      ref,
      path,
    });

    return file ? ConfigurationFile.of(file.path, file.text) : null;
  }
}
