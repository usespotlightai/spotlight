import type {
  OpenedPullRequestDto,
  PullRequestOpening,
  PullRequestPort,
} from '@github/application/ports/pull-request.port';
import {
  REPOSITORY_ACCESS,
  type RepositoryAccessPort,
} from '@github/application/ports/repository-access.port';
import {
  answered,
  call,
  sending,
} from '@github/infrastructure/github/github.rest';
import { Inject, Injectable } from '@nestjs/common';
import { UpstreamRefusedError } from '@shared-kernel/domain/exceptions/upstream-refused.error';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

const UNPROCESSABLE = 422;

interface Opened {
  readonly html_url?: string;
}

@Injectable()
export class GitHubPullRequests implements PullRequestPort {
  constructor(
    @Inject(REPOSITORY_ACCESS)
    private readonly access: RepositoryAccessPort,
  ) {}

  async open(opening: PullRequestOpening): Promise<OpenedPullRequestDto> {
    const token = await this.tokenFor(opening);

    return this.pullRequest(
      opening,
      token,
      await this.defaultBranch(opening.repository, token),
    );
  }

  private async pullRequestFor(
    opening: Pick<PullRequestOpening, 'repository' | 'branch'>,
    token: string,
    into: string,
  ): Promise<OpenedPullRequestDto | null> {
    const open = await answered<Opened[]>(
      await call(
        `${this.at(opening.repository)}/pulls?state=open&base=${encodeURIComponent(into)}&head=${encodeURIComponent(`${opening.repository.owner}:${opening.branch}`)}`,
        token,
      ),
      `GitHub would not say what is open for ${opening.branch}`,
    );

    return open[0]?.html_url ? { url: open[0].html_url } : null;
  }

  private async pullRequest(
    opening: PullRequestOpening,
    token: string,
    into: string,
  ): Promise<OpenedPullRequestDto> {
    const response = await call(
      `${this.at(opening.repository)}/pulls`,
      token,
      sending({
        title: opening.title,
        body: opening.body,
        head: opening.branch,
        base: into,
      }),
    );

    const already =
      response.status === UNPROCESSABLE
        ? await this.pullRequestFor(opening, token, into)
        : null;

    if (already) {
      return already;
    }

    const opened = await answered<Opened>(
      response,
      'GitHub would not open the pull request',
    );

    if (!opened.html_url) {
      throw new UpstreamRefusedError(
        'opening the pull request',
        'GitHub named no pull request',
      );
    }

    return { url: opened.html_url };
  }

  private async defaultBranch(
    repository: Repository,
    token: string,
  ): Promise<string> {
    const found = await answered<{ default_branch?: string }>(
      await call(this.at(repository), token),
      `GitHub would not say what ${repository.value} merges into`,
    );

    return found.default_branch ?? 'main';
  }

  private at(repository: Repository): string {
    return `/repos/${repository.owner}/${repository.name}`;
  }

  private async tokenFor(opening: PullRequestOpening): Promise<string> {
    const { password } = await this.access.credential(opening.workspaceId);

    return password;
  }
}
