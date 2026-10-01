import { Injectable } from '@nestjs/common';
import type { FirstSeenPort } from '@outcomes/application/ports/first-seen.port';
import {
  chatRecord,
  taskTouches,
} from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, inArray, min, sql } from 'drizzle-orm';

interface Seen {
  readonly person: string | null;
  readonly at: Date | string | null;
}

const earliest = (seen: readonly Seen[]): ReadonlyMap<string, Date> => {
  const first = new Map<string, Date>();

  for (const each of seen) {
    const at = each.at === null ? null : new Date(each.at);

    if (!each.person || !at) {
      continue;
    }

    const held = first.get(each.person);

    if (!held || at.getTime() < held.getTime()) {
      first.set(each.person, at);
    }
  }

  return first;
};

@Injectable()
export class DrizzleFirstSeen implements FirstSeenPort {
  constructor(private readonly context: DrizzleContext) {}

  async onTeam(
    workspaceId: WorkspaceId,
    teamId: TeamId,
    people: readonly string[],
  ): Promise<ReadonlyMap<string, Date>> {
    if (people.length === 0) {
      return new Map();
    }

    const onTeam = and(
      eq(taskTouches.workspaceId, workspaceId.value),
      eq(taskTouches.teamId, teamId.value),
    );
    const opened = await this.context.db
      .select({ person: taskTouches.openedBy, at: min(taskTouches.openedAt) })
      .from(taskTouches)
      .where(and(onTeam, inArray(taskTouches.openedBy, [...people])))
      .groupBy(taskTouches.openedBy);
    const acted = await this.context.db
      .select({
        person: sql<string>`act.value->>'by'`,
        at: sql<string>`min(act.value->>'at')`,
      })
      .from(
        sql`${taskTouches}, jsonb_array_elements(${taskTouches.acts}) as act`,
      )
      .where(
        and(
          onTeam,
          sql`act.value->>'by' in (${sql.join(
            people.map((each) => sql`${each}`),
            sql`, `,
          )})`,
        ),
      )
      .groupBy(sql`act.value->>'by'`);
    const chatted = await this.context.db
      .select({ person: chatRecord.startedBy, at: min(chatRecord.startedAt) })
      .from(chatRecord)
      .where(
        and(
          eq(chatRecord.workspaceId, workspaceId.value),
          eq(chatRecord.teamId, teamId.value),
          inArray(chatRecord.startedBy, [...people]),
        ),
      )
      .groupBy(chatRecord.startedBy);

    return earliest([...opened, ...acted, ...chatted]);
  }
}
