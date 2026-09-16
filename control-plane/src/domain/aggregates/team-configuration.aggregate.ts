import { InvalidConfigurationError } from '@domain/exceptions/invalid-configuration.error';
import type { Commit } from '@domain/value-objects/commit.vo';
import type { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import type { ConfigurationProblem } from '@domain/value-objects/configuration-problem.vo';
import type { Repository } from '@domain/value-objects/repository.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';

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

  get isWhole(): boolean {
    return this.problems.every((each) => each.isWarning);
  }

  get isEmpty(): boolean {
    return this.files.length === 0;
  }

  problemsIn(path: string): readonly ConfigurationProblem[] {
    return this.problems.filter((each) => each.isIn(path));
  }

  supersedes(other: TeamConfiguration | null): boolean {
    return (
      other === null ||
      !this.repository.equals(other.repository) ||
      !this.commit.equals(other.commit)
    );
  }

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
