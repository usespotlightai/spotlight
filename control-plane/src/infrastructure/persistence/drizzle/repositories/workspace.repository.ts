import { Workspace } from '@domain/aggregates/workspace.aggregate';
import { WorkspaceSlugTakenError } from '@domain/exceptions/workspace-slug-taken.error';
import type { WorkspaceRepository } from '@domain/repositories/workspace.repository';
import { Connection } from '@domain/value-objects/connection.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { WorkspaceName } from '@domain/value-objects/workspace-name.vo';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';
import { DrizzleContext } from '@infrastructure/persistence/drizzle/drizzle.context';
import {
  team,
  workspace,
  workspaceConnection,
  workspaceMember,
} from '@infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Injectable } from '@nestjs/common';
import { and, eq, ne, notInArray } from 'drizzle-orm';

const UNIQUE_VIOLATION = '23505';

const isSlugCollision = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === UNIQUE_VIOLATION &&
  String((error as { constraint?: string }).constraint ?? '').includes('slug');

@Injectable()
export class DrizzleWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly context: DrizzleContext) {}

  async isTaken(slug: WorkspaceSlug): Promise<boolean> {
    const [found] = await this.context.db
      .select({ id: workspace.id })
      .from(workspace)
      .where(eq(workspace.slug, slug.value))
      .limit(1);

    return found !== undefined;
  }

  async withConnection(
    source: string,
    externalId: string,
  ): Promise<WorkspaceId | null> {
    const [found] = await this.context.db
      .select({ id: workspaceConnection.workspaceId })
      .from(workspaceConnection)
      .where(
        and(
          eq(workspaceConnection.source, source),
          eq(workspaceConnection.externalId, externalId),
        ),
      )
      .limit(1);

    return found ? WorkspaceId.of(found.id) : null;
  }

  async connectionTo(
    workspaceId: WorkspaceId,
    source: string,
  ): Promise<Connection | null> {
    const [found] = await this.context.db
      .select({ externalId: workspaceConnection.externalId })
      .from(workspaceConnection)
      .where(
        and(
          eq(workspaceConnection.workspaceId, workspaceId.value),
          eq(workspaceConnection.source, source),
        ),
      )
      .limit(1);

    return found ? Connection.of(source, found.externalId) : null;
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

    const [members, teams, connections] = await Promise.all([
      this.context.db
        .select()
        .from(workspaceMember)
        .where(eq(workspaceMember.workspaceId, found.id)),
      this.context.db
        .select({ id: team.id })
        .from(team)
        .where(eq(team.workspaceId, found.id)),
      this.context.db
        .select()
        .from(workspaceConnection)
        .where(eq(workspaceConnection.workspaceId, found.id)),
    ]);

    return Workspace.rehydrate({
      id: WorkspaceId.of(found.id),
      name: WorkspaceName.of(found.name),
      slug: WorkspaceSlug.of(found.slug),
      members: members.map((each) => ({
        userId: UserId.of(each.userId),
        role: each.role,
      })),
      teams: teams.map((each) => TeamId.of(each.id)),
      connections: connections.map((each) =>
        Connection.of(each.source, each.externalId),
      ),
    });
  }

  /**
   * Only what a workspace can be changed to say. Its members and teams are
   * write-once at create, so save deliberately does not write them back.
   */
  async save(saved: Workspace): Promise<void> {
    await this.context.run(async () => {
      await this.context.db
        .update(workspace)
        .set({ name: saved.name.value, slug: saved.slug.value })
        .where(eq(workspace.id, saved.id.value));

      // Taken from whoever held it rather than refused: an identifier names
      // one workspace, and moving a connection to another is something
      // people do on purpose.
      for (const connection of saved.connections) {
        await this.context.db
          .delete(workspaceConnection)
          .where(
            and(
              eq(workspaceConnection.source, connection.source),
              eq(workspaceConnection.externalId, connection.externalId),
              ne(workspaceConnection.workspaceId, saved.id.value),
            ),
          );
      }

      // What the workspace no longer says it reaches, it no longer reaches.
      await this.context.db.delete(workspaceConnection).where(
        and(
          eq(workspaceConnection.workspaceId, saved.id.value),
          saved.connections.length > 0
            ? notInArray(
                workspaceConnection.source,
                saved.connections.map((each) => each.source),
              )
            : undefined,
        ),
      );

      for (const connection of saved.connections) {
        await this.context.db
          .insert(workspaceConnection)
          .values({
            workspaceId: saved.id.value,
            source: connection.source,
            externalId: connection.externalId,
          })
          .onConflictDoUpdate({
            target: [
              workspaceConnection.source,
              workspaceConnection.externalId,
            ],
            set: { workspaceId: saved.id.value },
          });
      }
    });
  }

  async add(added: Workspace): Promise<void> {
    try {
      await this.context.run(async () => {
        await this.context.db.insert(workspace).values({
          id: added.id.value,
          name: added.name.value,
          slug: added.slug.value,
        });

        await this.context.db.insert(workspaceMember).values(
          added.members.map((member) => ({
            workspaceId: added.id.value,
            userId: member.userId.value,
            role: member.role,
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
