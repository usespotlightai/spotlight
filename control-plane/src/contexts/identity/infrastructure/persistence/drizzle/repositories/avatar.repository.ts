import { Avatar } from '@identity/domain/aggregates/avatar.aggregate';
import { AvatarVersionConflictError } from '@identity/domain/exceptions/avatar-version-conflict.error';
import type { AvatarRepository } from '@identity/domain/repositories/avatar.repository';
import { AvatarDigest } from '@identity/domain/value-objects/avatar-digest.vo';
import { AvatarImageId } from '@identity/domain/value-objects/avatar-image-id.vo';
import { AvatarOwner } from '@identity/domain/value-objects/avatar-owner.vo';
import { avatar } from '@identity/infrastructure/persistence/drizzle/schemas/avatar.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, isNull, type SQL } from 'drizzle-orm';

const ownedBy = (owner: AvatarOwner): SQL | undefined =>
  and(
    eq(avatar.workspaceId, owner.workspaceId.value),
    owner.teamId ? eq(avatar.teamId, owner.teamId.value) : isNull(avatar.teamId),
  );

const COLUMNS = {
  teamId: avatar.teamId,
  digest: avatar.digest,
  imageId: avatar.imageId,
  version: avatar.version,
};

type AvatarRow = {
  readonly teamId: string | null;
  readonly digest: string;
  readonly imageId: string;
  readonly version: number;
};

const rehydrated = (workspaceId: WorkspaceId, row: AvatarRow): Avatar => {
  const digest = AvatarDigest.parsed(row.digest);

  if (!digest) {
    throw new InconsistentStateError('avatar', 'has a malformed digest');
  }

  return Avatar.rehydrate({
    owner: row.teamId
      ? AvatarOwner.team(workspaceId, TeamId.of(row.teamId))
      : AvatarOwner.workspace(workspaceId),
    digest,
    image: AvatarImageId.of(row.imageId),
    version: row.version,
  });
};

@Injectable()
export class DrizzleAvatarRepository implements AvatarRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async find(owner: AvatarOwner): Promise<Avatar | null> {
    const [found] = await this.context.db
      .select(COLUMNS)
      .from(avatar)
      .where(ownedBy(owner))
      .limit(1);

    return found ? rehydrated(owner.workspaceId, found) : null;
  }

  async ofWorkspace(workspaceId: WorkspaceId): Promise<readonly Avatar[]> {
    const found = await this.context.db
      .select(COLUMNS)
      .from(avatar)
      .where(eq(avatar.workspaceId, workspaceId.value));

    return found.map((row) => rehydrated(workspaceId, row));
  }

  async add(added: Avatar): Promise<void> {
    await this.context.inTransaction(async () => {
      const inserted = await this.context.db
        .insert(avatar)
        .values({
          workspaceId: added.owner.workspaceId.value,
          teamId: added.owner.teamId?.value ?? null,
          digest: added.digest.value,
          imageId: added.image.value,
          version: added.version,
        })
        .onConflictDoNothing()
        .returning({ id: avatar.id });

      if (inserted.length === 0) {
        throw new AvatarVersionConflictError(added.owner.toString());
      }

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: Avatar): Promise<void> {
    await this.context.inTransaction(async () => {
      const matching = and(
        ownedBy(saved.owner),
        eq(avatar.version, saved.version),
      );
      const written = saved.isRemoved
        ? await this.context.db
            .delete(avatar)
            .where(matching)
            .returning({ id: avatar.id })
        : await this.context.db
            .update(avatar)
            .set({
              digest: saved.digest.value,
              imageId: saved.image.value,
              version: saved.version + 1,
            })
            .where(matching)
            .returning({ id: avatar.id });

      if (written.length === 0) {
        throw new AvatarVersionConflictError(saved.owner.toString());
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }
}
