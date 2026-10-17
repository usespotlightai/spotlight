import { SkillDefinition } from '@configuration/domain/aggregates/skill-definition.aggregate';
import { SkillAlreadyDefinedError } from '@configuration/domain/exceptions/skill-already-defined.error';
import { SkillDefinitionVersionConflictError } from '@configuration/domain/exceptions/skill-definition-version-conflict.error';
import type { SkillDefinitionRepository } from '@configuration/domain/repositories/skill-definition.repository';
import { SkillDefinitionId } from '@configuration/domain/value-objects/skill-definition-id.vo';
import { SkillFiles } from '@configuration/domain/value-objects/skill-files.vo';
import { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';
import { skillDefinition } from '@configuration/infrastructure/persistence/drizzle/schemas/configuration.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { and, asc, eq, type SQL } from 'drizzle-orm';

const UNIQUE_VIOLATION = '23505';

const collided = (error: unknown): boolean =>
  (
    ((error as { cause?: unknown } | null)?.cause ?? error) as {
      code?: string;
    } | null
  )?.code === UNIQUE_VIOLATION;

const inPlace = (definition: SkillDefinition) =>
  and(
    eq(skillDefinition.id, definition.id.value),
    eq(skillDefinition.version, definition.version),
  );

type Row = typeof skillDefinition.$inferSelect;

const rehydrated = (row: Row): SkillDefinition =>
  SkillDefinition.rehydrate({
    id: SkillDefinitionId.of(row.id),
    teamId: TeamId.of(row.teamId),
    key: SkillKey.of(row.key),
    files: SkillFiles.of(row.files),
    version: row.version,
  });

@Injectable()
export class DrizzleSkillDefinitions implements SkillDefinitionRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  withId(id: SkillDefinitionId): Promise<SkillDefinition | null> {
    return this.first(eq(skillDefinition.id, id.value));
  }

  of(teamId: TeamId, key: SkillKey): Promise<SkillDefinition | null> {
    return this.first(
      and(
        eq(skillDefinition.teamId, teamId.value),
        eq(skillDefinition.key, key.value),
      ),
    );
  }

  async ofTeam(teamId: TeamId): Promise<readonly SkillDefinition[]> {
    return (
      await this.context.db
        .select()
        .from(skillDefinition)
        .where(eq(skillDefinition.teamId, teamId.value))
        .orderBy(asc(skillDefinition.key))
    ).map(rehydrated);
  }

  async save(definition: SkillDefinition): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.stored(definition);
      await this.events.dispatch(definition.pullEvents());
    });
  }

  private async stored(definition: SkillDefinition): Promise<void> {
    const files = { ...definition.files.fields };

    if (definition.isNew) {
      try {
        await this.context.db.insert(skillDefinition).values({
          id: definition.id.value,
          teamId: definition.teamId.value,
          key: definition.key.value,
          files,
        });
      } catch (error) {
        if (collided(error)) {
          throw new SkillAlreadyDefinedError(definition.key.value);
        }

        throw error;
      }

      return;
    }

    const touched = definition.isRetired
      ? await this.context.db
          .delete(skillDefinition)
          .where(inPlace(definition))
          .returning({ id: skillDefinition.id })
      : await this.context.db
          .update(skillDefinition)
          .set({ files, version: definition.version + 1 })
          .where(inPlace(definition))
          .returning({ id: skillDefinition.id });

    if (touched.length === 0) {
      throw new SkillDefinitionVersionConflictError(definition.key.value);
    }
  }

  private async first(where: SQL | undefined): Promise<SkillDefinition | null> {
    const [found] = await this.context.db
      .select()
      .from(skillDefinition)
      .where(where)
      .limit(1);

    return found ? rehydrated(found) : null;
  }
}
