import { InvalidConfigurationError } from '@domain/exceptions/invalid-configuration.error';
import type { Commit } from '@domain/value-objects/commit.vo';
import type { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import type { ConfigurationProblem } from '@domain/value-objects/configuration-problem.vo';
import type { Repository } from '@domain/value-objects/repository.vo';
import { SealedVault } from '@domain/value-objects/sealed-vault.vo';
import type { SkillKey } from '@domain/value-objects/skill-key.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';

export const KEPT_UNDER = '.spotlight';

export const INTEGRATIONS_UNDER = `${KEPT_UNDER}/integrations`;

export const LINES_UNDER = `${KEPT_UNDER}/lines`;

export const SKILLS_UNDER = `${KEPT_UNDER}/skills`;

export const SECRETS_VAULT = `${KEPT_UNDER}/secrets.vault`;

export const CONFIGURATION_BRANCH = 'spotlight/configuration';

export const LINE_FILE = 'line.yml';

export const STATIONS_UNDER = 'stations';

export const lineFolder = (lineKey: string): string =>
  `${LINES_UNDER}/${lineKey}`;

export const linePath = (lineKey: string): string =>
  `${lineFolder(lineKey)}/${LINE_FILE}`;

export const stationPath = (lineKey: string, stationKey: string): string =>
  `${lineFolder(lineKey)}/${STATIONS_UNDER}/${stationKey}.md`;

export const integrationPath = (source: string): string =>
  `${INTEGRATIONS_UNDER}/${source}.yml`;

export const skillFolder = (key: SkillKey): string =>
  `${SKILLS_UNDER}/${key.value}`;

export const SKILL_FILE = 'SKILL.md';

export const skillFile = (key: SkillKey): string =>
  `${skillFolder(key)}/${SKILL_FILE}`;

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
    return this.kept.length === 0;
  }

  get kept(): readonly ConfigurationFile[] {
    return this.files.filter((each) => each.isUnder(KEPT_UNDER));
  }

  get vault(): SealedVault | null {
    const file = this.files.find((each) => each.path === SECRETS_VAULT);

    return file ? SealedVault.of(file.text) : null;
  }

  under(directory: string): readonly ConfigurationFile[] {
    return this.files.filter((each) => each.isUnder(directory) && each.isYaml);
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
