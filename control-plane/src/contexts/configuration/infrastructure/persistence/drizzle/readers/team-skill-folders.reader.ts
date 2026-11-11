import type { TeamSkillFoldersPort } from '@configuration/application/ports/skill-folders.port';
import type { SkillFolder } from '@configuration/domain/aggregates/skill-definition.aggregate';
import { skillDefinition } from '@configuration/infrastructure/persistence/drizzle/schemas/configuration.schema';
import { storedSkillOf } from '@configuration/infrastructure/persistence/drizzle/skill-definition-rows';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { asc, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleTeamSkillFolders implements TeamSkillFoldersPort {
  constructor(private readonly context: DrizzleContext) {}

  async of(teamId: TeamId): Promise<readonly SkillFolder[]> {
    const rows = await this.context.db
      .select()
      .from(skillDefinition)
      .where(eq(skillDefinition.teamId, teamId.value))
      .orderBy(asc(skillDefinition.key));

    return rows.map(storedSkillOf);
  }
}
