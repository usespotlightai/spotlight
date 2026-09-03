import type { LineReaderPort } from '@application/ports/line-reader.port';
import type { LoggerPort } from '@application/ports/logger.port';
import type {
  OpenedPullRequestDto,
  PullRequestPort,
} from '@application/ports/pull-request.port';
import type { RepositoryContentsPort } from '@application/ports/repository-contents.port';
import type { Team } from '@domain/aggregates/team.aggregate';
import type { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import type { Repository } from '@domain/value-objects/repository.vo';

/** The branch the opening pull request is written on, and written on again. */
const BRANCH = 'spotlight/configuration';

const TITLE = 'Set up Spotlight';

const BODY = `Spotlight has been connected to this workspace, and this is what it
currently runs, written down.

Everything here is now read from this repository. Change a station's prompt,
add one, or move where a word takes a task, and Spotlight picks it up on the
next push to the default branch.

Nothing changes until this is merged: what is on the board today is exactly
what this describes.`;

/**
 * Writes down what a workspace already runs, as the pull request that opens
 * its configuration.
 *
 * The point is not the pull request. It is that what Spotlight generates is
 * what Spotlight reads: the same renderer the board writes back through, and
 * the same reading a push goes through. A workspace that merges this has
 * changed nothing, which is what makes it safe to merge.
 */
export class SeedConfiguration {
  constructor(
    private readonly lines: AssemblyLineRepository,
    private readonly reader: LineReaderPort,
    private readonly contents: RepositoryContentsPort,
    private readonly pullRequests: PullRequestPort,
    private readonly logger: LoggerPort,
  ) {}

  /**
   * Null where there is nowhere to write, or where the repository already
   * has configuration: opening a pull request over somebody's own files is
   * not a welcome, it is a mess.
   */
  async seed(
    workspace: Workspace,
    team: Team,
    into: Repository,
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

    const files = (await this.lines.ofTeam(team.id)).map((line) =>
      this.reader.write(line),
    );

    if (files.length === 0) {
      return null;
    }

    return this.pullRequests.propose({
      installation,
      repository: into,
      branch: BRANCH,
      title: TITLE,
      body: BODY,
      message: TITLE,
      files,
    });
  }

  /** The same, but a failure to write is not a failure to connect. */
  async trySeed(
    workspace: Workspace,
    team: Team,
    into: Repository,
  ): Promise<OpenedPullRequestDto | null> {
    try {
      return await this.seed(workspace, team, into);
    } catch (error) {
      this.logger.error(
        { err: error, repository: into.value },
        'Opening the pull request that sets Spotlight up',
      );

      return null;
    }
  }
}
