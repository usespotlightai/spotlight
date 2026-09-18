import type {
  OpenedPullRequestDto,
  PullRequestOpening,
  PullRequestPort,
  PullRequestProposal,
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
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const FILE = '100644';

const NOT_FOUND = 404;

const UNPROCESSABLE = 422;

interface Opened {
  readonly html_url?: string;
}

interface Named {
  readonly sha?: string;
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

  async propose(proposal: PullRequestProposal): Promise<OpenedPullRequestDto> {
    if (proposal.files.length === 0) {
      throw new UpstreamRefusedError(
        'opening a pull request',
        'it would change nothing',
      );
    }

    const token = await this.tokenFor(proposal);
    const into = await this.defaultBranch(proposal.repository, token);

    const from = await this.headOf(proposal.repository, into, token);

    if (!from) {
      throw new UpstreamRefusedError(
        `branching from ${into}`,
        `${proposal.repository.value} has no such branch`,
      );
    }

    const standing = await this.headOf(
      proposal.repository,
      proposal.branch,
      token,
    );

    const already = standing
      ? await this.pullRequestFor(proposal, token, into)
      : null;

    const commit = await this.commit(
      proposal,
      token,
      already && standing ? standing : from,
    );

    await this.pointBranchAt(proposal, token, commit, standing !== null);

    return already ?? this.pullRequest(proposal, token, into);
  }

  async openFor(
    workspaceId: WorkspaceId,
    repository: Repository,
    branch: string,
  ): Promise<OpenedPullRequestDto | null> {
    const { password: token } = await this.access.credential(workspaceId);

    return this.pullRequestFor(
      { repository, branch },
      token,
      await this.defaultBranch(repository, token),
    );
  }

  private async commit(
    proposal: PullRequestProposal,
    token: string,
    parent: string,
  ): Promise<string> {
    const at = this.at(proposal.repository);

    const blobs = await Promise.all(
      proposal.files.map(async (file) => ({
        path: file.path.replace(/^\/+/, ''),
        mode: FILE,
        type: 'blob',
        sha: (
          await answered<Named>(
            await call(
              `${at}/git/blobs`,
              token,
              sending({ content: file.text, encoding: 'utf-8' }),
            ),
            `GitHub would not write ${file.path}`,
          )
        ).sha,
      })),
    );

    const taken = (proposal.removes ?? []).map((path) => ({
      path: path.replace(/^\/+/, ''),
      mode: FILE,
      type: 'blob',
      sha: null,
    }));

    const tree = await answered<Named>(
      await call(
        `${at}/git/trees`,
        token,
        sending({ base_tree: parent, tree: [...blobs, ...taken] }),
      ),
      'GitHub would not lay out the change',
    );

    const written = await answered<Named>(
      await call(
        `${at}/git/commits`,
        token,
        sending({
          message: proposal.message,
          tree: tree.sha,
          parents: [parent],
        }),
      ),
      'GitHub would not write the commit',
    );

    if (!written.sha) {
      throw new UpstreamRefusedError(
        'writing the commit',
        'GitHub named no commit',
      );
    }

    return written.sha;
  }

  private async pointBranchAt(
    proposal: PullRequestProposal,
    token: string,
    commit: string,
    standing: boolean,
  ): Promise<void> {
    const at = this.at(proposal.repository);

    const response = standing
      ? await call(`${at}/git/refs/heads/${proposal.branch}`, token, {
          method: 'PATCH',
          body: JSON.stringify({ sha: commit, force: true }),
        })
      : await call(
          `${at}/git/refs`,
          token,
          sending({ ref: `refs/heads/${proposal.branch}`, sha: commit }),
        );

    await answered<Named>(
      response,
      `GitHub would not move ${proposal.branch} to the commit`,
    );
  }

  private async headOf(
    repository: Repository,
    branch: string,
    token: string,
  ): Promise<string | null> {
    const response = await call(
      `${this.at(repository)}/git/ref/heads/${encodeURIComponent(branch)}`,
      token,
    );

    if (response.status === NOT_FOUND) {
      return null;
    }

    const found = await answered<{ object?: Named }>(
      response,
      `GitHub would not say where ${branch} stands`,
    );

    if (!found.object?.sha) {
      throw new UpstreamRefusedError(
        `reading ${branch}`,
        'GitHub named no commit',
      );
    }

    return found.object.sha;
  }

  private async pullRequestFor(
    proposal: Pick<PullRequestProposal, 'repository' | 'branch'>,
    token: string,
    into: string,
  ): Promise<OpenedPullRequestDto | null> {
    const open = await answered<Opened[]>(
      await call(
        `${this.at(proposal.repository)}/pulls?state=open&base=${encodeURIComponent(into)}&head=${encodeURIComponent(`${proposal.repository.owner}:${proposal.branch}`)}`,
        token,
      ),
      `GitHub would not say what is open for ${proposal.branch}`,
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
