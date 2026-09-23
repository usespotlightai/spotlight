import type {
  Applied,
  AppliedConfigurationPort,
} from '@configuration/application/ports/applied-configuration.port';
import { SKILLS_UNDER } from '@configuration/infrastructure/configuration-files';
import { teamConfig } from '@configuration/infrastructure/persistence/drizzle/schemas/configuration.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { eq } from 'drizzle-orm';

@Injectable()
export class DrizzleAppliedConfigurationReader
  implements AppliedConfigurationPort
{
  constructor(private readonly context: DrizzleContext) {}

  async of(teamId: TeamId): Promise<Applied> {
    const [found] = await this.context.db
      .select({ files: teamConfig.files })
      .from(teamConfig)
      .where(eq(teamConfig.teamId, teamId.value))
      .limit(1);

    return {
      teamId,
      skills: (found?.files ?? [])
        .map((each) => ConfigurationFile.of(each.path, each.text))
        .filter((each) => each.isUnder(SKILLS_UNDER)),
    };
  }
}
