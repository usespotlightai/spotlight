import type {
  ConfigurationReaderPort,
  ConfigurationView,
} from '@configuration/application/ports/configuration-reader.port';
import {
  configurationHome,
  teamConfig,
} from '@configuration/infrastructure/persistence/drizzle/schemas/configuration.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { eq } from 'drizzle-orm';

@Injectable()
export class DrizzleConfigurationReader implements ConfigurationReaderPort {
  constructor(private readonly context: DrizzleContext) {}

  async of(teamId: TeamId): Promise<ConfigurationView> {
    const [[home], [read]] = await Promise.all([
      this.context.db
        .select({
          keptIn: configurationHome.keptIn,
          movingTo: configurationHome.movingTo,
        })
        .from(configurationHome)
        .where(eq(configurationHome.teamId, teamId.value))
        .limit(1),
      this.context.db
        .select({
          repository: teamConfig.repository,
          sha: teamConfig.sha,
          integrations: teamConfig.integrations,
        })
        .from(teamConfig)
        .where(eq(teamConfig.teamId, teamId.value))
        .limit(1),
    ]);

    return {
      keptIn: home?.keptIn ?? null,
      movingTo: home?.movingTo ?? null,
      read: read ?? null,
    };
  }
}
