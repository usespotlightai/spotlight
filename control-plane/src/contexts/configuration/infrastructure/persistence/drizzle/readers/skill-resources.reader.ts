import type {
  SkillRecord,
  SkillResourcesPort,
} from '@configuration/application/ports/skill-resources.port';
import { skillDefinition } from '@configuration/infrastructure/persistence/drizzle/schemas/configuration.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { and, eq, type SQL } from 'drizzle-orm';

const KEPT = {
  id: skillDefinition.id,
  version: skillDefinition.version,
  teamId: skillDefinition.teamId,
  key: skillDefinition.key,
  files: skillDefinition.files,
};

@Injectable()
export class DrizzleSkillResources implements SkillResourcesPort {
  constructor(private readonly context: DrizzleContext) {}

  withId(id: string): Promise<SkillRecord | null> {
    return this.kept(eq(skillDefinition.id, id));
  }

  at(teamId: TeamId, key: string): Promise<SkillRecord | null> {
    return this.kept(
      and(
        eq(skillDefinition.teamId, teamId.value),
        eq(skillDefinition.key, key),
      ),
    );
  }

  async ofTeam(teamId: TeamId): Promise<readonly SkillRecord[]> {
    const found = await this.context.db
      .select(KEPT)
      .from(skillDefinition)
      .where(eq(skillDefinition.teamId, teamId.value));

    return found.map((each) => ({ ...each, teamId }));
  }

  private async kept(where: SQL | undefined): Promise<SkillRecord | null> {
    const [found] = await this.context.db
      .select(KEPT)
      .from(skillDefinition)
      .where(where)
      .limit(1);

    return found ? { ...found, teamId: TeamId.of(found.teamId) } : null;
  }
}
