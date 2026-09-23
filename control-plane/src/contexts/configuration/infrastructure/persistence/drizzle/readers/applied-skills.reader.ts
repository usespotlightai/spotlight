import type {
  Applied,
  AppliedConfigurationPort,
} from '@configuration/application/ports/applied-configuration.port';
import { SKILLS_UNDER } from '@configuration/infrastructure/configuration-files';
import { skillDefinition } from '@configuration/infrastructure/persistence/drizzle/schemas/configuration.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { asc, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleAppliedSkills implements AppliedConfigurationPort {
  constructor(private readonly context: DrizzleContext) {}

  async of(teamId: TeamId): Promise<Applied> {
    const kept = await this.context.db
      .select({ key: skillDefinition.key, files: skillDefinition.files })
      .from(skillDefinition)
      .where(eq(skillDefinition.teamId, teamId.value))
      .orderBy(asc(skillDefinition.key));

    return {
      teamId,
      skills: kept.flatMap(({ key, files }) =>
        Object.entries(files).map(([path, text]) =>
          ConfigurationFile.of(`${SKILLS_UNDER}/${key}/${path}`, text),
        ),
      ),
    };
  }
}
