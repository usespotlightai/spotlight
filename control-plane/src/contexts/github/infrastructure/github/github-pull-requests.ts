import type {
  OpenedPullRequestDto,
  PullRequestAt,
  PullRequestEditing,
  PullRequestOpening,
  PullRequestPort,
  PullRequestStatusDto,
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
import { UpstreamError } from '@shared-kernel/domain/exceptions/upstream.error';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const UNPROCESSABLE = 422;

const FILES_PER_PAGE = 100;

const MAX_CHANGED = 3_000;

interface Opened {
  readonly html_url?: string;
  readonly number?: number;
  readonly id?: number;
  readonly state?: string;
  readonly merged?: boolean;
  readonly merged_at?: string | null;
  readonly closed_at?: string | null;
  readonly base?: { readonly repo?: { readonly full_name?: string } };
}

const openedOf = (opened: Opened | undefined): OpenedPullRequestDto | null => {
  const repository = opened?.base?.repo?.full_name;

  return opened?.html_url && opened.number && opened.id && repository
    ? {
        url: opened.html_url,
        number: opened.number,
        id: opened.id,
        repository,
      }
    : null;
};

const dateOf = (raw: string | null | undefined): Date | null =>
  raw ? new Date(raw) : null;

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

  async edit(editing: PullRequestEditing): Promise<void> {
    const repository = editing.pullRequest.repository;
    const number = editing.pullRequest.number;

    if (repository === null || number === null) {
      throw new InvalidPullRequestError(
        `at ${editing.pullRequest.value} is not a GitHub pull request`,
      );
    }

    await answered(
      await call(
        `${this.at(repository)}/pulls/${number}`,
        await this.tokenFor(editing.workspaceId),
        {
          ...sending({
            title: editing.title,
            ...(editing.body === null ? {} : { body: editing.body }),
          }),
          method: 'PATCH',
        },
      ),
      `GitHub would not edit ${editing.pullRequest.value}`,
    );
  }

  async statusOf(at: PullRequestAt): Promise<PullRequestStatusDto> {
    const found = await answered<Opened>(
      await call(
        `${this.at(at.repository)}/pulls/${at.number}`,
        await this.tokenFor(at.workspaceId),
      ),
      `GitHub would not return ${at.repository.value}#${at.number}`,
    );

    if (found.merged) {
      return { state: 'merged', closedAt: dateOf(found.merged_at) };
    }

    return found.state === 'closed'
      ? { state: 'closed', closedAt: dateOf(found.closed_at) }
      : { state: 'open', closedAt: null };
  }

  async close(at: PullRequestAt): Promise<void> {
    await answered(
      await call(
        `${this.at(at.repository)}/pulls/${at.number}`,
        await this.tokenFor(at.workspaceId),
        { ...sending({ state: 'closed' }), method: 'PATCH' },
      ),
      `GitHub would not close ${at.repository.value}#${at.number}`,
    );
  }

  async comment(at: PullRequestAt, body: string): Promise<void> {
    await answered(
      await call(
        `${this.at(at.repository)}/issues/${at.number}/comments`,
        await this.tokenFor(at.workspaceId),
        sending({ body }),
      ),
      `GitHub would not comment on ${at.repository.value}#${at.number}`,
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
          `GitHub would not list the files that ${pullRequest.value} changes`,
        ),
    );
  }

  private async paged(
    pageAt: (page: number) => string,
    token: string,
    filesIn: (response: Response) => Promise<ChangedFile[]>,
  ): Promise<readonly string[]> {
    const changed = new Set<string>();

    for (let page = 1; changed.size < MAX_CHANGED; page += 1) {
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

    return [...changed].slice(0, MAX_CHANGED);
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
      `GitHub would not list the open pull requests for ${opening.branch}`,
    );

    return openedOf(open[0]);
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

    const opened = openedOf(
      await answered<Opened>(
        response,
        'GitHub would not open the pull request',
      ),
    );

    if (!opened) {
      throw new UpstreamError(
        'GitHub would not open the pull request',
        'The answer had no pull request URL, number, id or repository',
      );
    }

    return opened;
  }

  private async defaultBranch(
    repository: Repository,
    token: string,
  ): Promise<string> {
    const found = await answered<{ default_branch: string }>(
      await call(this.at(repository), token),
      `GitHub would not return the default branch of ${repository.value}`,
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
