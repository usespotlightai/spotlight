import type {
  LineRecord,
  LineResourcesPort,
} from '@lines/application/ports/line-resources.port';
import type { Line } from '@lines/domain/aggregates/line.aggregate';
import { renderLine } from '@lines/infrastructure/lines/line-definition.render';
import {
  hydratedLines,
  type LineRow,
} from '@lines/infrastructure/persistence/drizzle/line-hydration';
import { line } from '@lines/infrastructure/persistence/drizzle/schemas/line.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { and, eq, inArray, type SQL } from 'drizzle-orm';

const recordOf = (each: Line): LineRecord => ({
  id: each.id.value,
  version: each.version,
  teamId: each.teamId,
  key: each.key.value,
  definition: renderLine(each),
});

@Injectable()
export class DrizzleLineResources implements LineResourcesPort {
  constructor(private readonly context: DrizzleContext) {}

  async withId(id: LineId): Promise<LineRecord | null> {
    const [found] = await this.recordsWhere(eq(line.id, id.value));

    return found ?? null;
  }

  async at(teamId: TeamId, key: LineKey): Promise<LineRecord | null> {
    const [found] = await this.recordsWhere(
      and(eq(line.teamId, teamId.value), eq(line.key, key.value)),
    );

    return found ?? null;
  }

  ofTeam(teamId: TeamId): Promise<readonly LineRecord[]> {
    return this.recordsWhere(eq(line.teamId, teamId.value));
  }

  async ofTeams(teamIds: readonly TeamId[]): Promise<readonly LineRecord[]> {
    return teamIds.length === 0
      ? []
      : this.recordsWhere(
          inArray(
            line.teamId,
            teamIds.map((each) => each.value),
          ),
        );
  }

  private async recordsWhere(
    where: SQL | undefined,
  ): Promise<readonly LineRecord[]> {
    const rows: LineRow[] = await this.context.db
      .select()
      .from(line)
      .where(where)
      .orderBy(line.teamId, line.id);

    return (await hydratedLines(this.context, rows)).map(recordOf);
  }
}
