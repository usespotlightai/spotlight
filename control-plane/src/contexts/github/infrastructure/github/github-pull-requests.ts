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
import { InvalidPullRequestError } from '@shared-kernel/domain/exceptions/invalid-pull-request.error';
import { UpstreamRefusedError } from '@shared-kernel/domain/exceptions/upstream-refused.error';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const UNPROCESSABLE = 422;

const FILES_PER_PAGE = 100;

const MOST_CHANGED = 3_000;

interface Opened {
  readonly html_url?: string;
}

interface ChangedFile {
  readonly filename?: string;
}

interface Compared {
  readonly files?: ChangedFile[];
}

@Injectable()
export class GitHubPullRequests implements PullRequestPort {
  constructor(
    @Inject(REPOSITORY_ACCESS)
    private readonly access: RepositoryAccessPort,
  ) {}

  async open(opening: PullRequestOpening): Promise<OpenedPullRequestDto> {
    const token = await this.tokenFor(opening.workspaceId);

    return this.pullRequest(
      opening,
      token,
      await this.defaultBranch(opening.repository, token),
    );
  }

  async changedOn(
    workspaceId: WorkspaceId,
    repository: Repository,
    branch: string,
  ): Promise<readonly string[]> {
    const token = await this.tokenFor(workspaceId);
    const base = await this.defaultBranch(repository, token);

    return this.paged(
      (page) =>
        `${this.at(repository)}/compare/${encodeURI(base)}...${encodeURI(branch)}?per_page=${FILES_PER_PAGE}&page=${page}`,
      token,
      async (response) =>
        (
          await answered<Compared>(
            response,
            `GitHub would not compare ${branch} with ${base}`,
          )
        ).files ?? [],
    );
  }

  async changedIn(
    workspaceId: WorkspaceId,
    repository: Repository,
    pullRequest: PullRequestUrl,
  ): Promise<readonly string[]> {
    const number = pullRequest.number;

    if (number === null) {
      throw new InvalidPullRequestError(
        `at ${pullRequest.value} is not a GitHub pull request`,
      );
    }

    const token = await this.tokenFor(workspaceId);

    return this.paged(
      (page) =>
        `${this.at(repository)}/pulls/${number}/files?per_page=${FILES_PER_PAGE}&page=${page}`,
      token,
      (response) =>
        answered<ChangedFile[]>(
          response,
          `GitHub would not say what ${pullRequest.value} changes`,
        ),
    );
  }

  private async paged(
    pageAt: (page: number) => string,
    token: string,
    filesIn: (response: Response) => Promise<ChangedFile[]>,
  ): Promise<readonly string[]> {
    const changed = new Set<string>();

    for (let page = 1; changed.size < MOST_CHANGED; page += 1) {
      const files = await filesIn(await call(pageAt(page), token));
      const before = changed.size;

      for (const file of files) {
        if (file.filename) {
          changed.add(file.filename);
        }
      }

      if (files.length < FILES_PER_PAGE || changed.size === before) {
        break;
      }
    }

    return [...changed].slice(0, MOST_CHANGED);
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
    const found = await answered<{ default_branch: string }>(
      await call(this.at(repository), token),
      `GitHub would not say what ${repository.value} merges into`,
    );

    return found.default_branch;
  }

  private at(repository: Repository): string {
    return `/repos/${repository.owner}/${repository.name}`;
  }

  private async tokenFor(workspaceId: WorkspaceId): Promise<string> {
    const { password } = await this.access.credential(workspaceId);

    return password;
  }
}
