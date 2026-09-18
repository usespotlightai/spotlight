import { CONFIGURATION_BRANCH } from '@configuration/application/contracts/configuration-layout.contract';
import type { ConfigurationRepo } from '@configuration/application/services/configuration-target.service';
import type {
  OpenedPullRequestDto,
  PullRequestPort,
} from '@github/application/ports/pull-request.port';
import type { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';

export interface Writing {
  readonly title: string;
  readonly body: string;
  readonly files: readonly ConfigurationFile[];
  readonly removes?: readonly string[];
}

export class WriteConfiguration {
  constructor(private readonly pullRequests: PullRequestPort) {}

  writeInto(
    into: ConfigurationRepo,
    writing: Writing,
  ): Promise<OpenedPullRequestDto> {
    return this.pullRequests.propose({
      workspaceId: into.workspaceId,
      repository: into.repository,
      branch: CONFIGURATION_BRANCH,
      title: writing.title,
      body: writing.body,
      message: writing.title,
      files: writing.files.map((each) => ({
        path: each.path,
        text: each.text,
      })),
      removes: writing.removes ?? [],
    });
  }
}
