import type {
  OpenedPullRequestDto,
  PullRequestOpening,
  PullRequestPort,
  PullRequestProposal,
} from '@application/ports/pull-request.port';
import {
  REPOSITORY_ACCESS,
  type RepositoryAccessPort,
} from '@application/ports/repository-access.port';
import { UpstreamRefusedError } from '@domain/exceptions/upstream-refused.error';
import type { Repository } from '@domain/value-objects/repository.vo';
import { answered, call, sending } from '@infrastructure/github/github.rest';
import { Inject, Injectable } from '@nestjs/common';

/** An ordinary file, which is all Spotlight ever writes. */
const FILE = '100644';

const NOT_FOUND = 404;

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

    // Branched from where it will be merged, so the diff is only ours.
    const from = await this.headOf(proposal.repository, into, token);

    if (!from) {
      throw new UpstreamRefusedError(
        `branching from ${into}`,
        `${proposal.repository.value} has no such branch`,
      );
    }

    // Written on top of the branch where one is already open, so proposing
    // again amends the pull request rather than losing what it carried.
    const standing = await this.headOf(
      proposal.repository,
      proposal.branch,
      token,
    );

    const commit = await this.commit(proposal, token, standing ?? from);

    await this.pointBranchAt(proposal, token, commit, standing !== null);

    // A branch already open has a pull request already open with it. GitHub
    // refuses a second, and the first now carries the new commit anyway.
    const already = await this.pullRequestFor(proposal, token, into);

    return already ?? this.pullRequest(proposal, token, into);
  }

  /** One commit holding every file, so the branch is never half written. */
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

    const tree = await answered<Named>(
      await call(
        `${at}/git/trees`,
        token,
        sending({ base_tree: parent, tree: blobs }),
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
          body: JSON.stringify({ sha: commit }),
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

  /** Where a branch stands, or nothing where the repository has no such one. */
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
    proposal: PullRequestProposal,
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
    const opened = await answered<Opened>(
      await call(
        `${this.at(opening.repository)}/pulls`,
        token,
        sending({
          title: opening.title,
          body: opening.body,
          head: opening.branch,
          base: into,
        }),
      ),
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
    const { password } = await this.access.credential(opening.installation);

    return password;
  }
}
