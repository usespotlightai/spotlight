import { InvalidConfigurationError } from '@domain/exceptions/invalid-configuration.error';
import type { Commit } from '@domain/value-objects/commit.vo';
import type { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import type { ConfigurationProblem } from '@domain/value-objects/configuration-problem.vo';
import type { Repository } from '@domain/value-objects/repository.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';

/** Where a team keeps what it tells Spotlight about itself. */
export const KEPT_UNDER = '.spotlight';

export const INTEGRATIONS_UNDER = `${KEPT_UNDER}/integrations`;

export const LINES_UNDER = `${KEPT_UNDER}/lines`;

/** Where one line's file sits, so it is written back over itself. */
export const linePath = (lineKey: string): string =>
  `${LINES_UNDER}/${lineKey}.yml`;

/**
 * What a team told Spotlight about itself, as it last read.
 *
 * One team has one of these, so its identity is the team's. It is
 * a reading rather than a state: a commit, the files that were at it, and
 * everything that would not read. All three are kept together because they
 * are only true together — problems belong to the commit they were found in,
 * and a later reading replaces the lot.
 *
 * A reading with problems in it is still a reading. What would not read is
 * simply not running, while everything beside it is; the alternative is a
 * workspace whose whole line stops because one file has a typo in it.
 */
export class TeamConfiguration {
  private constructor(
    readonly teamId: TeamId,
    readonly repository: Repository,
    readonly commit: Commit,
    readonly files: readonly ConfigurationFile[],
    readonly problems: readonly ConfigurationProblem[],
    readonly readAt: Date,
  ) {}

  static read(input: {
    teamId: TeamId;
    repository: Repository;
    commit: Commit;
    files: readonly ConfigurationFile[];
    problems?: readonly ConfigurationProblem[];
    readAt: Date;
  }): TeamConfiguration {
    const paths = input.files.map((each) => each.path);

    // One path, one file. Two would leave which of them is running to
    // whichever order they happened to arrive in.
    if (new Set(paths).size !== paths.length) {
      throw new InvalidConfigurationError(
        'holds one path twice, and a path is one file',
      );
    }

    return new TeamConfiguration(
      input.teamId,
      input.repository,
      input.commit,
      input.files,
      input.problems ?? [],
      input.readAt,
    );
  }

  /** Everything a workspace wrote read cleanly. */
  get isWhole(): boolean {
    return this.problems.length === 0;
  }

  /** Nothing was written yet, which is not the same as nothing reading. */
  get isEmpty(): boolean {
    return this.kept.length === 0;
  }

  /** The files that are Spotlight's to read, and none of the rest. */
  get kept(): readonly ConfigurationFile[] {
    return this.files.filter((each) => each.isUnder(KEPT_UNDER));
  }

  /** Those beneath one directory of it, which is how each kind is found. */
  under(directory: string): readonly ConfigurationFile[] {
    return this.files.filter((each) => each.isUnder(directory) && each.isYaml);
  }

  problemsIn(path: string): readonly ConfigurationProblem[] {
    return this.problems.filter((each) => each.isIn(path));
  }

  /**
   * Whether this reading is of something newer than another's. A repository
   * that moved is a reason to read again; one that has not is not.
   */
  supersedes(other: TeamConfiguration | null): boolean {
    return (
      other === null ||
      !this.repository.equals(other.repository) ||
      !this.commit.equals(other.commit)
    );
  }

  /** The same reading, with what a later look found wrong. */
  withProblems(problems: readonly ConfigurationProblem[]): TeamConfiguration {
    return new TeamConfiguration(
      this.teamId,
      this.repository,
      this.commit,
      this.files,
      [...this.problems, ...problems],
      this.readAt,
    );
  }

  equals(other: TeamConfiguration): boolean {
    return this.teamId.equals(other.teamId);
  }
}
