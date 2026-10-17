import { HarnessProfileMapper } from '@configuration/application/mappers/harness-profile.mapper';
import { HarnessProfile } from '@configuration/domain/aggregates/harness-profile.aggregate';
import { HarnessProfileAlreadyDefinedError } from '@configuration/domain/exceptions/harness-profile-already-defined.error';
import { HarnessProfileVersionConflictError } from '@configuration/domain/exceptions/harness-profile-version-conflict.error';
import type { HarnessProfileRepository } from '@configuration/domain/repositories/harness-profile.repository';
import { HarnessProfileId } from '@configuration/domain/value-objects/harness-profile-id.vo';
import { ProfileKey } from '@configuration/domain/value-objects/profile-key.vo';
import { ProfileSettings } from '@configuration/domain/value-objects/profile-settings.vo';
import { harnessProfile } from '@configuration/infrastructure/persistence/drizzle/schemas/configuration.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  codeOf,
  UNIQUE_VIOLATION,
} from '@platform/persistence/drizzle/violations';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { and, asc, eq } from 'drizzle-orm';

const inPlace = (profile: HarnessProfile) =>
  and(
    eq(harnessProfile.id, profile.id.value),
    eq(harnessProfile.version, profile.version),
  );

type Row = typeof harnessProfile.$inferSelect;

const rehydrated = (row: Row): HarnessProfile =>
  HarnessProfile.rehydrate({
    id: HarnessProfileId.of(row.id),
    teamId: TeamId.of(row.teamId),
    key: ProfileKey.of(row.key),
    settings: ProfileSettings.written(row),
    version: row.version,
  });

const columnsOf = (profile: HarnessProfile) => ({
  permissions: profile.settings.permissions,
  mcpServers: HarnessProfileMapper.servers(profile.settings),
  native: { ...profile.settings.native },
});

@Injectable()
export class DrizzleHarnessProfiles implements HarnessProfileRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async withId(id: HarnessProfileId): Promise<HarnessProfile | null> {
    const [found] = await this.context.db
      .select()
      .from(harnessProfile)
      .where(eq(harnessProfile.id, id.value))
      .limit(1);

    return found ? rehydrated(found) : null;
  }

  async ofTeam(teamId: TeamId): Promise<readonly HarnessProfile[]> {
    return (
      await this.context.db
        .select()
        .from(harnessProfile)
        .where(eq(harnessProfile.teamId, teamId.value))
        .orderBy(asc(harnessProfile.key))
    ).map(rehydrated);
  }

  async save(profile: HarnessProfile): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.stored(profile);
      await this.events.dispatch(profile.pullEvents());
    });
  }

  private async stored(profile: HarnessProfile): Promise<void> {
    if (profile.isNew) {
      try {
        await this.context.db.insert(harnessProfile).values({
          id: profile.id.value,
          teamId: profile.teamId.value,
          key: profile.key.value,
          ...columnsOf(profile),
        });
      } catch (error) {
        if (codeOf(error) === UNIQUE_VIOLATION) {
          throw new HarnessProfileAlreadyDefinedError(profile.key.value);
        }

        throw error;
      }

      return;
    }

    const touched = profile.isRetired
      ? await this.context.db
          .delete(harnessProfile)
          .where(inPlace(profile))
          .returning({ id: harnessProfile.id })
      : await this.context.db
          .update(harnessProfile)
          .set({ ...columnsOf(profile), version: profile.version + 1 })
          .where(inPlace(profile))
          .returning({ id: harnessProfile.id });

    if (touched.length === 0) {
      throw new HarnessProfileVersionConflictError(profile.key.value);
    }
  }
}
