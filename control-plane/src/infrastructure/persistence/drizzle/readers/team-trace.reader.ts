import type {
  TeamTraceReaderPort,
  TeamTraceSummary,
  TraceStation,
} from '@application/ports/team-trace-reader.port';
import { HarnessName } from '@domain/value-objects/harness-name.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@infrastructure/persistence/drizzle/drizzle.constants';
import { stationsPerLine } from '@infrastructure/persistence/drizzle/readers/task-trail';
import { factory } from '@infrastructure/persistence/drizzle/schemas/factory.schema';
import {
  line,
  station,
} from '@infrastructure/persistence/drizzle/schemas/line.schema';
import { run } from '@infrastructure/persistence/drizzle/schemas/run.schema';
import {
  task,
  taskNote,
} from '@infrastructure/persistence/drizzle/schemas/task.schema';
import { workspaceMember } from '@infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const ranAt = alias(station, 'ran_at');

const PREVIEW_LIMIT = 300;

const shortened = (text: string | null | undefined): string | null => {
  const said = text?.trim();
  return said ? said.slice(0, PREVIEW_LIMIT) : null;
};

@Injectable()
export class DrizzleTeamTraceReader implements TeamTraceReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async listForTeam(
    teamId: TeamId,
    viewerId: UserId,
    since: Date,
  ): Promise<TeamTraceSummary[]> {
    const rows = await this.db
      .select({
        runId: run.id,
        taskId: run.taskId,
        title: task.title,
        description: task.description,
        state: run.state,
        harness: run.harness,
        startedAt: run.createdAt,
        endedAt: run.updatedAt,
        ranName: ranAt.name,
        ranColor: ranAt.color,
        ranPosition: ranAt.position,
        ranLineId: ranAt.lineId,
        standsName: station.name,
        standsColor: station.color,
        standsPosition: station.position,
        standsLineId: station.lineId,
      })
      .from(run)
      .innerJoin(
        workspaceMember,
        and(
          eq(workspaceMember.workspaceId, run.workspaceId),
          eq(workspaceMember.userId, viewerId.value),
        ),
      )
      .innerJoin(task, eq(task.id, run.taskId))
      .innerJoin(station, eq(station.id, task.stationId))
      .innerJoin(line, eq(line.id, station.lineId))
      .innerJoin(factory, eq(factory.id, line.factoryId))
      .leftJoin(ranAt, eq(ranAt.id, run.stationId))
      .where(and(eq(factory.teamId, teamId.value), gte(run.createdAt, since)))
      .orderBy(desc(run.createdAt));

    const worked = rows.flatMap((row) => (row.taskId ? [row] : []));

    if (worked.length === 0) {
      return [];
    }

    const said = await this.db
      .select({ runId: taskNote.runId, body: taskNote.body })
      .from(taskNote)
      .where(
        inArray(
          taskNote.runId,
          worked.map((row) => row.runId),
        ),
      )
      .orderBy(asc(taskNote.position));

    const answers = new Map(said.map((each) => [each.runId, each.body]));

    const held = await stationsPerLine(
      this.db,
      worked.flatMap((row) =>
        [row.ranLineId, row.standsLineId].flatMap((each) =>
          each ? [each] : [],
        ),
      ),
    );

    const stationOf = (
      name: string | null,
      color: string | null,
      position: number | null,
      lineId: string | null,
    ): TraceStation | null => {
      const called = StationName.maybe(name);
      const shade = StationColor.maybe(color);

      return called && shade && position !== null
        ? {
            name: called,
            color: shade,
            position,
            count: held.get(lineId ?? '') ?? 1,
          }
        : null;
    };

    const traces = new Map<string, TeamTraceSummary>();
    const passed = new Map<string, Map<string, TraceStation>>();

    for (const row of worked) {
      const taskId = row.taskId as string;

      const ran = stationOf(
        row.ranName,
        row.ranColor,
        row.ranPosition,
        row.ranLineId,
      );
      const marks = passed.get(taskId) ?? new Map<string, TraceStation>();
      if (ran) {
        marks.set(ran.name.value, ran);
      }
      passed.set(taskId, marks);

      const standing = traces.get(taskId);

      if (!standing) {
        traces.set(taskId, {
          taskId: TaskId.of(taskId),
          title: row.title,
          runIds: [RunId.of(row.runId)],
          station: stationOf(
            row.standsName,
            row.standsColor,
            row.standsPosition,
            row.standsLineId,
          ),
          stations: [],
          harness: HarnessName.of(row.harness),
          state: row.state,
          startedAt: row.startedAt,
          endedAt: row.endedAt,
          runs: 1,
          input: shortened(row.description),
          output: shortened(answers.get(row.runId)),
        });
        continue;
      }

      traces.set(taskId, {
        ...standing,
        runIds: [...standing.runIds, RunId.of(row.runId)],
        runs: standing.runs + 1,
        startedAt: row.startedAt,
      });
    }

    return [...traces.values()].map((trace) => {
      const marks = new Map(passed.get(trace.taskId.value) ?? []);
      if (trace.station) {
        marks.set(trace.station.name.value, trace.station);
      }

      return {
        ...trace,
        stations: [...marks.values()].sort(
          (one, other) => one.position - other.position,
        ),
      };
    });
  }
}
