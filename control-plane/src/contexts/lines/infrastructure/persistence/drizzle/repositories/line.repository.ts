import { Line } from '@lines/domain/aggregates/line.aggregate';
import { LineAlreadyExistsError } from '@lines/domain/exceptions/line-already-exists.error';
import { LineRoleTakenError } from '@lines/domain/exceptions/line-role-taken.error';
import { LineVersionConflictError } from '@lines/domain/exceptions/line-version-conflict.error';
import type { LineRepository } from '@lines/domain/repositories/line.repository';
import { hydratedLines } from '@lines/infrastructure/persistence/drizzle/line-hydration';
import {
  reactionRowsOf,
  replayCheckRow,
  repositoryRowsOf,
  reviewsRow,
  routeRowsOf,
  skillRowsOf,
  sourceRow,
  stationColumnsOf,
  toolRowsOf,
} from '@lines/infrastructure/persistence/drizzle/line-rows.of';
import {
  line,
  lineReaction,
  lineRepository,
  station,
  stationRoute,
  stationSkill,
  stationTool,
} from '@lines/infrastructure/persistence/drizzle/schemas/line.schema';
import { lineSearchRow } from '@lines/infrastructure/persistence/drizzle/search-rows';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, inArray } from 'drizzle-orm';

const rowsOf = (line: Line) =>
  line.stations.map((each) => ({
    id: each.id.value,
    workspaceId: line.workspaceId.value,
    lineId: line.id.value,
    ...stationColumnsOf(each),
  }));

const roleTakenOr = (error: unknown, saving: Line): unknown =>
  saving.role && violates(error, UNIQUE_VIOLATION, 'line_team_role')
    ? new LineRoleTakenError({
        line: saving.key,
        role: saving.role,
        others: [],
      })
    : error;

@Injectable()
export class DrizzleLineRepository implements LineRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: Line): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.inserted(added);
      await this.events.dispatch(added.pullEvents());
    });
  }

  private async inserted(added: Line): Promise<void> {
    try {
      await this.context.db.insert(line).values({
        id: added.id.value,
        workspaceId: added.workspaceId.value,
        teamId: added.teamId.value,
        key: added.key.value,
        name: added.name.value,
        role: added.role?.value ?? null,
        reviews: reviewsRow(added.reviews),
        replayCheck: replayCheckRow(added.replayCheck),
        search: lineSearchRow(added.search),
        source: sourceRow(added.source),
        runners: [...added.placement.requiredLabels],
        version: added.version,
      });
    } catch (error) {
      if (violates(error, UNIQUE_VIOLATION, 'line_team_key')) {
        throw new LineAlreadyExistsError(added.key.value);
      }

      throw roleTakenOr(error, added);
    }

    await this.context.db.insert(station).values(rowsOf(added));
    await this.writeWays(added);
  }

  async save(saved: Line): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.stored(saved);
      await this.events.dispatch(saved.pullEvents());
    });
  }

  private async stored(saved: Line): Promise<void> {
    if (saved.isDeleted) {
      await this.removed(saved);
      return;
    }

    const written = await this.context.db
      .update(line)
      .set({
        version: saved.version + 1,
        key: saved.key.value,
        name: saved.name.value,
        role: saved.role?.value ?? null,
        reviews: reviewsRow(saved.reviews),
        replayCheck: replayCheckRow(saved.replayCheck),
        search: lineSearchRow(saved.search),
        source: sourceRow(saved.source),
        runners: [...saved.placement.requiredLabels],
      })
      .where(and(eq(line.id, saved.id.value), eq(line.version, saved.version)))
      .returning({ id: line.id })
      .catch((error: unknown) => {
        throw roleTakenOr(error, saved);
      });

    if (written.length === 0) {
      throw new LineVersionConflictError(saved.id.value);
    }

    const stored = await this.context.db
      .select({ id: station.id })
      .from(station)
      .where(eq(station.lineId, saved.id.value));
    const remaining = new Set(saved.stations.map((each) => each.id.value));
    const existing = new Set(stored.map((each) => each.id));
    const dropped = stored
      .map((each) => each.id)
      .filter((id) => !remaining.has(id));

    if (dropped.length > 0) {
      await this.dropped(dropped);
    }

    for (const each of saved.stations.filter((one) =>
      existing.has(one.id.value),
    )) {
      await this.context.db
        .update(station)
        .set(stationColumnsOf(each))
        .where(eq(station.id, each.id.value));
    }

    const added = saved.stations.filter((each) => !existing.has(each.id.value));

    if (added.length > 0) {
      await this.context.db.insert(station).values(
        added.map((each) => ({
          id: each.id.value,
          workspaceId: saved.workspaceId.value,
          lineId: saved.id.value,
          ...stationColumnsOf(each),
        })),
      );
    }

    const stationIds = saved.stations.map((each) => each.id.value);

    await this.context.db
      .delete(stationRoute)
      .where(inArray(stationRoute.stationId, stationIds));
    await this.context.db
      .delete(stationTool)
      .where(inArray(stationTool.stationId, stationIds));
    await this.context.db
      .delete(stationSkill)
      .where(inArray(stationSkill.stationId, stationIds));
    await this.context.db
      .delete(lineReaction)
      .where(eq(lineReaction.lineId, saved.id.value));
    await this.context.db
      .delete(lineRepository)
      .where(eq(lineRepository.lineId, saved.id.value));
    await this.writeWays(saved);
  }

  private async removed(deleted: Line): Promise<void> {
    const removed = await this.context.db
      .delete(line)
      .where(
        and(eq(line.id, deleted.id.value), eq(line.version, deleted.version)),
      )
      .returning({ id: line.id });

    if (removed.length === 0) {
      throw new LineVersionConflictError(deleted.id.value);
    }
  }

  private async dropped(stationIds: readonly string[]): Promise<void> {
    await this.context.db
      .delete(station)
      .where(inArray(station.id, [...stationIds]));
  }

  private async writeWays(line: Line): Promise<void> {
    const routes = routeRowsOf(line);
    const reactions = reactionRowsOf(line);
    const tools = toolRowsOf(line);
    const skills = skillRowsOf(line);
    const repositories = repositoryRowsOf(line);

    if (routes.length > 0) {
      await this.context.db.insert(stationRoute).values(routes);
    }
    if (tools.length > 0) {
      await this.context.db.insert(stationTool).values(tools);
    }
    if (skills.length > 0) {
      await this.context.db.insert(stationSkill).values(skills);
    }
    if (reactions.length > 0) {
      await this.context.db.insert(lineReaction).values(reactions);
    }
    if (repositories.length > 0) {
      await this.context.db.insert(lineRepository).values(repositories);
    }
  }

  async find(id: LineId): Promise<Line | null> {
    const [found] = await hydratedLines(
      this.context,
      await this.context.db
        .select()
        .from(line)
        .where(eq(line.id, id.value))
        .limit(1),
    );

    return found ?? null;
  }

  async ofTeam(teamId: TeamId): Promise<readonly Line[]> {
    return hydratedLines(
      this.context,
      await this.context.db
        .select()
        .from(line)
        .where(eq(line.teamId, teamId.value))
        .orderBy(line.id),
    );
  }

}
