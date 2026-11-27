import type {
  InstallationRepositoriesPort,
  RepositorySummary,
} from '@github/application/ports/installation-repositories.port';
import {
  REPOSITORY_ACCESS,
  type RepositoryAccessPort,
} from '@github/application/ports/repository-access.port';
import { Inject, Injectable } from '@nestjs/common';
import { UpstreamError } from '@shared-kernel/application/errors/upstream.error';
import { nonEmpty } from '@shared-kernel/domain/non-empty';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { z } from 'zod';

const API = 'https://api.github.com';
const PER_PAGE = 100;

const MAX_PAGES = 10;

const LISTED = z.object({
  repositories: z
    .array(z.object({ full_name: z.string().optional() }))
    .optional(),
});

@Injectable()
export class GitHubInstallationRepositories implements InstallationRepositoriesPort {
  constructor(
    @Inject(REPOSITORY_ACCESS)
    private readonly access: RepositoryAccessPort,
  ) {}

  async list(workspaceId: WorkspaceId): Promise<RepositorySummary[]> {
    const { password: token } = await this.access.credential(workspaceId);
    const found: RepositorySummary[] = [];

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const listed = await this.page(token, page);

      found.push(
        ...listed.flatMap((name) =>
          nonEmpty(name) ? [{ fullName: name }] : [],
        ),
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
      throw new UpstreamError(
        'GitHub would not list the repositories',
        `${response.status}`,
      );
    }

    const listed = LISTED.parse(await response.json());

    return (listed.repositories ?? []).map((each) => each.full_name);
  }
}
