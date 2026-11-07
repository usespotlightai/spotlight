import type { LineView } from '@lines/application/contracts/line-view.contract';
import { LineViewMapper } from '@lines/application/mappers/line-view.mapper';
import {
  type ContentHashPort,
  LINES_CONTENT_HASH,
} from '@lines/application/ports/content-hash.port';
import type { PublishedLineViewsPort } from '@lines/application/ports/published-line-views.port';
import {
  hydratedLines,
  type LineRow,
} from '@lines/infrastructure/persistence/drizzle/line-hydration';
import {
  line,
  station,
} from '@lines/infrastructure/persistence/drizzle/schemas/line.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { eq, inArray, type SQL } from 'drizzle-orm';

@Injectable()
export class DrizzlePublishedLineViews implements PublishedLineViewsPort {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(LINES_CONTENT_HASH) private readonly hash: ContentHashPort,
  ) {}

  async withId(lineId: LineId): Promise<LineView | null> {
    const [found] = await this.viewsWhere(eq(line.id, lineId.value));

    return found ?? null;
  }

  async atStation(stationId: StationId): Promise<LineView | null> {
    const [found] = await this.viewsWhere(
      inArray(
        line.id,
        this.context.db
          .select({ lineId: station.lineId })
          .from(station)
          .where(eq(station.id, stationId.value)),
      ),
    );

    return found ?? null;
  }

  ofTeam(teamId: TeamId): Promise<readonly LineView[]> {
    return this.viewsWhere(eq(line.teamId, teamId.value));
  }

  ofWorkspace(workspaceId: WorkspaceId): Promise<readonly LineView[]> {
    return this.viewsWhere(eq(line.workspaceId, workspaceId.value));
  }

  private async viewsWhere(where: SQL): Promise<readonly LineView[]> {
    const rows: LineRow[] = await this.context.db
      .select()
      .from(line)
      .where(where)
      .orderBy(line.id);

    return (await hydratedLines(this.context, rows)).map((each) =>
      LineViewMapper.of(each, this.hash),
    );
  }
}
