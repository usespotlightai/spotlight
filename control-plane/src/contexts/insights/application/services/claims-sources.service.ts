import { ClaimsSource } from '@insights/domain/aggregates/claims-source.aggregate';
import { ClaimsSourceVersionConflictError } from '@insights/domain/exceptions/claims-source-version-conflict.error';
import type { ClaimsSourceRepository } from '@insights/domain/repositories/claims-source.repository';
import { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { nonEmpty } from '@shared-kernel/domain/non-empty';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { SourceCommit } from '@shared-kernel/domain/value-objects/source-commit.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface CommittedLine {
  readonly lineId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly deleted: boolean;
  readonly stations: readonly {
    readonly id: string;
    readonly rubricVersion: string | null;
    readonly claimsChanged: boolean;
  }[];
  readonly sourceCommit: {
    readonly repository: string;
    readonly sha: string;
  } | null;
}

export class ClaimsSources {
  constructor(
    private readonly sources: ClaimsSourceRepository,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async lineChanged(event: CommittedLine): Promise<void> {
    if (event.deleted || !event.sourceCommit) {
      return;
    }

    const commit = SourceCommit.of(event.sourceCommit);

    for (const station of event.stations) {
      const rubricVersion =
        station.claimsChanged && nonEmpty(station.rubricVersion)
          ? RubricVersion.readable(station.rubricVersion)
          : null;

      if (!rubricVersion) {
        continue;
      }

      const stationId = StationId.of(station.id);

      if (await this.sources.find(stationId, rubricVersion)) {
        continue;
      }

      await this.adding(
        ClaimsSource.recorded({
          station: {
            workspaceId: WorkspaceId.of(event.workspaceId),
            teamId: TeamId.of(event.teamId),
            lineId: LineId.of(event.lineId),
            stationId,
          },
          rubricVersion,
          commit,
          at: this.clock.now(),
        }),
      );
    }
  }

  private async adding(recorded: ClaimsSource): Promise<void> {
    try {
      await this.transaction.inTransaction(() => this.sources.add(recorded));
    } catch (error) {
      if (error instanceof ClaimsSourceVersionConflictError) {
        return;
      }
      throw error;
    }
  }
}
