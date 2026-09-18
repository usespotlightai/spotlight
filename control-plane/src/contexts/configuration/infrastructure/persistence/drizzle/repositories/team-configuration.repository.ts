import { TeamConfiguration } from '@configuration/domain/aggregates/team-configuration.aggregate';
import type {
  Keeping,
  TeamConfigurationRepository,
} from '@configuration/domain/repositories/team-configuration.repository';
import { Commit } from '@configuration/domain/value-objects/commit.vo';
import { ConfiguredIntegration } from '@configuration/domain/value-objects/configured-integration.vo';
import { teamConfig } from '@configuration/infrastructure/persistence/drizzle/schemas/configuration.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { eq, sql } from 'drizzle-orm';

@Injectable()
export class DrizzleTeamConfiguration implements TeamConfigurationRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async findFor(teamId: TeamId): Promise<TeamConfiguration | null> {
    const [found] = await this.context.db
      .select()
      .from(teamConfig)
      .where(eq(teamConfig.teamId, teamId.value))
      .limit(1);

    return found ? toConfiguration(found) : null;
  }

  async save(configuration: TeamConfiguration): Promise<Keeping> {
    return this.context.run(async () => {
      const events = configuration.pullEvents();

      if (!(await this.stored(configuration))) {
        return 'superseded';
      }

      await this.events.dispatch(events);

      return 'kept';
    });
  }

  private async stored(configuration: TeamConfiguration): Promise<boolean> {
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
        severity: each.severity,
      })),
      integrations: configuration.integrations.map((each) => ({
        source: each.source,
        name: each.name,
        path: each.path,
        connectable: each.connectable,
      })),
      begunAt: configuration.begunAt,
      readAt: configuration.readAt,
    };

    const kept = await this.context.db
      .insert(teamConfig)
      .values({ teamId: configuration.teamId.value, ...written })
      .onConflictDoUpdate({
        target: teamConfig.teamId,
        set: written,
        setWhere: sql`${teamConfig.begunAt} < excluded.begun_at`,
      })
      .returning({ teamId: teamConfig.teamId });

    return kept.length > 0;
  }
}

type Row = typeof teamConfig.$inferSelect;

const toConfiguration = (row: Row): TeamConfiguration =>
  TeamConfiguration.rehydrate({
    teamId: TeamId.of(row.teamId),
    repository: Repository.of(row.repository),
    commit: Commit.of(row.sha),
    files: row.files.map((each) => ConfigurationFile.of(each.path, each.text)),
    problems: row.problems.map((each) => ConfigurationProblem.of(each)),
    integrations: row.integrations.map((each) =>
      ConfiguredIntegration.of(each),
    ),
    begunAt: row.begunAt,
    readAt: row.readAt,
  });
