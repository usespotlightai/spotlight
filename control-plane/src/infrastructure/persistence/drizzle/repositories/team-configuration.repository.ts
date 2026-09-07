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

    return found ? toConfiguration(found) : null;
  }

  async all(): Promise<readonly TeamConfiguration[]> {
    const rows = await this.context.db.select().from(teamConfig);

    return rows.map(toConfiguration);
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

type Row = typeof teamConfig.$inferSelect;

const toConfiguration = (row: Row): TeamConfiguration =>
  TeamConfiguration.read({
    teamId: TeamId.of(row.teamId),
    repository: Repository.of(row.repository),
    commit: Commit.of(row.sha),
    files: row.files.map((each) => ConfigurationFile.of(each.path, each.text)),
    problems: row.problems.map((each) => ConfigurationProblem.of(each)),
    readAt: row.readAt,
  });
