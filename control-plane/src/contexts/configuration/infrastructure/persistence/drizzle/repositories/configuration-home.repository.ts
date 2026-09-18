import { ConfigurationHome } from '@configuration/domain/aggregates/configuration-home.aggregate';
import { ConfigurationHomeMovedOnError } from '@configuration/domain/exceptions/configuration-home-moved-on.error';
import type { ConfigurationHomeRepository } from '@configuration/domain/repositories/configuration-home.repository';
import { configurationHome } from '@configuration/infrastructure/persistence/drizzle/schemas/configuration.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleConfigurationHome implements ConfigurationHomeRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async find(teamId: TeamId): Promise<ConfigurationHome | null> {
    const [found] = await this.context.db
      .select()
      .from(configurationHome)
      .where(eq(configurationHome.teamId, teamId.value))
      .limit(1);

    return found
      ? ConfigurationHome.rehydrate({
          workspaceId: WorkspaceId.of(found.workspaceId),
          teamId: TeamId.of(found.teamId),
          keptIn: found.keptIn ? Repository.of(found.keptIn) : null,
          movingTo: found.movingTo ? Repository.of(found.movingTo) : null,
          version: found.version,
        })
      : null;
  }

  async save(home: ConfigurationHome): Promise<void> {
    await this.context.run(async () => {
      await this.stored(home);
      await this.events.dispatch(home.pullEvents());
    });
  }

  private async stored(home: ConfigurationHome): Promise<void> {
    const written = {
      keptIn: home.keptIn?.value ?? null,
      movingTo: home.movingTo?.value ?? null,
    };

    const kept = home.isNew
      ? await this.context.db
          .insert(configurationHome)
          .values({
            teamId: home.teamId.value,
            workspaceId: home.workspaceId.value,
            ...written,
          })
          .onConflictDoNothing({ target: configurationHome.teamId })
          .returning({ teamId: configurationHome.teamId })
      : await this.context.db
          .update(configurationHome)
          .set({ ...written, version: home.version + 1 })
          .where(
            and(
              eq(configurationHome.teamId, home.teamId.value),
              eq(configurationHome.version, home.version),
            ),
          )
          .returning({ teamId: configurationHome.teamId });

    if (kept.length === 0) {
      throw new ConfigurationHomeMovedOnError(home.teamId.value);
    }
  }
}
