import { UpstreamRefusedError } from '@application/errors/upstream-refused.error';
import {
  REPOSITORY_ACCESS,
  type RepositoryAccessPort,
} from '@application/ports/repository-access.port';
import type {
  RepositoryCatalogPort,
  RepositorySummary,
} from '@application/ports/repository-catalog.port';
import { Inject, Injectable } from '@nestjs/common';

const API = 'https://api.github.com';
const PER_PAGE = 100;

/** As many as one installation is ever given, and then some. */
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

  async list(): Promise<RepositorySummary[]> {
    const { password: token } = await this.access.credential();
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
