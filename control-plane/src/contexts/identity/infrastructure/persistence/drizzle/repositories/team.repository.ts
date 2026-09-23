import { Team } from '@identity/domain/aggregates/team.aggregate';
import { NoSuchWorkspaceError } from '@identity/domain/exceptions/no-such-workspace.error';
import { TeamAlreadyDefinedError } from '@identity/domain/exceptions/team-already-defined.error';
import { TeamMovedOnError } from '@identity/domain/exceptions/team-moved-on.error';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import { TeamName } from '@identity/domain/value-objects/team-name.vo';
import {
  team,
  teamMember,
} from '@identity/infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, inArray, notInArray } from 'drizzle-orm';

const UNIQUE_VIOLATION = '23505';

const FOREIGN_KEY_VIOLATION = '23503';

const codeOf = (error: unknown): string | undefined =>
  (
    ((error as { cause?: unknown } | null)?.cause ?? error) as {
      code?: string;
    } | null
  )?.code;

interface Row {
  readonly id: string;
  readonly workspaceId: string;
  readonly key: string;
  readonly name: string;
  readonly version: number;
}

@Injectable()
export class DrizzleTeamRepository implements TeamRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: Team): Promise<void> {
    await this.context.run(async () => {
      await this.inserted(added);
      await this.events.dispatch(added.pullEvents());
    });
  }

  private async inserted(added: Team): Promise<void> {
    await this.context.run(async () => {
      try {
        await this.context.db.insert(team).values(this.written(added));
      } catch (error) {
        if (codeOf(error) === UNIQUE_VIOLATION) {
          throw new TeamAlreadyDefinedError(added.key.value);
        }

        if (codeOf(error) === FOREIGN_KEY_VIOLATION) {
          throw new NoSuchWorkspaceError(added.workspaceId.value);
        }

        throw error;
      }

      if (added.members.length > 0) {
        await this.context.db.insert(teamMember).values(
          added.members.map((member) => ({
            teamId: added.id.value,
            userId: member.value,
          })),
        );
      }
    });
  }

  async save(saved: Team): Promise<void> {
    await this.context.run(async () => {
      await this.stored(saved);
      await this.events.dispatch(saved.pullEvents());
    });
  }

  private async stored(saved: Team): Promise<void> {
    await this.context.run(async () => {
      if (saved.isDisbanded) {
        const removed = await this.context.db
          .delete(team)
          .where(
            and(eq(team.id, saved.id.value), eq(team.version, saved.version)),
          )
          .returning({ id: team.id });

        if (removed.length === 0) {
          throw new TeamMovedOnError(saved.id.value);
        }

        return;
      }

      const written = await this.context.db
        .update(team)
        .set({
          key: saved.key.value,
          name: saved.name.value,
          version: saved.version + 1,
        })
        .where(
          and(eq(team.id, saved.id.value), eq(team.version, saved.version)),
        )
        .returning({ id: team.id });

      if (written.length === 0) {
        throw new TeamMovedOnError(saved.id.value);
      }

      const held = saved.members.map((member) => member.value);

      await this.context.db
        .delete(teamMember)
        .where(
          and(
            eq(teamMember.teamId, saved.id.value),
            held.length > 0 ? notInArray(teamMember.userId, held) : undefined,
          ),
        );

      if (held.length > 0) {
        await this.context.db
          .insert(teamMember)
          .values(held.map((userId) => ({ teamId: saved.id.value, userId })))
          .onConflictDoNothing({
            target: [teamMember.teamId, teamMember.userId],
          });
      }
    });
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

  private written(held: Team) {
    return {
      id: held.id.value,
      workspaceId: held.workspaceId.value,
      key: held.key.value,
      name: held.name.value,
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
          .map((member) => UserId.of(member.userId)),
        version: row.version,
      }),
    );
  }
}
