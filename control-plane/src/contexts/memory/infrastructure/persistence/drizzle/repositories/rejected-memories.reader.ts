import type {
  RejectedMemoriesPort,
  RejectedMemory,
} from '@memory/application/ports/rejected-memories.port';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { memoryProposal } from '@memory/infrastructure/persistence/drizzle/schemas/memory.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { and, desc, eq, gte } from 'drizzle-orm';

@Injectable()
export class DrizzleRejectedMemories implements RejectedMemoriesPort {
  constructor(private readonly context: DrizzleContext) {}

  async rejectedOnTeam(
    teamId: TeamId,
    since: Date,
  ): Promise<readonly RejectedMemory[]> {
    const rows = await this.context.db
      .select()
      .from(memoryProposal)
      .where(
        and(
          eq(memoryProposal.teamId, teamId.value),
          eq(memoryProposal.state, 'rejected'),
          gte(memoryProposal.decidedAt, since),
        ),
      )
      .orderBy(desc(memoryProposal.decidedAt));

    return rows.flatMap((row) =>
      row.decidedAt
        ? [
            {
              id: MemoryId.of(row.id),
              kind: row.kind,
              body: MemoryBody.of(row.body),
              scope: MemoryScope.of({
                teamId: TeamId.of(row.teamId),
                lineId: row.lineId === null ? null : LineId.of(row.lineId),
                stationId:
                  row.stationId === null ? null : StationId.of(row.stationId),
                repository: row.repository
                  ? Repository.of(row.repository)
                  : null,
                paths: row.paths.map(MemoryPath.of),
              }),
              decidedAt: row.decidedAt,
            },
          ]
        : [],
    );
  }
}
