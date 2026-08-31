import type { OpenedPullRequestDto } from '@application/dto/pull-request.dto';
import { UpstreamRefusedError } from '@application/errors/upstream-refused.error';
import type {
  PullRequestOpening,
  PullRequestPort,
} from '@application/ports/pull-request.port';
import {
  REPOSITORY_ACCESS,
  type RepositoryAccessPort,
} from '@application/ports/repository-access.port';
import type { Repository } from '@domain/value-objects/repository.vo';
import { Inject, Injectable } from '@nestjs/common';

const API = 'https://api.github.com';

@Injectable()
export class GitHubPullRequests implements PullRequestPort {
  constructor(
    @Inject(REPOSITORY_ACCESS)
    private readonly access: RepositoryAccessPort,
  ) {}

  async open(opening: PullRequestOpening): Promise<OpenedPullRequestDto> {
    const { password: token } = await this.access.credential();
    const into = await this.defaultBranch(opening.repository, token);

    const response = await this.ask(
      `${API}/repos/${opening.repository.owner}/${opening.repository.name}/pulls`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          title: opening.title,
          body: opening.body,
          head: opening.branch,
          base: into,
        }),
      },
    );

    const opened = (await response.json()) as {
      html_url?: string;
      message?: string;
      errors?: { message?: string }[];
    };

    if (!response.ok || !opened.html_url) {
      throw new UpstreamRefusedError(
        'GitHub would not open the pull request',
        opened.errors?.[0]?.message ?? opened.message ?? `${response.status}`,
      );
    }

    return { url: opened.html_url };
  }

  private async defaultBranch(
    repository: Repository,
    token: string,
  ): Promise<string> {
    const response = await this.ask(
      `${API}/repos/${repository.owner}/${repository.name}`,
      token,
      {},
    );

    if (!response.ok) {
      throw new UpstreamRefusedError(
        `GitHub would not say what ${repository.value} merges into`,
        `${response.status}`,
      );
    }

    const found = (await response.json()) as { default_branch?: string };

    return found.default_branch ?? 'main';
  }

  private ask(
    url: string,
    token: string,
    init: RequestInit,
  ): Promise<Response> {
    return fetch(url, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'content-type': 'application/json',
      },
    });
  }
}
