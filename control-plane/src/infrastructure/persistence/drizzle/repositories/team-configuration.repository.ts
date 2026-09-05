import { TeamConfiguration } from '@domain/aggregates/team-configuration.aggregate';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import { Commit } from '@domain/value-objects/commit.vo';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { ConfigurationProblem } from '@domain/value-objects/configuration-problem.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { DrizzleContext } from '@infrastructure/persistence/drizzle/drizzle.context';
import { teamConfig } from '@infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

@Injectable()
export class DrizzleTeamConfiguration implements TeamConfigurationRepository {
  constructor(private readonly context: DrizzleContext) {}

  async findFor(teamId: TeamId): Promise<TeamConfiguration | null> {
    const [found] = await this.context.db
      .select()
      .from(teamConfig)
      .where(eq(teamConfig.teamId, teamId.value))
      .limit(1);

    if (!found) {
      return null;
    }

    return TeamConfiguration.read({
      teamId: TeamId.of(found.teamId),
      repository: Repository.of(found.repository),
      commit: Commit.of(found.sha),
      files: found.files.map((each) =>
        ConfigurationFile.of(each.path, each.text),
      ),
      problems: found.problems.map((each) => ConfigurationProblem.of(each)),
      readAt: found.readAt,
    });
  }

  async save(configuration: TeamConfiguration): Promise<void> {
    const written = {
      repository: configuration.repository.value,
      sha: configuration.commit.value,
      files: configuration.files.map((each) => ({
        path: each.path,
        text: each.text,
      })),
      problems: configuration.problems.map((each) => ({
        path: each.path,
        at: each.at,
        reason: each.reason,
      })),
      readAt: configuration.readAt,
    };

    await this.context.db
      .insert(teamConfig)
      .values({ teamId: configuration.teamId.value, ...written })
      .onConflictDoUpdate({
        target: teamConfig.teamId,
        set: written,
      });
  }
}
