import type { LineReaderPort } from '@application/ports/line-reader.port';
import type {
  OpenedPullRequestDto,
  PullRequestPort,
} from '@application/ports/pull-request.port';
import type { RepositoryContentsPort } from '@application/ports/repository-contents.port';
import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { CONFIGURATION_BRANCH } from '@domain/aggregates/team-configuration.aggregate';
import type { Workspace } from '@domain/aggregates/workspace.aggregate';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import type { Repository } from '@domain/value-objects/repository.vo';

const TITLE = 'Set up Spotlight';

const BODY = `Spotlight has been connected to this workspace. This pull request
describes the lines your team will run — their stations, the harness that works
each one, and the repositories they work in.

Everything here is read from this repository. Change a station's prompt, add
one, or move where a word takes a task, and Spotlight picks it up on the next
push to the default branch.

Nothing runs until this is merged: merging is what puts these lines on the
board.`;

/**
 * Opens the pull request that sets a team's configuration up, from the lines it
 * is given rather than the board. The board takes these on when the pull
 * request is merged and read back, the same way any later change does — so
 * nothing is written to the board here.
 */
export class SeedConfiguration {
  constructor(
    private readonly reader: LineReaderPort,
    private readonly contents: RepositoryContentsPort,
    private readonly pullRequests: PullRequestPort,
  ) {}

  /** Null where there is nowhere to write, or it already has configuration. */
  async seed(
    workspace: Workspace,
    into: Repository,
    lines: readonly AssemblyLine[],
  ): Promise<OpenedPullRequestDto | null> {
    const installation = GitHubInstallation.from(
      workspace.connectionTo(GitHubInstallation.SOURCE),
    );

    if (!installation) {
      return null;
    }

    const sha = await this.contents.headOf(installation, into);

    if (!sha) {
      return null;
    }

    const already = await this.contents.under({
      installation,
      repository: into,
      ref: sha,
      path: '.spotlight',
    });

    if (already.length > 0) {
      return null;
    }

    const files = lines.map((line) => this.reader.write(line));

    if (files.length === 0) {
      return null;
    }

    return this.pullRequests.propose({
      installation,
      repository: into,
      branch: CONFIGURATION_BRANCH,
      title: TITLE,
      body: BODY,
      message: TITLE,
      files,
    });
  }
}
