import type {
  ConfigurationReaderPort,
  ConfigurationView,
} from '@configuration/application/ports/configuration-reader.port';
import { teamConfig } from '@configuration/infrastructure/persistence/drizzle/schemas/configuration.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { eq } from 'drizzle-orm';

@Injectable()
export class DrizzleConfigurationReader implements ConfigurationReaderPort {
  constructor(private readonly context: DrizzleContext) {}

  async of(teamId: TeamId): Promise<ConfigurationView> {
    const [read] = await this.context.db
      .select({ integrations: teamConfig.integrations })
      .from(teamConfig)
      .where(eq(teamConfig.teamId, teamId.value))
      .limit(1);

    return { integrations: read?.integrations ?? [] };
  }
}
