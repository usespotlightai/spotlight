import type {
  SkillRecord,
  SkillResourcesPort,
} from '@configuration/application/ports/skill-resources.port';
import type { DefinedSkillKey } from '@configuration/domain/value-objects/defined-skill-key.vo';
import { SkillDefinitionId } from '@configuration/domain/value-objects/skill-definition-id.vo';
import { skillDefinition } from '@configuration/infrastructure/persistence/drizzle/schemas/configuration.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { and, eq, type SQL } from 'drizzle-orm';

const SKILL_COLUMNS = {
  id: skillDefinition.id,
  version: skillDefinition.version,
  teamId: skillDefinition.teamId,
  key: skillDefinition.key,
  files: skillDefinition.files,
};

@Injectable()
export class DrizzleSkillResources implements SkillResourcesPort {
  constructor(private readonly context: DrizzleContext) {}

  withId(id: SkillDefinitionId): Promise<SkillRecord | null> {
    return this.stored(eq(skillDefinition.id, id.value));
  }

  at(teamId: TeamId, key: DefinedSkillKey): Promise<SkillRecord | null> {
    return this.stored(
      and(
        eq(skillDefinition.teamId, teamId.value),
        eq(skillDefinition.key, key.value),
      ),
    );
  }

  async ofTeam(teamId: TeamId): Promise<readonly SkillRecord[]> {
    const found = await this.context.db
      .select(SKILL_COLUMNS)
      .from(skillDefinition)
      .where(eq(skillDefinition.teamId, teamId.value));

    return found.map((each) => ({ ...each, teamId }));
  }

  private async stored(where: SQL | undefined): Promise<SkillRecord | null> {
    const [found] = await this.context.db
      .select(SKILL_COLUMNS)
      .from(skillDefinition)
      .where(where)
      .limit(1);

    return found ? { ...found, teamId: TeamId.of(found.teamId) } : null;
  }
}
