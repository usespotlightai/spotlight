import { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import { WorkspaceInUseError } from '@identity/domain/exceptions/workspace-in-use.error';
import { WorkspaceSlugTakenError } from '@identity/domain/exceptions/workspace-slug-taken.error';
import { WorkspaceVersionConflictError } from '@identity/domain/exceptions/workspace-version-conflict.error';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { Dependents } from '@identity/domain/value-objects/dependents.vo';
import { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import {
  workspace,
  workspaceMember,
} from '@identity/infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  codeOf,
  RESTRICT_VIOLATION,
  UNIQUE_VIOLATION,
} from '@platform/persistence/drizzle/violations';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { HostAllowList } from '@shared-kernel/domain/value-objects/host-allow-list.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, notInArray } from 'drizzle-orm';

const isSlugCollision = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === UNIQUE_VIOLATION &&
  String((error as { constraint?: string }).constraint ?? '').includes('slug');

@Injectable()
export class DrizzleWorkspaceRepository implements WorkspaceRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async isTaken(slug: WorkspaceSlug): Promise<boolean> {
    const [found] = await this.context.db
      .select({ id: workspace.id })
      .from(workspace)
      .where(eq(workspace.slug, slug.value))
      .limit(1);

    return found !== undefined;
  }

  async find(workspaceId: WorkspaceId): Promise<Workspace | null> {
    const [found] = await this.context.db
      .select({ slug: workspace.slug })
      .from(workspace)
      .where(eq(workspace.id, workspaceId.value))
      .limit(1);

    return found ? this.findBySlug(WorkspaceSlug.of(found.slug)) : null;
  }

  async findBySlug(slug: WorkspaceSlug): Promise<Workspace | null> {
    const [found] = await this.context.db
      .select()
      .from(workspace)
      .where(eq(workspace.slug, slug.value))
      .limit(1);

    if (!found) {
      return null;
    }

    const members = await this.context.db
      .select()
      .from(workspaceMember)
      .where(eq(workspaceMember.workspaceId, found.id));

    return Workspace.rehydrate({
      id: WorkspaceId.of(found.id),
      name: WorkspaceName.of(found.name),
      slug: WorkspaceSlug.of(found.slug),
      outboundHosts: HostAllowList.restored(found.outboundHosts),
      members: members.map((each) => ({
        userId: UserId.of(each.userId),
        role: WorkspaceRole.of(each.role),
      })),
      version: found.version,
    });
  }

  async save(saved: Workspace): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.stored(saved);
      await this.events.dispatch(saved.pullEvents());
    });
  }

  private async stored(saved: Workspace): Promise<void> {
    await this.context.inTransaction(async () => {
      if (saved.isDeleted) {
        await this.deleted(saved);
        return;
      }

      const written = await this.context.db
        .update(workspace)
        .set({
          name: saved.name.value,
          slug: saved.slug.value,
          outboundHosts: [...saved.outboundHosts.entries],
          version: saved.version + 1,
        })
        .where(
          and(
            eq(workspace.id, saved.id.value),
            eq(workspace.version, saved.version),
          ),
        )
        .returning({ id: workspace.id });

      if (written.length === 0) {
        throw new WorkspaceVersionConflictError(saved.slug.value);
      }

      await this.writeMembers(saved);
    });
  }

  private async deleted(saved: Workspace): Promise<void> {
    const removed = await this.context.db
      .delete(workspace)
      .where(
        and(
          eq(workspace.id, saved.id.value),
          eq(workspace.version, saved.version),
        ),
      )
      .returning({ id: workspace.id })
      .catch((error: unknown) => {
        throw codeOf(error) === RESTRICT_VIOLATION
          ? new WorkspaceInUseError(saved.slug.value, Dependents.none())
          : error;
      });

    if (removed.length === 0) {
      throw new WorkspaceVersionConflictError(saved.slug.value);
    }
  }

  private async writeMembers(saved: Workspace): Promise<void> {
    const memberIds = saved.members.map((member) => member.userId.value);

    await this.context.db
      .delete(workspaceMember)
      .where(
        and(
          eq(workspaceMember.workspaceId, saved.id.value),
          memberIds.length > 0
            ? notInArray(workspaceMember.userId, memberIds)
            : undefined,
        ),
      );

    for (const member of saved.members) {
      await this.context.db
        .insert(workspaceMember)
        .values({
          workspaceId: saved.id.value,
          userId: member.userId.value,
          role: member.role.value,
        })
        .onConflictDoUpdate({
          target: [workspaceMember.workspaceId, workspaceMember.userId],
          set: { role: member.role.value },
        });
    }
  }

  async add(added: Workspace): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.inserted(added);
      await this.events.dispatch(added.pullEvents());
    });
  }

  private async inserted(added: Workspace): Promise<void> {
    try {
      await this.context.inTransaction(async () => {
        await this.context.db.insert(workspace).values({
          id: added.id.value,
          name: added.name.value,
          slug: added.slug.value,
          outboundHosts: [...added.outboundHosts.entries],
        });

        await this.context.db.insert(workspaceMember).values(
          added.members.map((member) => ({
            workspaceId: added.id.value,
            userId: member.userId.value,
            role: member.role.value,
          })),
        );
      });
    } catch (error) {
      if (isSlugCollision(error)) {
        throw new WorkspaceSlugTakenError(added.slug.value);
      }
      throw error;
    }
  }
}
