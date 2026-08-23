import type { Workspace } from '@domain/aggregates/workspace.aggregate';
import { WorkspaceSlugTakenError } from '@domain/exceptions/workspace-slug-taken.error';
import type { WorkspaceRepository } from '@domain/repositories/workspace.repository';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@infrastructure/persistence/drizzle/drizzle.constants';
import { factory } from '@infrastructure/persistence/drizzle/schemas/factory.schema';
import {
  team,
  teamMember,
  workspace,
  workspaceMember,
} from '@infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

const UNIQUE_VIOLATION = '23505';

const isSlugCollision = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === UNIQUE_VIOLATION &&
  String((error as { constraint?: string }).constraint ?? '').includes('slug');

@Injectable()
export class DrizzleWorkspaceRepository implements WorkspaceRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async isTaken(slug: WorkspaceSlug): Promise<boolean> {
    const [found] = await this.db
      .select({ id: workspace.id })
      .from(workspace)
      .where(eq(workspace.slug, slug.value))
      .limit(1);

    return found !== undefined;
  }

  async add(added: Workspace): Promise<void> {
    try {
      await this.db.transaction(async (tx) => {
        await tx.insert(workspace).values({
          id: added.id.value,
          name: added.name.value,
          slug: added.slug.value,
        });

        await tx.insert(workspaceMember).values(
          added.members.map((member) => ({
            workspaceId: added.id.value,
            userId: member.userId.value,
            role: member.role,
          })),
        );

        for (const owned of added.teams) {
          await tx.insert(team).values({
            id: owned.id.value,
            workspaceId: added.id.value,
            name: owned.name.value,
          });

          await tx.insert(teamMember).values(
            owned.members.map((member) => ({
              teamId: owned.id.value,
              userId: member.userId.value,
              role: member.role,
            })),
          );

          await tx.insert(factory).values({
            id: owned.factory.id.value,
            workspaceId: added.id.value,
            teamId: owned.id.value,
          });
        }
      });
    } catch (error) {
      if (isSlugCollision(error)) {
        throw new WorkspaceSlugTakenError(added.slug.value);
      }
      throw error;
    }
  }
}
