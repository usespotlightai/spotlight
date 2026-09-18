import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type {
  LineSetUp,
  LineSetUpReaderPort,
} from '@work/application/ports/line-set-up-reader.port';
import { entryOf } from '@work/domain/services/line-entry';
import {
  line,
  lineRepository,
  station,
} from '@work/infrastructure/persistence/drizzle/schemas/line.schema';
import { asc, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleLineSetUpReader implements LineSetUpReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async ofTeam(teamId: TeamId): Promise<readonly LineSetUp[]> {
    const [lines, stations, repositories] = await Promise.all([
      this.db
        .select({ id: line.id, key: line.key, name: line.name })
        .from(line)
        .where(eq(line.teamId, teamId.value))
        .orderBy(asc(line.id)),
      this.db
        .select({
          lineId: station.lineId,
          kind: station.kind,
          position: station.position,
          harness: station.harness,
          model: station.model,
          effort: station.effort,
        })
        .from(station)
        .innerJoin(line, eq(line.id, station.lineId))
        .where(eq(line.teamId, teamId.value)),
      this.db
        .select({
          lineId: lineRepository.lineId,
          repository: lineRepository.repository,
        })
        .from(lineRepository)
        .innerJoin(line, eq(line.id, lineRepository.lineId))
        .where(eq(line.teamId, teamId.value)),
    ]);

    return lines.map((each) => {
      const entry = entryOf(
        stations.filter((station) => station.lineId === each.id),
      );

      return {
        key: each.key,
        name: each.name,
        harness: entry?.harness ?? null,
        model: entry?.model ?? null,
        effort: entry?.effort ?? null,
        repositories: repositories
          .filter((repository) => repository.lineId === each.id)
          .map((repository) => repository.repository),
      };
    });
  }
}
