import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type {
  ReplayRunLabelsReaderPort,
  ReplayRunRow,
} from '@replays/application/ports/replay-run-labels-reader.port';
import {
  replay,
  replayCandidate,
  replayEntry,
} from '@replays/infrastructure/persistence/drizzle/schemas/replays.schema';
import { nonEmpty } from '@shared-kernel/domain/non-empty';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { eq, inArray } from 'drizzle-orm';

@Injectable()
export class DrizzleReplayRunLabelsReader implements ReplayRunLabelsReaderPort {
  constructor(private readonly context: DrizzleContext) {}

  async replayRuns(runs: readonly RunId[]): Promise<readonly ReplayRunRow[]> {
    if (runs.length === 0) {
      return [];
    }

    const rows = await this.context.db
      .select({
        runId: replayEntry.runId,
        workspaceId: replay.workspaceId,
        teamId: replay.teamId,
        lineId: replay.lineId,
        stationId: replay.stationId,
        candidateName: replayCandidate.name,
        candidateKind: replayCandidate.kind,
      })
      .from(replayEntry)
      .innerJoin(replay, eq(replay.id, replayEntry.replayId))
      .innerJoin(replayCandidate, eq(replayCandidate.id, replay.candidateId))
      .where(
        inArray(
          replayEntry.runId,
          runs.map((each) => each.value),
        ),
      );

    return rows.flatMap((row) =>
      nonEmpty(row.runId)
        ? [
            {
              run: RunId.of(row.runId),
              station: {
                workspaceId: WorkspaceId.of(row.workspaceId),
                teamId: TeamId.of(row.teamId),
                lineId: LineId.of(row.lineId),
                stationId: StationId.of(row.stationId),
              },
              candidateName: row.candidateName,
              candidateKind: row.candidateKind,
            },
          ]
        : [],
    );
  }
}
