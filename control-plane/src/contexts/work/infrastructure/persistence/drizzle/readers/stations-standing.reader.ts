import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { StationsStandingPort } from '@work/application/ports/stations-standing.port';
import { station } from '@work/infrastructure/persistence/drizzle/schemas/line.schema';
import { inArray } from 'drizzle-orm';

@Injectable()
export class DrizzleStationsStanding implements StationsStandingPort {
  constructor(private readonly context: DrizzleContext) {}

  async among(stationIds: readonly string[]): Promise<readonly string[]> {
    if (stationIds.length === 0) {
      return [];
    }

    return (
      await this.context.db
        .select({ id: station.id })
        .from(station)
        .where(inArray(station.id, [...new Set(stationIds)]))
    ).map((each) => each.id);
  }
}
