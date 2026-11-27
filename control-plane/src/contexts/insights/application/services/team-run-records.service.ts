import type { InsightsAccess } from '@insights/application/services/insights-access.service';
import type { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import { UnknownRunError } from '@insights/domain/exceptions/unknown-run.error';
import type { RunRecordRepository } from '@insights/domain/repositories/run-record.repository';
import type { ViewedTeam } from '@insights/domain/value-objects/viewed-team.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export interface RunRecordOnTeam {
  readonly access: ViewedTeam;
  readonly record: RunRecord;
}

export class TeamRunRecords {
  constructor(
    private readonly access: InsightsAccess,
    private readonly records: RunRecordRepository,
  ) {}

  async onTeam(input: {
    teamId: string;
    runId: string;
    viewerId: string;
  }): Promise<RunRecordOnTeam> {
    const access = await this.access.forTeam(
      TeamId.of(input.teamId),
      UserId.of(input.viewerId),
    );
    const record = await this.records.of(RunId.of(input.runId));
    const location = record?.end?.location;

    if (
      !record ||
      !location ||
      !access.covers(record.workspaceId, location.teamId)
    ) {
      throw new UnknownRunError(input.runId);
    }

    return { access, record };
  }
}
