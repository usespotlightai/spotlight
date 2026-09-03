import type { LineReaderPort } from '@application/ports/line-reader.port';
import type {
  OpenedPullRequestDto,
  PullRequestPort,
} from '@application/ports/pull-request.port';
import type { RepositoryContentsPort } from '@application/ports/repository-contents.port';
import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { Team } from '@domain/aggregates/team.aggregate';
import type { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import type { Repository } from '@domain/value-objects/repository.vo';

/** One branch for configuration, written on again rather than beside. */
const BRANCH = 'spotlight/configuration';

export type WrittenBack =
  | { readonly kind: 'proposed'; readonly url: string }
  /** Nowhere to write it: no host, or nothing read from anywhere yet. */
  | { readonly kind: 'nowhere' }
  /** The repository moved under the change; it was read again first. */
  | { readonly kind: 'moved' };

/**
 * A change made on the board, written back to the repository that holds the
 * workspace's configuration.
 *
 * It goes as a pull request rather than a commit, because that is what the
 * board's own words are worth once they are code: something to be read before
 * it is true. Until it is merged, the board and the repository disagree, and
 * the board is the one that is ahead.
 *
 * Written through the same renderer that wrote the opening pull request, and
 * read back by the same reading a push goes through. There is one description
 * of a line in this system, and this is it in the other direction.
 */
export class WriteBackLine {
  constructor(
    private readonly configurations: TeamConfigurationRepository,
    private readonly reader: LineReaderPort,
    private readonly contents: RepositoryContentsPort,
    private readonly pullRequests: PullRequestPort,
  ) {}

  async write(
    workspace: Workspace,
    team: Team,
    line: AssemblyLine,
  ): Promise<WrittenBack> {
    const installation = GitHubInstallation.from(
      workspace.connectionTo(GitHubInstallation.SOURCE),
    );

    const applied = await this.configurations.findFor(team.id);

    // Nothing has ever been read, so there is nowhere this belongs yet. The
    // pull request that opens configuration is what makes somewhere.
    if (!installation || !applied) {
      return { kind: 'nowhere' };
    }

    const repository = applied.repository;
    const standing = await this.contents.headOf(installation, repository);

    // Somebody else moved it while this was being edited. Said rather than
    // written over: what is in the repository now has not been looked at.
    if (standing && standing !== applied.commit.value) {
      return { kind: 'moved' };
    }

    const { url } = await this.propose(installation, repository, line);

    return { kind: 'proposed', url };
  }

  private propose(
    installation: GitHubInstallation,
    repository: Repository,
    line: AssemblyLine,
  ): Promise<OpenedPullRequestDto> {
    const written = this.reader.write(line);

    return this.pullRequests.propose({
      installation,
      repository,
      branch: BRANCH,
      title: `Update ${line.name.value}`,
      body: `${line.name.value} was changed on the board. This is that change, as the file describes it.`,
      message: `Update ${line.name.value}`,
      files: [written],
    });
  }
}
