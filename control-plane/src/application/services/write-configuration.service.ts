import { CONFIGURATION_BRANCH } from '@application/contracts/configuration-layout.contract';
import type {
  OpenedPullRequestDto,
  PullRequestPort,
} from '@application/ports/pull-request.port';
import type { ConfigurationRepo } from '@application/services/configuration-target.service';
import type { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';

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
      installation: into.installation,
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
