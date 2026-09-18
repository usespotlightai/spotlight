import { ConfigurationRead } from '@configuration/domain/events/configuration-read.event';
import { InvalidConfigurationError } from '@configuration/domain/exceptions/invalid-configuration.error';
import type { Commit } from '@configuration/domain/value-objects/commit.vo';
import type { ConfiguredIntegration } from '@configuration/domain/value-objects/configured-integration.vo';
import { EventRecorder } from '@shared-kernel/domain/aggregates/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface Assessment {
  readonly problems: readonly ConfigurationProblem[];
  readonly integrations: readonly ConfiguredIntegration[];
}

interface State {
  readonly teamId: TeamId;
  readonly repository: Repository;
  readonly commit: Commit;
  readonly files: readonly ConfigurationFile[];
  readonly begunAt: Date;
  readonly readAt: Date;
  readonly assessment: Assessment | null;
}

const holdsEachPathOnce = (files: readonly ConfigurationFile[]): boolean => {
  const paths = files.map((each) => each.path);

  return new Set(paths).size === paths.length;
};

const listsEachSourceOnce = (
  integrations: readonly ConfiguredIntegration[],
): boolean => {
  const sources = integrations.map((each) => each.source);

  return new Set(sources).size === sources.length;
};

export class TeamConfiguration extends EventRecorder {
  private constructor(private readonly state: State) {
    super();
  }

  static read(input: {
    workspaceId: WorkspaceId;
    teamId: TeamId;
    repository: Repository;
    commit: Commit;
    files: readonly ConfigurationFile[];
    begunAt: Date;
    readAt: Date;
  }): TeamConfiguration {
    if (!holdsEachPathOnce(input.files)) {
      throw new InvalidConfigurationError(
        'holds one path twice, and a path is one file',
      );
    }

    if (input.readAt < input.begunAt) {
      throw new InvalidConfigurationError('was read before its reading began');
    }

    const reading = new TeamConfiguration({
      teamId: input.teamId,
      repository: input.repository,
      commit: input.commit,
      files: input.files,
      begunAt: input.begunAt,
      readAt: input.readAt,
      assessment: null,
    });

    reading.record(
      new ConfigurationRead(
        input.workspaceId,
        input.teamId,
        input.commit,
        input.files,
      ),
    );

    return reading;
  }

  static rehydrate(input: {
    teamId: TeamId;
    repository: Repository;
    commit: Commit;
    files: readonly ConfigurationFile[];
    begunAt: Date;
    readAt: Date;
    problems: readonly ConfigurationProblem[];
    integrations: readonly ConfiguredIntegration[];
  }): TeamConfiguration {
    if (!holdsEachPathOnce(input.files)) {
      throw new InconsistentStateError(
        'team configuration',
        'holds one path twice',
      );
    }

    if (!listsEachSourceOnce(input.integrations)) {
      throw new InconsistentStateError(
        'team configuration',
        'lists one integration twice',
      );
    }

    if (input.readAt < input.begunAt) {
      throw new InconsistentStateError(
        'team configuration',
        'was read before its reading began',
      );
    }

    return new TeamConfiguration({
      teamId: input.teamId,
      repository: input.repository,
      commit: input.commit,
      files: input.files,
      begunAt: input.begunAt,
      readAt: input.readAt,
      assessment: {
        problems: input.problems,
        integrations: input.integrations,
      },
    });
  }

  get teamId(): TeamId {
    return this.state.teamId;
  }

  get repository(): Repository {
    return this.state.repository;
  }

  get commit(): Commit {
    return this.state.commit;
  }

  get files(): readonly ConfigurationFile[] {
    return this.state.files;
  }

  get begunAt(): Date {
    return this.state.begunAt;
  }

  get readAt(): Date {
    return this.state.readAt;
  }

  get isAssessed(): boolean {
    return this.state.assessment !== null;
  }

  get problems(): readonly ConfigurationProblem[] {
    return this.state.assessment?.problems ?? [];
  }

  get integrations(): readonly ConfiguredIntegration[] {
    return this.state.assessment?.integrations ?? [];
  }

  assessedWith(assessment: Assessment): TeamConfiguration {
    if (this.state.assessment !== null) {
      throw new InvalidConfigurationError(
        'was already assessed, and a reading is assessed once',
      );
    }

    if (!listsEachSourceOnce(assessment.integrations)) {
      throw new InvalidConfigurationError(
        'lists one integration twice, and a source is one integration',
      );
    }

    const unique = assessment.problems.filter(
      (each, at) =>
        assessment.problems.findIndex((other) => other.equals(each)) === at,
    );

    const assessed = new TeamConfiguration({
      ...this.state,
      assessment: { problems: unique, integrations: assessment.integrations },
    });

    assessed.inheritEvents(this);

    return assessed;
  }

  equals(other: TeamConfiguration): boolean {
    return this.teamId.equals(other.teamId);
  }
}
