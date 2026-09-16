import {
  REPOSITORY_ACCESS,
  type RepositoryAccessPort,
} from '@application/ports/repository-access.port';
import type {
  RepositoryCatalogPort,
  RepositorySummary,
} from '@application/ports/repository-catalog.port';
import { UpstreamRefusedError } from '@domain/exceptions/upstream-refused.error';
import type { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import type { Repository } from '@domain/value-objects/repository.vo';
import { Inject, Injectable } from '@nestjs/common';

const API = 'https://api.github.com';
const PER_PAGE = 100;

const MAX_PAGES = 10;

interface Listed {
  repositories?: { full_name?: string }[];
}

@Injectable()
export class GitHubRepositoryCatalog implements RepositoryCatalogPort {
  constructor(
    @Inject(REPOSITORY_ACCESS)
    private readonly access: RepositoryAccessPort,
  ) {}

  async list(installation: GitHubInstallation): Promise<RepositorySummary[]> {
    const { password: token } = await this.access.credential(installation);
    const found: RepositorySummary[] = [];

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const listed = await this.page(token, page);

      found.push(
        ...listed.flatMap((name) => (name ? [{ fullName: name }] : [])),
      );

      if (listed.length < PER_PAGE) {
        break;
      }
    }

    return found.sort((one, other) =>
      one.fullName.localeCompare(other.fullName),
    );
  }

  async create(
    installation: GitHubInstallation,
    repository: Repository,
  ): Promise<boolean> {
    const { password: token } = await this.access.credential(installation);

    const response = await fetch(`${API}/orgs/${repository.owner}/repos`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: repository.name,
        private: true,
        auto_init: true,
        description: 'Spotlight configuration',
      }),
    }).catch(() => null);

    return response?.ok === true;
  }

  private async page(
    token: string,
    page: number,
  ): Promise<(string | undefined)[]> {
    const response = await fetch(
      `${API}/installation/repositories?per_page=${PER_PAGE}&page=${page}`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          accept: 'application/vnd.github+json',
          'x-github-api-version': '2022-11-28',
        },
      },
    );

    if (!response.ok) {
      throw new UpstreamRefusedError(
        'GitHub would not list the repositories',
        `${response.status}`,
      );
    }

    const listed = (await response.json()) as Listed;

    return (listed.repositories ?? []).map((each) => each.full_name);
  }
}
