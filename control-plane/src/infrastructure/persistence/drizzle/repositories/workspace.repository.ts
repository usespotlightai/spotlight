import { Workspace } from '@domain/aggregates/workspace.aggregate';
import { Team } from '@domain/entities/team.entity';
import { WorkspaceSlugTakenError } from '@domain/exceptions/workspace-slug-taken.error';
import type { WorkspaceRepository } from '@domain/repositories/workspace.repository';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { TeamName } from '@domain/value-objects/team-name.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { WorkspaceName } from '@domain/value-objects/workspace-name.vo';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';
import { DrizzleContext } from '@infrastructure/persistence/drizzle/drizzle.context';
import {
  team,
  teamMember,
  workspace,
  workspaceMember,
} from '@infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Injectable } from '@nestjs/common';
import { and, eq, inArray, ne } from 'drizzle-orm';

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

  async withInstallation(
    installation: GitHubInstallation,
  ): Promise<WorkspaceId | null> {
    const [found] = await this.context.db
      .select({ id: workspace.id })
      .from(workspace)
      .where(eq(workspace.githubInstallationId, installation.value))
      .limit(1);

    return found ? WorkspaceId.of(found.id) : null;
  }

  async installationOf(
    workspaceId: WorkspaceId,
  ): Promise<GitHubInstallation | null> {
    const [found] = await this.context.db
      .select({ installation: workspace.githubInstallationId })
      .from(workspace)
      .where(eq(workspace.id, workspaceId.value))
      .limit(1);

    return found?.installation
      ? GitHubInstallation.of(found.installation)
      : null;
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

    const [members, teams] = await Promise.all([
      this.context.db
        .select()
        .from(workspaceMember)
        .where(eq(workspaceMember.workspaceId, found.id)),
      this.teamsOf(found.id),
    ]);

    return Workspace.rehydrate({
      id: WorkspaceId.of(found.id),
      name: WorkspaceName.of(found.name),
      slug: WorkspaceSlug.of(found.slug),
      members: members.map((each) => ({
        userId: UserId.of(each.userId),
        role: each.role,
      })),
      teams,
      githubInstallation: found.githubInstallationId
        ? GitHubInstallation.of(found.githubInstallationId)
        : null,
    });
  }

  /**
   * Only what a workspace can be changed to say. Its teams and members are
   * added through their own paths, and are not diffed back from here.
   */
  async save(saved: Workspace): Promise<void> {
    await this.context.run(async () => {
      // Taken from whoever held it rather than refused: the column is unique,
      // and moving an installation to another workspace is something people
      // do on purpose.
      if (saved.githubInstallation) {
        await this.context.db
          .update(workspace)
          .set({ githubInstallationId: null })
          .where(
            and(
              eq(
                workspace.githubInstallationId,
                saved.githubInstallation.value,
              ),
              ne(workspace.id, saved.id.value),
            ),
          );
      }

      await this.context.db
        .update(workspace)
        .set({
          name: saved.name.value,
          slug: saved.slug.value,
          githubInstallationId: saved.githubInstallation?.value ?? null,
        })
        .where(eq(workspace.id, saved.id.value));
    });
  }

  private async teamsOf(workspaceId: string): Promise<Team[]> {
    const held = await this.context.db
      .select()
      .from(team)
      .where(eq(team.workspaceId, workspaceId));

    if (held.length === 0) {
      return [];
    }

    const members = await this.context.db
      .select()
      .from(teamMember)
      .where(
        inArray(
          teamMember.teamId,
          held.map((each) => each.id),
        ),
      );

    return held.map((each) =>
      Team.rehydrate({
        id: TeamId.of(each.id),
        name: TeamName.of(each.name),
        members: members
          .filter((member) => member.teamId === each.id)
          .map((member) => ({
            userId: UserId.of(member.userId),
            role: member.role,
          })),
      }),
    );
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

        for (const owned of added.teams) {
          await this.context.db.insert(team).values({
            id: owned.id.value,
            workspaceId: added.id.value,
            name: owned.name.value,
          });

          await this.context.db.insert(teamMember).values(
            owned.members.map((member) => ({
              teamId: owned.id.value,
              userId: member.userId.value,
              role: member.role,
            })),
          );
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
