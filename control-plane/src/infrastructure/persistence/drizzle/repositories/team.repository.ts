import { Team } from '@domain/aggregates/team.aggregate';
import type { TeamRepository } from '@domain/repositories/team.repository';
import { Repository } from '@domain/value-objects/repository.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { TeamKey } from '@domain/value-objects/team-key.vo';
import { TeamName } from '@domain/value-objects/team-name.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { DrizzleContext } from '@infrastructure/persistence/drizzle/drizzle.context';
import {
  team,
  teamMember,
} from '@infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';

interface Row {
  readonly id: string;
  readonly workspaceId: string;
  readonly key: string;
  readonly name: string;
  readonly configRepository: string | null;
}

@Injectable()
export class DrizzleTeamRepository implements TeamRepository {
  constructor(private readonly context: DrizzleContext) {}

  async add(added: Team): Promise<void> {
    await this.context.run(async () => {
      await this.context.db.insert(team).values(this.written(added));

      if (added.members.length > 0) {
        await this.context.db.insert(teamMember).values(
          added.members.map((member) => ({
            teamId: added.id.value,
            userId: member.userId.value,
            role: member.role,
          })),
        );
      }
    });
  }

  /** Only what a team can be changed to say. Its members go their own way. */
  async save(saved: Team): Promise<void> {
    await this.context.db
      .update(team)
      .set({
        key: saved.key.value,
        name: saved.name.value,
        configRepository: saved.configRepository?.value ?? null,
      })
      .where(eq(team.id, saved.id.value));
  }

  async find(id: TeamId): Promise<Team | null> {
    const [found] = await this.context.db
      .select()
      .from(team)
      .where(eq(team.id, id.value))
      .limit(1);

    return found
      ? this.rehydrated([found]).then((all) => all[0] ?? null)
      : null;
  }

  async named(workspaceId: WorkspaceId, key: TeamKey): Promise<Team | null> {
    const [found] = await this.context.db
      .select()
      .from(team)
      .where(
        and(eq(team.workspaceId, workspaceId.value), eq(team.key, key.value)),
      )
      .limit(1);

    return found
      ? this.rehydrated([found]).then((all) => all[0] ?? null)
      : null;
  }

  async ofWorkspace(workspaceId: WorkspaceId): Promise<readonly Team[]> {
    return this.rehydrated(
      await this.context.db
        .select()
        .from(team)
        .where(eq(team.workspaceId, workspaceId.value))
        .orderBy(team.key),
    );
  }

  async readingFrom(repository: Repository): Promise<readonly Team[]> {
    return this.rehydrated(
      await this.context.db
        .select()
        .from(team)
        .where(
          or(
            eq(team.configRepository, repository.value),
            // One that pinned nothing may be reading it by the fallback rule.
            isNull(team.configRepository),
          ),
        ),
    );
  }

  private written(held: Team) {
    return {
      id: held.id.value,
      workspaceId: held.workspaceId.value,
      key: held.key.value,
      name: held.name.value,
      configRepository: held.configRepository?.value ?? null,
    };
  }

  private async rehydrated(rows: readonly Row[]): Promise<Team[]> {
    if (rows.length === 0) {
      return [];
    }

    const members = await this.context.db
      .select()
      .from(teamMember)
      .where(
        inArray(
          teamMember.teamId,
          rows.map((each) => each.id),
        ),
      );

    return rows.map((row) =>
      Team.rehydrate({
        id: TeamId.of(row.id),
        workspaceId: WorkspaceId.of(row.workspaceId),
        key: TeamKey.of(row.key),
        name: TeamName.of(row.name),
        members: members
          .filter((member) => member.teamId === row.id)
          .map((member) => ({
            userId: UserId.of(member.userId),
            role: member.role,
          })),
        configRepository: row.configRepository
          ? Repository.of(row.configRepository)
          : null,
      }),
    );
  }
}
